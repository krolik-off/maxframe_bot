import { Bot } from '@maxhub/max-bot-api';
import config from './config.js';
import { registerCommands } from './bot/commands.js';
import { registerHandlers } from './bot/handlers.js';

const bot = new Bot(config.bot.token);

// Регистрируем команды и обработчики
registerCommands(bot);
registerHandlers(bot);

// Не падаем при сетевых ошибках
process.on('uncaughtException', (err) => {
    console.error('[Bot] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
    console.error('[Bot] Unhandled rejection:', err.message || err);
});

// Запускаем бота
console.log('[Bot] Starting...');
bot.start();
console.log('[Bot] Started');
