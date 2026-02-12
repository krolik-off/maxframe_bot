import config from '../config.js';

class MaxframeApi {
    constructor(secretKey = config.maxframe.secretKey) {
        this.secretKey = secretKey;
        this.apiUrl = config.maxframe.apiUrl;
    }

    /**
     * Получить профиль канала
     * @param {string|number} channelId
     * @returns {Promise<Object|null>}
     */
    async getChannelProfile(channelId) {
        const normalizedId = String(Math.abs(Number(channelId)));
        console.log('[MaxframeApi] Requesting channel:', normalizedId);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret_key: this.secretKey,
                    channel_id: normalizedId
                })
            });

            if (!response.ok) {
                console.error('[MaxframeApi] HTTP error:', response.status);
                return null;
            }

            const json = await response.json();
            if (!json.data) {
                console.error('[MaxframeApi] No data in response');
                return null;
            }

            const result = this._normalizeResponse(json.data);

            // Если нет подписчиков и имени — канала нет в базе
            if (!result.subscribers && !result.channelName) {
                console.log('[MaxframeApi] Channel not found in database (empty data)');
                return null;
            }

            return result;
        } catch (error) {
            console.error('[MaxframeApi] Request failed:', error.message);
            return null;
        }
    }

    /**
     * @private
     */
    _normalizeResponse(data) {
        const channelInfo = data.channel_info || {};
        const metrics = data.publications_metrics || {};
        const adsData = data.ads_data || {};
        const historyData = data.history_data || {};
        const extraData = data.extra_channel_data || {};

        const history = historyData.history || [];
        const latestHistory = history.length > 0 ? history[history.length - 1] : null;

        const subscribers = channelInfo.subscribers
            || channelInfo.participants_count
            || latestHistory?.followers_cnt
            || null;

        console.log('[MaxframeApi] Subscribers:', subscribers);

        return {
            channelId: channelInfo.max_channel_id || null,
            channelName: channelInfo.title || channelInfo.name || latestHistory?.channel_name || null,
            channelAvatar: latestHistory?.avatar || channelInfo.avatar || null,
            description: channelInfo.description || null,
            link: channelInfo.link || null,
            subscribers,
            isPublic: channelInfo.is_public ?? null,
            categories: [channelInfo.category, channelInfo.category2].filter(Boolean),
            isSuspicious: !!(channelInfo.is_fraud || channelInfo.is_followers_fraud || channelInfo.is_owner_fraud),
            dynamics: {
                today: extraData.growth?.h24 ?? null,
                week: extraData.growth?.week ?? null,
                month: extraData.growth?.month ?? null
            },
            avgViews: metrics.avg_views_1d || metrics.avg_views_day || null,
            views24h: metrics.avg_views_1d || null,
            views48h: metrics.avg_views_7d || null,
            er: extraData.er_metric || channelInfo.er || channelInfo.engagement_rate || null,
            mentions: {
                from: channelInfo.mentions_from || channelInfo.mentioned_by || 0,
                to: channelInfo.mentions_to || channelInfo.mentions || 0
            },
            advertisers: adsData.advertisers?.data || [],
            advertisersTotal: adsData.advertisers?.total_count || 0,
            advertised: adsData.advertised?.data || [],
            advertisedTotal: adsData.advertised?.total_count || 0,
            chartData: historyData
        };
    }
}

export default MaxframeApi;
