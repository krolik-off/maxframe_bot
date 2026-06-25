import { Bot } from '@maxhub/max-bot-api';

const token = process.argv[2];
if (!token) {
    console.error('Usage: node list-chats.js <BOT_TOKEN>');
    process.exit(1);
}

const bot = new Bot(token);
const chats = await bot.api.getAllChats();
for (const c of chats.chats || []) {
    console.log(`${c.title || '—'}: ${c.chat_id}`);
}
