/**
 * Парсинг строки роста из API ("+1'278" -> 1278, "-500" -> -500)
 * @param {string|number|null|undefined} str
 * @returns {number|null}
 */
export function parseGrowth(str) {
    if (str === undefined || str === null) return null;
    if (typeof str === 'number') return str;
    const cleaned = str.replace(/['\s]/g, '');
    return parseInt(cleaned, 10) || 0;
}

/**
 * Пустые данные для графика
 * @returns {{categories: string[], subscribers: number[], views24h: number[], views48h: number[]}}
 */
export function generateEmptyChartData() {
    return { categories: [], subscribers: [], views24h: [], views48h: [] };
}

/**
 * Преобразование данных API в формат для графика
 * @param {Object|null} historyData
 * @returns {{categories: string[], subscribers: number[], views24h: number[], views48h: number[]}}
 */
export function parseChartData(historyData) {
    if (!historyData || (!historyData.history?.length && !historyData.views?.length)) {
        return generateEmptyChartData();
    }

    const history = historyData.history || [];
    const viewsData = historyData.views || [];

    // Группируем данные по дням
    const dataByDay = new Map();

    // Парсим историю подписчиков
    history.forEach(item => {
        const timestamp = item.timestamp;
        if (timestamp) {
            const d = new Date(timestamp);
            const isoDate = d.toISOString().slice(0, 10);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const label = `${day}.${month}`;

            if (!dataByDay.has(isoDate)) {
                dataByDay.set(isoDate, { label, subs: 0, views: 0, views48h: 0 });
            }
            dataByDay.get(isoDate).subs = item.followers_cnt || 0;
        }
    });

    // Парсим просмотры
    viewsData.forEach(item => {
        const timestamp = item.timestamp;
        if (timestamp) {
            const d = new Date(timestamp);
            const isoDate = d.toISOString().slice(0, 10);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const label = `${day}.${month}`;

            if (!dataByDay.has(isoDate)) {
                dataByDay.set(isoDate, { label, subs: 0, views: 0, views48h: 0 });
            }
            dataByDay.get(isoDate).views = item.views || 0;
            dataByDay.get(isoDate).views48h = item.views_48h || 0;
        }
    });

    // Сортируем и берём последние 14 дней
    const sortedEntries = Array.from(dataByDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14);

    const categories = sortedEntries.map(([_, data]) => data.label);
    const subscribers = sortedEntries.map(([_, data]) => data.subs);
    const views24h = sortedEntries.map(([_, data]) => data.views);
    const views48h = sortedEntries.map(([_, data]) => data.views48h);

    if (categories.length === 0) {
        return generateEmptyChartData();
    }

    return { categories, subscribers, views24h, views48h };
}

/**
 * Преобразование данных рекламодателей из API
 * @param {Array|null} apiAdvertisers
 * @returns {Array}
 */
export function parseAdvertisers(apiAdvertisers) {
    if (!apiAdvertisers || !Array.isArray(apiAdvertisers) || apiAdvertisers.length === 0) {
        return [];
    }

    return apiAdvertisers.map(item => {
        let lastPost = '—';
        if (item.date_last_post) {
            const d = new Date(item.date_last_post);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            lastPost = `${day}.${month}`;
        }

        return {
            name: item.linked_title || item.title || item.name || 'Неизвестный канал',
            avatar: item.linked_avatar || item.avatar || null,
            posts: item.cnt_pub || item.posts_count || item.posts || 1,
            subs: item.linked_followers_cnt || item.subscribers || item.subs || 0,
            lastPost,
            link: item.linked_link || item.link || null,
            isFraud: item.is_fraud || false
        };
    });
}
