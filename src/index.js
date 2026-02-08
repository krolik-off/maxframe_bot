import { Bot } from '@maxhub/max-bot-api';
import config from './config.js';
import { registerCommands } from './bot/commands.js';
import { registerHandlers } from './bot/handlers.js';

const bot = new Bot(config.bot.token);

// Регистрируем команды и обработчики
registerCommands(bot);
registerHandlers(bot);

// Запускаем бота
console.log('[Bot] Starting...');
bot.start();
console.log('[Bot] Started');
