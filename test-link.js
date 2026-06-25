import 'dotenv/config';
import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot(process.env.BOT_TOKEN);

// Замени на ссылку канала, которую хочешь проверить
const link = process.argv[2] || 'https://max.ru/example';

console.log('Resolving link:', link);

try {
    const chat = await bot.api.getChatByLink(link);
    console.log('Result:', JSON.stringify(chat, null, 2));
} catch (e) {
    console.error('Error:', e.message);
    console.error('Status:', e.status);
    console.error('Response:', JSON.stringify(e.response, null, 2));
}
