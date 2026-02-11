import MaxframeApi from '../services/maxframeApi.js';
import { generateStatsImage } from '../services/imageGenerator.js';
import { parseGrowth } from '../utils/parsers.js';

const maxframeApi = new MaxframeApi();

/**
 * Регистрация обработчиков событий
 * @param {import('@maxhub/max-bot-api').Bot} bot
 */
export function registerHandlers(bot) {
    // Обработка пересланных сообщений
    bot.on('message_created', async (ctx) => {
        const message = ctx.update.message;
        const link = message?.link;

        // Игнорируем сообщения старше 5 минут (при перезапуске бота)
        if (message?.created_at) {
            const messageAge = Date.now() - message.created_at;
            const FIVE_MINUTES = 5 * 60 * 1000;

            if (messageAge > FIVE_MINUTES) {
                console.log('[Handler] Ignoring old message (age:', Math.round(messageAge / 1000), 'seconds)');
                return;
            }
        }

        if (link?.type === 'forward') {
            await handleForwardedMessage(ctx, link.chat_id, bot);
        }
    });
}

/**
 * Обработка пересланного сообщения
 */
async function handleForwardedMessage(ctx, channelId, bot) {
    console.log('[Handler] Forward from channel:', channelId);

    // Получаем данные из API
    let statsData = await maxframeApi.getChannelProfile(channelId);

    // Fallback на bot.api если maxframe не вернул данные
    if (!statsData) {
        console.log('[Handler] Trying bot.api.getChat fallback');
        try {
            const chat = await bot.api.getChat(channelId);
            statsData = createFallbackStatsData(chat);
        } catch (e) {
            console.error('[Handler] Fallback failed:', e.message);
            return ctx.reply('Не удалось получить информацию о канале');
        }
    }

    statsData.updatedAt = new Date();

    // Генерируем и отправляем картинку
    try {
        const imageBuffer = await generateStatsImage(statsData);
        const uploaded = await bot.api.uploadImage({ source: imageBuffer });

        await ctx.reply('', {
            attachments: [uploaded.toJson()]
        });

        // Отправляем текстовую статистику
        const textStats = formatTextStats(statsData);
        return ctx.reply(textStats, { format: 'markdown' });
    } catch (e) {
        console.error('[Handler] Image generation failed:', e);
        return ctx.reply(`Информация о канале:\n${statsData.channelName || channelId}`);
    }
}

/**
 * Форматирование текстовой статистики
 */
function formatTextStats(data) {
    const formatNum = (num) => {
        if (num === null || num === undefined) return '—';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    const toNumber = (val) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return val;
        return parseGrowth(val);
    };

    const formatDelta = (num) => {
        const n = toNumber(num);
        if (n === null) return '—';
        const abs = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        const sign = n >= 0 ? '+' : '-';
        return sign + abs;
    };

    const dyn = data.dynamics || {};

    const channelTitle = data.channelName || 'Канал';
    const channelLine = data.link
        ? `📢   [${channelTitle}](${data.link})`
        : `📢   ${channelTitle}`;

    const lines = [
        channelLine,
        `👥   ${formatNum(data.subscribers)}`,
        '',
        '📊   Подписчики:',
        `├ Сегодня: ${formatDelta(dyn.today)}`,
        `├ Неделя: ${formatDelta(dyn.week)}`,
        `└ Месяц: ${formatDelta(dyn.month)}`,
        '',
        '👁   Охваты:',
        `├ 24 часа: ${formatNum(data.views24h)}`,
        `└ 48 часов: ${formatNum(data.views48h)}`,
        '',
        data.er !== null ? `ER: ${data.er}%` : null,
        '',
        'Данные из 🤖 [MaxFrame](https://max.ru/id026410900305_1_bot) бота.',
        'Сервис аналитики макс каналов - 💻 [maxframe.ru](http://maxframe.ru/)'
    ];

    return lines.filter(line => line !== null).join('\n');
}

/**
 * Создание объекта statsData из данных bot.api
 */
function createFallbackStatsData(chat) {
    return {
        channelName: chat.title || null,
        subscribers: chat.participants_count || null,
        isPublic: chat.is_public ?? null,
        description: chat.description || null,
        categories: [],
        isSuspicious: false,
        dynamics: { today: null, week: null, month: null },
        avgViews: null,
        views24h: null,
        views48h: null,
        er: null,
        mentions: { from: 0, to: 0 },
        advertisers: [],
        advertised: [],
        chartData: null
    };
}
