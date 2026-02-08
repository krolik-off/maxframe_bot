import 'dotenv/config';
import { Bot } from '@maxhub/max-bot-api';
import { generateStatsImage } from './statsImage.js';
import MaxframeApi from './services/maxframeApi.js';

const bot = new Bot(process.env.BOT_TOKEN);
const maxframeApi = new MaxframeApi(process.env.MAXFRAME_SECRET_KEY);

bot.api.setMyCommands([
    {
        name: 'hello',
        description: 'Поприветствовать бота',
    },
]);

// Команда приветствия
bot.command('hello', (ctx) => {
    const sender = ctx.update.message?.sender;

    if (!sender) {
        return ctx.reply('Привет!');
    }

    return ctx.reply(`Привет, ${sender.first_name}!`);
});

// Обработка пересланных сообщений
bot.on('message_created', async (ctx) => {
    const message = ctx.update.message;
    const link = message?.link;

    // Проверяем, что это пересланное сообщение
    if (link?.type === 'forward') {
        console.log('=== FORWARD ===');
        console.log('chat_id:', link.chat_id);

        const originalChatId = link.chat_id;

        // Получаем данные из API maxframe.ru
        let statsData = await maxframeApi.getChannelProfile(originalChatId);

        // Если API не вернул данные, пробуем получить базовую информацию через bot.api
        if (!statsData) {
            console.log('[Bot] Maxframe API returned null, trying bot.api.getChat');
            try {
                const chat = await bot.api.getChat(originalChatId);
                statsData = {
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
            } catch (e) {
                console.error('[Bot] bot.api.getChat failed:', e.message);
                return ctx.reply('Не удалось получить информацию о канале');
            }
        }

        // Добавляем timestamp
        statsData.updatedAt = new Date();

        try {
            // Генерируем картинку
            const imageBuffer = await generateStatsImage(statsData);

            // Загружаем картинку
            const uploaded = await bot.api.uploadImage({ source: imageBuffer });

            // Отправляем с вложением
            return ctx.reply('', {
                attachments: [uploaded.toJson()]
            });
        } catch (e) {
            console.error('[Bot] Image generation failed:', e);
            return ctx.reply(`Информация о канале:\n${statsData.channelName || originalChatId}`);
        }
    }
});

bot.start();
