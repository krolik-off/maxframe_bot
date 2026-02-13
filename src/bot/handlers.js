import MaxframeApi from '../services/maxframeApi.js';
import { generateStatsImage } from '../services/imageGenerator.js';
import { parseGrowth } from '../utils/parsers.js';
import stats from '../services/stats.js';

const maxframeApi = new MaxframeApi();

// Rate limit: 10 запросов в минуту на пользователя
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;
const userRequests = new Map();

function isRateLimited(userId) {
    const now = Date.now();
    const timestamps = userRequests.get(userId) || [];
    const recent = timestamps.filter(t => now - t < RATE_WINDOW);
    recent.push(now);
    userRequests.set(userId, recent);
    return recent.length > RATE_LIMIT;
}

// Очистка старых записей каждые 5 минут
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamps] of userRequests) {
        const recent = timestamps.filter(t => now - t < RATE_WINDOW);
        if (recent.length === 0) userRequests.delete(userId);
        else userRequests.set(userId, recent);
    }
}, 5 * 60 * 1000);

/**
 * Регистрация обработчиков событий
 * @param {import('@maxhub/max-bot-api').Bot} bot
 */
export function registerHandlers(bot) {
    // Обработка пересланных сообщений
    bot.on('message_created', async (ctx) => {
        const message = ctx.update.message;
        const link = message?.link;

        // Реагируем только на личные сообщения боту
        if (message?.recipient?.chat_type !== 'dialog') {
            return;
        }

        // Игнорируем сообщения старше 5 минут (при перезапуске бота)
        if (message?.created_at) {
            const messageAge = Date.now() - message.created_at;
            const FIVE_MINUTES = 5 * 60 * 1000;

            if (messageAge > FIVE_MINUTES) {
                console.log('[Handler] Ignoring old message (age:', Math.round(messageAge / 1000), 'seconds)');
                return;
            }
        }

        // Rate limit
        const senderId = message?.sender?.user_id;
        if (senderId && isRateLimited(senderId)) {
            console.log('[Handler] Rate limited user:', senderId);
            stats.trackRateLimit();
            try {
                await ctx.reply('Слишком много запросов. Подождите минуту и попробуйте снова.');
            } catch (_) {}
            return;
        }

        try {
            if (link?.type === 'forward') {
                await handleForwardedMessage(ctx, link.chat_id, bot);
            }
        } catch (e) {
            if (e.response?.code === 'chat.denied' || e.status === 403) {
                console.error('[Handler] chat.denied error, skipping:', e.message);
                return;
            }
            console.error('[Handler] Unhandled error:', e);
            try {
                await ctx.reply('Ошибка получения данных обратитесь в службу поддержки бота.');
            } catch (_) {}
        }
    });
}

/**
 * Обработка пересланного сообщения
 */
async function handleForwardedMessage(ctx, channelId, bot) {
    console.log('[Handler] Forward from channel:', channelId);
    stats.trackRequest(ctx.update.message?.sender?.user_id);

    // Получаем данные из API
    let statsData = await maxframeApi.getChannelProfile(channelId);

    // Если канала нет в базе MaxFrame — просим добавить
    if (!statsData) {
        console.log('[Handler] Channel not found in MaxFrame:', channelId);
        stats.trackNotFound();
        try {
            return await ctx.reply(
                'Этот канал ещё не добавлен в базу MaxFrame.\n\n' +
                'Если канал открытый — добавьте его на сайте [maxframe.ru](https://maxframe.ru) и попробуйте снова.\n\n' +
                'Если канал закрытый — ознакомьтесь с 📖 [инструкцией по добавлению](https://maxframe.ru/maxframe-bot/), процесс немного отличается.',
                { format: 'markdown' }
            );
        } catch (e) {
            console.error('[Handler] Failed to reply (channel not found):', e.message);
        }
        return;
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
        if (e.response?.code === 'chat.denied' || e.status === 403) {
            throw e;
        }
        console.error('[Handler] Image generation failed:', e);
        try {
            return await ctx.reply(`Информация о канале:\n${statsData.channelName || channelId}`);
        } catch (_) {
            console.error('[Handler] Failed to send fallback reply');
        }
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
