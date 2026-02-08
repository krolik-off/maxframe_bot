const API_URL = 'https://maxframe.ru/api/bot/channel-profile/';

class MaxframeApi {
    constructor(secretKey) {
        this.secretKey = secretKey;
    }

    /**
     * Получить профиль канала
     * @param {string|number} channelId - ID канала
     * @returns {Promise<ChannelProfile|null>}
     */
    async getChannelProfile(channelId) {
        const normalizedId = String(Math.abs(Number(channelId)));
        console.log('[MaxframeApi] Requesting channel profile for:', normalizedId);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    secret_key: this.secretKey,
                    channel_id: normalizedId
                })
            });

            if (!response.ok) {
                console.error('[MaxframeApi] HTTP error:', response.status, response.statusText);
                return null;
            }

            const json = await response.json();

            if (!json.data) {
                console.error('[MaxframeApi] No data in response');
                return null;
            }

            return this._normalizeResponse(json.data);
        } catch (error) {
            console.error('[MaxframeApi] Request failed:', error.message);
            return null;
        }
    }

    /**
     * Нормализовать ответ API в единый формат
     * @private
     */
    _normalizeResponse(data) {
        const channelInfo = data.channel_info || {};
        const metrics = data.publications_metrics || {};
        const adsData = data.ads_data || {};
        const historyData = data.history_data || {};
        const extraData = data.extra_channel_data || {};

        // Получаем последнюю запись из истории для актуального числа подписчиков
        const history = historyData.history || [];
        const latestHistory = history.length > 0 ? history[history.length - 1] : null;

        // Логируем источники подписчиков
        console.log('[MaxframeApi] Subscribers sources:');
        console.log('  - channelInfo.subscribers:', channelInfo.subscribers);
        console.log('  - channelInfo.participants_count:', channelInfo.participants_count);
        console.log('  - latestHistory.followers_cnt:', latestHistory?.followers_cnt);

        const subscribers = channelInfo.subscribers
            || channelInfo.participants_count
            || latestHistory?.followers_cnt
            || null;

        console.log('  - FINAL:', subscribers);

        return {
            // Основная информация о канале
            channelId: channelInfo.max_channel_id || null,
            channelName: channelInfo.title || channelInfo.name || latestHistory?.channel_name || null,
            channelAvatar: latestHistory?.avatar || channelInfo.avatar || null,
            description: channelInfo.description || null,
            link: channelInfo.link || null,

            // Подписчики и метрики
            subscribers,
            isPublic: channelInfo.is_public ?? null,

            // Категории
            categories: [channelInfo.category, channelInfo.category2].filter(Boolean),

            // Накрутка
            isSuspicious: !!(channelInfo.is_fraud || channelInfo.is_followers_fraud || channelInfo.is_owner_fraud),

            // Динамика подписчиков
            dynamics: {
                today: extraData.growth?.h24 ?? null,
                week: extraData.growth?.week ?? null,
                month: extraData.growth?.month ?? null
            },

            // Охваты
            avgViews: metrics.avg_views_1d || metrics.avg_views_day || null,
            views24h: metrics.avg_views_1d || null,
            views48h: metrics.avg_views_7d || null,

            // ER
            er: extraData.er_metric || channelInfo.er || channelInfo.engagement_rate || null,

            // Упоминания
            mentions: {
                from: channelInfo.mentions_from || channelInfo.mentioned_by || 0,
                to: channelInfo.mentions_to || channelInfo.mentions || 0
            },

            // Реклама
            advertisers: adsData.advertisers?.data || [],
            advertisersTotal: adsData.advertisers?.total_count || 0,
            advertised: adsData.advertised?.data || [],
            advertisedTotal: adsData.advertised?.total_count || 0,

            // Данные для графика
            chartData: historyData,

            // Сырые данные (на случай если понадобятся)
            _raw: {
                channelInfo,
                metrics,
                adsData,
                historyData,
                extraData
            }
        };
    }
}

export default MaxframeApi;
