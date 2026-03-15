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
    const url = `https://botapi.max.ru/subscriptions?access_token=${config.bot.token}`;
    const webhookUrl = `https://89.23.101.188/webhook`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
    });

    const data = await res.json();
    console.log('[Bot] Webhook registered:', JSON.stringify(data));
}

const app = express();
app.use(express.json());

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
