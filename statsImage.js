import nodeHtmlToImage from 'node-html-to-image';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoBase64 = 'data:image/png;base64,' + readFileSync(resolve(__dirname, 'android-chrome-512x512.png')).toString('base64');

// Форматирование чисел с разделителями
function formatNum(num) {
    if (num === undefined || num === null) return '—';
    return Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Компактное форматирование чисел (1K, 1.2M и т.д.)
function formatCompact(num) {
    if (num === undefined || num === null) return '—';
    const absNum = Math.abs(num);
    if (absNum >= 1000000) {
        return (absNum / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (absNum >= 1000) {
        return (absNum / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return absNum.toString();
}

function formatDelta(num) {
    if (num === undefined || num === null) return '—';
    if (num > 0) return '+' + formatNum(num);
    if (num < 0) return '−' + formatNum(Math.abs(num));
    return '0';
}

// Парсинг строки роста из API ("+1'278" -> 1278, "-500" -> -500)
function parseGrowth(str) {
    if (str === undefined || str === null) return 0;
    if (typeof str === 'number') return str;
    // Убираем апострофы и пробелы, парсим число
    const cleaned = str.replace(/['\s]/g, '');
    return parseInt(cleaned, 10) || 0;
}

// Форматирование даты
function formatDate(date) {
    const d = date || new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Пустые данные для графика (если нет реальных данных)
function generateEmptyChartData() {
    return { categories: [], subscribers: [], views24h: [], views48h: [] };
}

// Преобразование данных API в формат для графика
function parseChartData(historyData) {
    // Если нет данных из API, используем фоллбэк
    if (!historyData || (!historyData.history?.length && !historyData.views?.length)) {
        return generateEmptyChartData();
    }

    const history = historyData.history || [];
    const viewsData = historyData.views || [];

    // Группируем данные по дням (берём последнее значение за день)
    // Ключ: ISO дата для сортировки, значение: { label, subs, views, views48h }
    const dataByDay = new Map();

    // Парсим историю подписчиков
    history.forEach(item => {
        const timestamp = item.timestamp;
        if (timestamp) {
            const d = new Date(timestamp);
            const isoDate = d.toISOString().slice(0, 10); // YYYY-MM-DD для сортировки
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

    // Сортируем по ISO дате и берём последние 14 дней
    const sortedEntries = Array.from(dataByDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14);

    const categories = sortedEntries.map(([_, data]) => data.label);
    const subscribers = sortedEntries.map(([_, data]) => data.subs);
    const views24h = sortedEntries.map(([_, data]) => data.views);
    const views48h = sortedEntries.map(([_, data]) => data.views48h);

    // Если categories пустые, возвращаем пустые данные
    if (categories.length === 0) {
        return generateEmptyChartData();
    }

    return { categories, subscribers, views24h, views48h };
}

// Преобразование данных рекламодателей из API
function parseAdvertisers(apiAdvertisers) {
    if (!apiAdvertisers || !Array.isArray(apiAdvertisers) || apiAdvertisers.length === 0) {
        return [];
    }

    return apiAdvertisers.map(item => {
        // Форматируем дату
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

// Главная функция генерации картинки
export async function generateStatsImage(data) {
    const chartData = parseChartData(data.chartData);
    const hasChartData = chartData.categories.length > 0;
    const advertisers = parseAdvertisers(data.advertisers);
    const advertisersTotal = data.advertisersTotal || 0;
    const advertised = parseAdvertisers(data.advertised);
    const advertisedTotal = data.advertisedTotal || 0;

    console.log('[StatsImage] advertisers:', advertisers.length, 'total:', advertisersTotal);
    console.log('[StatsImage] advertised:', advertised.length, 'total:', advertisedTotal);
    console.log('[StatsImage] raw data.advertisersTotal:', data.advertisersTotal);
    console.log('[StatsImage] raw data.advertisedTotal:', data.advertisedTotal);

    const subs = data.subscribers ?? null;
    const dyn = {
        today: data.dynamics?.today !== undefined ? parseGrowth(data.dynamics.today) : null,
        week: data.dynamics?.week !== undefined ? parseGrowth(data.dynamics.week) : null,
        month: data.dynamics?.month !== undefined ? parseGrowth(data.dynamics.month) : null
    };
    const er = data.er ?? null;
    const mentions = data.mentions || { from: 0, to: 0 };
    const isSuspicious = data.isSuspicious || false;
    const channelName = data.channelName || 'Название канала';
    const channelAvatar = data.channelAvatar || null;
    const categories = data.categories || [];
    const avgViews = data.avgViews ?? null;
    const views24h = data.views24h ?? null;
    const views48h = data.views48h ?? null;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { font-family: 'Inter', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
            body { width: 1800px; background: #f5f5f5; padding: 28px; }
            .section { background: #fff; border-radius: 20px; padding: 36px; margin-bottom: 20px; }
            .section-title { font-size: 26px; font-weight: 600; color: #333; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 4px solid #7c3aed; display: inline-block; }
            .positive { color: #10b981; }
            .negative { color: #ef4444; }
        </style>
    </head>
    <body>
        <!-- Header -->
        <div class="section" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 24px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${logoBase64}" style="width: 40px; height: 40px; border-radius: 10px; object-fit: cover;" />
                <div>
                    <div style="font-size: 20px; font-weight: 700; color: #1a1a1a;">MAXFRAME.RU</div>
                    <div style="font-size: 12px; color: #666;">Аналитика каналов</div>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 12px; color: #999;">Данные на</div>
                <div style="font-size: 16px; font-weight: 600; color: #333;">${formatDate(data.updatedAt)}</div>
            </div>
        </div>

        <!-- Channel Info -->
        <div class="section" style="padding: 36px;">
            <div style="display: flex; gap: 32px; align-items: center;">
                ${channelAvatar
                    ? `<img src="${channelAvatar}" style="width: 130px; height: 130px; border-radius: 20px; object-fit: cover;" />`
                    : `<div style="width: 130px; height: 130px; background: #7c3aed; border-radius: 20px;"></div>`
                }
                <div style="flex: 1;">
                    <div style="font-size: 34px; font-weight: 600; color: #1a1a1a; margin-bottom: 14px;">${channelName.length > 30 ? channelName.slice(0, 30) + '...' : channelName}</div>
                    <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
                        ${categories.slice(0, 2).map(cat => `<span style="font-size: 18px; padding: 10px 20px; background: #f0f0f0; border-radius: 20px; color: #666;">${cat}</span>`).join('')}
                        <span style="font-size: 18px; padding: 10px 20px; background: ${isSuspicious ? '#fef2f2' : '#f0fdf4'}; border-radius: 20px; color: ${isSuspicious ? '#ef4444' : '#10b981'}; font-weight: 600;">Накрутка: ${isSuspicious ? 'Да' : 'Нет'}</span>
                    </div>
                </div>
                <div style="text-align: right; padding-left: 32px; border-left: 3px solid #eee;">
                    <div style="font-size: 18px; color: #999; margin-bottom: 8px;">Подписчиков</div>
                    <div style="font-size: 86px; font-weight: 700; color: #7c3aed; line-height: 1; white-space: nowrap;">${formatCompact(subs)}</div>
                </div>
            </div>
        </div>

        <!-- Middle row: Stats + Metrics left, Ad Tables right -->
        <div style="display: flex; gap: 20px; align-items: stretch;">
            <!-- Left column: Stats + Metrics -->
            <div style="flex: 7; min-width: 0;">
                <!-- Stats title -->
                <div style="font-size: 26px; font-weight: 600; color: #333; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 4px solid #7c3aed; display: inline-block;">Кол-во подписчиков</div>
                <div style="display: flex; gap: 14px; margin-bottom: 20px;">
                    <div style="flex: 1; min-width: 0; text-align: center; padding: 36px 8px; background: #fff; border-radius: 20px; overflow: hidden;">
                        <div style="font-size: 30px; color: #333; font-weight: 600; margin-bottom: 16px;">Сегодня</div>
                        <div style="font-size: 62px; font-weight: 700; line-height: 1; white-space: nowrap;" class="${dyn.today >= 0 ? 'positive' : 'negative'}">${dyn.today >= 0 ? '+' : ''}${formatCompact(dyn.today)}</div>
                    </div>
                    <div style="flex: 1; min-width: 0; text-align: center; padding: 36px 8px; background: #fff; border-radius: 20px; overflow: hidden;">
                        <div style="font-size: 30px; color: #333; font-weight: 600; margin-bottom: 16px;">Неделя</div>
                        <div style="font-size: 62px; font-weight: 700; line-height: 1; white-space: nowrap;" class="${dyn.week >= 0 ? 'positive' : 'negative'}">${dyn.week >= 0 ? '+' : ''}${formatCompact(dyn.week)}</div>
                    </div>
                    <div style="flex: 1; min-width: 0; text-align: center; padding: 36px 8px; background: #fff; border-radius: 20px; overflow: hidden;">
                        <div style="font-size: 30px; color: #333; font-weight: 600; margin-bottom: 16px;">Месяц</div>
                        <div style="font-size: 62px; font-weight: 700; line-height: 1; white-space: nowrap;" class="${dyn.month >= 0 ? 'positive' : 'negative'}">${dyn.month >= 0 ? '+' : ''}${formatCompact(dyn.month)}</div>
                    </div>
                    <div style="flex: 1; min-width: 0; text-align: center; padding: 36px 8px; background: #fff; border-radius: 20px; overflow: hidden;">
                        <div style="font-size: 30px; color: #333; font-weight: 600; margin-bottom: 16px;">ER</div>
                        <div style="font-size: 62px; font-weight: 700; color: #7c3aed; line-height: 1; white-space: nowrap;">${er.toFixed(1)}%</div>
                    </div>
                </div>
                <!-- Metrics title -->
                <div style="font-size: 26px; font-weight: 600; color: #333; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 4px solid #7c3aed; display: inline-block;">Охваты и показатели</div>
                <div style="display: flex; gap: 18px;">
                    <div style="flex: 1; min-width: 0; padding: 44px 16px; background: #fff; border-radius: 20px; text-align: center;">
                        <div style="font-size: 32px; color: #333; font-weight: 600; margin-bottom: 20px;">Просмотры/пост</div>
                        <div style="font-size: 72px; font-weight: 700; color: #333; line-height: 1; white-space: nowrap;">${formatCompact(avgViews)}</div>
                    </div>
                    <div style="flex: 1; min-width: 0; padding: 44px 16px; background: #fff; border-radius: 20px; text-align: center;">
                        <div style="font-size: 32px; color: #333; font-weight: 600; margin-bottom: 20px;">Охват 24ч</div>
                        <div style="font-size: 72px; font-weight: 700; color: #3b82f6; line-height: 1; white-space: nowrap;">${formatCompact(views24h)}</div>
                    </div>
                    <div style="flex: 1; min-width: 0; padding: 44px 16px; background: #fff; border-radius: 20px; text-align: center;">
                        <div style="font-size: 32px; color: #333; font-weight: 600; margin-bottom: 20px;">Охват 48ч</div>
                        <div style="font-size: 72px; font-weight: 700; color: #3b82f6; line-height: 1; white-space: nowrap;">${formatCompact(views48h)}</div>
                    </div>
                </div>
            </div>
            <!-- Right column: Ad Tables -->
            <div class="section" style="flex: 2; min-width: 0; padding: 28px; margin-bottom: 0; display: flex; flex-direction: column;">
                <div class="section-title" style="white-space: nowrap;">Кто рекламировал</div>
                ${advertisers.length > 0 ? advertisers.slice(0, 3).map(row => `
                <div style="display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid #f0f0f0;">
                    ${row.avatar ? `<img src="${row.avatar}" style="width: 56px; height: 56px; border-radius: 12px; object-fit: cover;" />` : `<div style="width: 56px; height: 56px; border-radius: 12px; background: #e0e0e0;"></div>`}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 18px; color: #333; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${row.name}</div>
                        <div style="font-size: 16px; color: #999; white-space: nowrap;">${formatCompact(row.subs)} подписчиков</div>
                    </div>
                </div>
                `).join('') : `<div style="color: #999; font-size: 18px; padding: 30px 0; text-align: center;">Нет данных</div>`}
                ${advertisers.length > 0 ? `<div style="color: #999; font-size: 14px; text-align: center; margin-top: 12px;">Показано ${Math.min(3, advertisers.length)} из ${advertisersTotal || advertisers.length} · <a href="https://maxframe.ru" style="color: #7c3aed; text-decoration: none;">maxframe.ru</a></div>` : ''}
            </div>
            <div class="section" style="flex: 2; min-width: 0; padding: 28px; margin-bottom: 0; display: flex; flex-direction: column;">
                <div class="section-title" style="white-space: nowrap;">Кого рекламировал</div>
                ${advertised.length > 0 ? advertised.slice(0, 3).map(row => `
                <div style="display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid #f0f0f0;">
                    ${row.avatar ? `<img src="${row.avatar}" style="width: 56px; height: 56px; border-radius: 12px; object-fit: cover;" />` : `<div style="width: 56px; height: 56px; border-radius: 12px; background: #e0e0e0;"></div>`}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 18px; color: #333; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${row.name}</div>
                        <div style="font-size: 16px; color: #999; white-space: nowrap;">${formatCompact(row.subs)} подписчиков</div>
                    </div>
                </div>
                `).join('') : `<div style="color: #999; font-size: 18px; padding: 30px 0; text-align: center;">Нет данных</div>`}
                ${advertised.length > 0 ? `<div style="color: #999; font-size: 14px; text-align: center; margin-top: 12px;">Показано ${Math.min(3, advertised.length)} из ${advertisedTotal || advertised.length} · <a href="https://maxframe.ru" style="color: #7c3aed; text-decoration: none;">maxframe.ru</a></div>` : ''}
            </div>
        </div>

        <!-- Chart -->
        ${hasChartData ? `
        <div class="section" style="padding: 36px; margin-top: 20px;">
            <div class="section-title" style="font-size: 26px;">График</div>
            <div id="chart"></div>
        </div>

        <script>
            var options = {
                series: [{
                    name: 'Подписчики',
                    data: ${JSON.stringify(chartData.subscribers)}
                }, {
                    name: 'Просмотры 24ч',
                    data: ${JSON.stringify(chartData.views24h)}
                }, {
                    name: 'Просмотры 48ч',
                    data: ${JSON.stringify(chartData.views48h)}
                }],
                chart: {
                    height: 380,
                    type: 'line',
                    background: 'transparent',
                    toolbar: { show: false },
                    animations: { enabled: false },
                    fontFamily: 'Inter, sans-serif'
                },
                colors: ['#7c3aed', '#10b981', '#3b82f6'],
                stroke: { width: [6, 5, 5], curve: 'smooth' },
                markers: { size: 8, strokeWidth: 0 },
                dataLabels: { enabled: false },
                xaxis: {
                    categories: ${JSON.stringify(chartData.categories)},
                    labels: { style: { colors: '#666', fontSize: '18px' } },
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    labels: { style: { colors: '#666', fontSize: '18px' }, formatter: v => Math.round(v) }
                },
                grid: { borderColor: '#eee', strokeDashArray: 0 },
                legend: {
                    position: 'top',
                    horizontalAlign: 'center',
                    fontSize: '20px',
                    labels: { colors: '#333' },
                    markers: { width: 16, height: 16, radius: 16 },
                    itemMargin: { horizontal: 28 }
                },
                tooltip: { enabled: false }
            };
            new ApexCharts(document.querySelector("#chart"), options).render();
        </script>
        ` : ''}
    </body>
    </html>
    `;

    const image = await nodeHtmlToImage({
        html,
        quality: 100,
        type: 'png',
        puppeteerArgs: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        waitUntil: 'networkidle0',
        timeout: 30000
    });

    return image;
}
