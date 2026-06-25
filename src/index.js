import express from 'express';
import { Bot } from '@maxhub/max-bot-api';
import config from './config.js';
import { registerCommands } from './bot/commands.js';
import { registerHandlers } from './bot/handlers.js';

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

app.get('/debug-chats', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${config.api.secretKey}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const url = new URL('https://botapi.max.ru/chats');
    const apiRes = await fetch(url, { headers: { 'Authorization': config.bot.token } });
    return res.json(await apiRes.json());
});

app.get('/channel-info', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${config.api.secretKey}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const inviteLink = req.query.link;
    if (!inviteLink) {
        return res.status(400).json({ error: 'Missing link parameter' });
    }
    try {
        const fullLink = inviteLink.startsWith('http') ? inviteLink : `https://max.ru/join/${inviteLink.split('/').pop()}`;
        let marker = null;
        let chat = null;

        do {
            const url = new URL('https://botapi.max.ru/chats');
            url.searchParams.set('count', '100');
            if (marker) url.searchParams.set('marker', marker);
            const apiRes = await fetch(url, { headers: { 'Authorization': config.bot.token } });
            const data = await apiRes.json();
            console.log(`[API] chats page: ${data.chats?.length}, marker: ${data.marker}, looking for: ${fullLink}`);
            data.chats?.forEach(c => console.log(`  link: ${c.link}`));
            chat = (data.chats || []).find(c => c.link === fullLink);
            marker = data.marker || null;
        } while (!chat && marker);

        if (!chat) {
            return res.status(404).json({ error: 'Channel not found. Make sure the bot is a member.' });
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
