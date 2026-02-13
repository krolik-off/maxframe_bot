import { Bot } from '@maxhub/max-bot-api';
import config from './config.js';
import { registerCommands } from './bot/commands.js';
import { registerHandlers } from './bot/handlers.js';

const bot = new Bot(config.bot.token);

// Регистрируем команды и обработчики
registerCommands(bot);
registerHandlers(bot);

// Запуск с автоматическим переподключением
async function startBot() {
    while (true) {
        try {
            console.log('[Bot] Starting...');
            await bot.start();
        } catch (err) {
            console.error('[Bot] Polling error:', err.message);
        }
        console.log('[Bot] Reconnecting in 3s...');
        await new Promise(r => setTimeout(r, 3000));
    }
}

// Ловим ошибки чтобы процесс не падал
process.on('uncaughtException', (err) => {
    console.error('[Bot] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
    console.error('[Bot] Unhandled rejection:', err.message || err);
});

startBot();
