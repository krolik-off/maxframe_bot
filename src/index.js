import express from 'express';
import { Bot } from '@maxhub/max-bot-api';
import config from './config.js';
import { registerCommands } from './bot/commands.js';
import { registerHandlers } from './bot/handlers.js';
import db from './services/db.js';

const bot = new Bot(config.bot.token);

registerCommands(bot);
registerHandlers(bot);

process.on('uncaughtException', (err) => {
    console.error('[Bot] Uncaught exception:', err.message);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    console.error('[Bot] Unhandled rejection:', err.message || err);
    process.exit(1);
});

async function registerWebhook() {
    const url = `https://platform-api.max.ru/subscriptions`;
    const webhookUrl = config.webhook.url;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': config.bot.token
        },
        body: JSON.stringify({ url: webhookUrl })
    });

    const data = await res.json();
    console.log('[Bot] Webhook registered:', JSON.stringify(data));
}

const app = express();
app.use(express.json());

function requireApiAuth(req, res) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${config.api.secretKey}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
}

async function fetchAllChats() {
    const allChats = [];
    let marker = null;
    do {
        const url = new URL('https://botapi.max.ru/chats');
        url.searchParams.set('count', '100');
        if (marker) url.searchParams.set('marker', marker);
        const apiRes = await fetch(url, { headers: { 'Authorization': config.bot.token } });
        const data = await apiRes.json();
        if (data.chats) allChats.push(...data.chats);
        marker = data.marker || null;
    } while (marker);
    return allChats;
}

app.get('/list-channels', async (req, res) => {
    if (!requireApiAuth(req, res)) return;
    try {
        const chats = await fetchAllChats();
        return res.json(chats.map(c => ({
            chat_id: c.chat_id,
            title: c.title,
            link: c.link,
            type: c.type,
            is_public: c.is_public,
            participants_count: c.participants_count
        })));
    } catch (e) {
        console.error('[API] /list-channels error:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

app.get('/channel-info', async (req, res) => {
    if (!requireApiAuth(req, res)) return;

    const inviteLink = req.query.link;
    const chatId = req.query.chat_id;

    if (!inviteLink && !chatId) {
        return res.status(400).json({ error: 'Missing link or chat_id parameter' });
    }

    try {
        if (chatId) {
            const cached = db.prepare('SELECT * FROM channels WHERE chat_id = ?').get(chatId);
            if (cached) return res.json(cached);
            const url = new URL(`https://botapi.max.ru/chats/${chatId}`);
            const apiRes = await fetch(url, { headers: { 'Authorization': config.bot.token } });
            if (!apiRes.ok) return res.status(404).json({ error: 'Channel not found' });
            return res.json(await apiRes.json());
        }

        const fullLink = inviteLink.startsWith('http') ? inviteLink : `https://max.ru/join/${inviteLink.split('/').pop()}`;

        const cached = db.prepare('SELECT * FROM channels WHERE link = ?').get(fullLink);
        if (cached) return res.json(cached);

        const chats = await fetchAllChats();
        const chat = chats.find(c => c.link === fullLink);

        if (!chat) {
            return res.status(404).json({ error: 'Channel not found. Make sure the bot is a member and the link is current.' });
        }
        return res.json(chat);
    } catch (e) {
        console.error('[API] /channel-info error:', e.message);
        return res.status(500).json({ error: e.message });
    }
});

app.post('/webhook', (req, res) => {
    res.sendStatus(200);
    bot.handleUpdate(req.body).catch((err) => {
        console.error('[Bot] Error handling update:', err.message);
    });
});

app.listen(3000, async () => {
    console.log('[Bot] Webhook server listening on port 3000');
    await registerWebhook();
    console.log('[Bot] Started');
});
