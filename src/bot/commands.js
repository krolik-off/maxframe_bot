import stats from '../services/stats.js';

/**
 * Регистрация команд бота
 * @param {import('@maxhub/max-bot-api').Bot} bot
 */
export function registerCommands(bot) {
    // Устанавливаем список команд
    bot.api.setMyCommands([
        {
            name: 'start',
            description: 'Начать работу с ботом',
        },
    ]);

    // Команда start
    bot.command('start', async (ctx) => {
        const sender = ctx.update.message?.sender;
        const name = sender?.first_name || '';

        const welcomeMessage = `👋 Привет${name ? ', ' + name : ''}!

Я бот для аналитики каналов от MAXFRAME.RU

📊 Что я умею:
Показываю подробную статистику любого канала — подписчики, охваты, динамика роста, рекламные интеграции и многое другое.

🚀 Как пользоваться:
Просто перешли мне любое сообщение из канала, и я покажу его полную статистику.

📈 Что ты получишь:
├ Количество подписчиков и динамику
├ Охваты публикаций (24ч / 48ч)
├ Показатель вовлечённости (ER)
├ Информацию о рекламных интеграциях
└ График роста канала

🔗 Подробная аналитика: maxframe.ru`;

        const userId = sender?.user_id;
        stats.trackStart(userId, name);

        console.log('[Command] Sending /start reply to:', userId);
        try {
            const result = await ctx.reply(welcomeMessage);
            console.log('[Command] /start reply sent OK');
            return result;
        } catch (e) {
            const code = e.response?.code;
            if (code === 'dialog.not.found' || code === 'chat.denied' || e.status === 403 || e.status === 404) {
                return;
            }
            console.error('[Command] Failed to reply /start:', e.message, JSON.stringify(e.response || e));
        }
    });
}