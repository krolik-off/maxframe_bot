import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');
const STATS_FILE = resolve(DATA_DIR, 'stats.json');

const upsertUser = db.prepare(`
    INSERT INTO users (id, name, first_seen, last_seen, total_starts, total_requests)
    VALUES (?, ?, ?, ?, 0, 0)
    ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen
`);

const incrementStarts = db.prepare(`UPDATE users SET total_starts = total_starts + 1 WHERE id = ?`);
const incrementRequests = db.prepare(`UPDATE users SET total_requests = total_requests + 1 WHERE id = ?`);

const insertRequest = db.prepare(`
    INSERT INTO requests (user_id, channel_id, channel_name, timestamp, response_time_ms, success)
    VALUES (?, ?, ?, ?, ?, ?)
`);

class Stats {
    constructor() {
        this.data = this._load();
    }

    _load() {
        try {
            if (existsSync(STATS_FILE)) {
                return JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
            }
        } catch (e) {
            console.error('[Stats] Failed to load stats:', e.message);
        }
        return {
            users: {},
            totalRequests: 0,
            totalStarts: 0,
            totalNotFound: 0,
            totalRateLimited: 0,
            daily: {}
        };
    }

    _save() {
        try {
            if (!existsSync(DATA_DIR)) {
                mkdirSync(DATA_DIR, { recursive: true });
            }
            writeFileSync(STATS_FILE, JSON.stringify(this.data, null, 2));
        } catch (e) {
            console.error('[Stats] Failed to save stats:', e.message);
        }
    }

    _today() {
        return new Date().toISOString().slice(0, 10);
    }

    _getDay() {
        const today = this._today();
        if (!this.data.daily[today]) {
            this.data.daily[today] = { requests: 0, starts: 0, notFound: 0 };
        }
        return this.data.daily[today];
    }

    trackStart(userId, name) {
        this.data.totalStarts++;
        this._getDay().starts++;
        if (!this.data.users[userId]) {
            this.data.users[userId] = { firstSeen: this._today(), name: name || null };
        }
        this._save();

        if (userId) {
            try {
                upsertUser.run(userId, name || null, this._today(), new Date().toISOString());
                incrementStarts.run(userId);
            } catch (e) {
                console.error('[Stats] DB error trackStart:', e.message);
            }
        }
    }

    trackRequest(userId, channelId, channelName, responseTimeMs, success = 1) {
        this.data.totalRequests++;
        this._getDay().requests++;
        if (!this.data.users[userId]) {
            this.data.users[userId] = { firstSeen: this._today(), name: null };
        }
        this._save();

        if (userId) {
            try {
                upsertUser.run(userId, null, this._today(), new Date().toISOString());
                incrementRequests.run(userId);
                insertRequest.run(
                    userId,
                    channelId ? String(channelId) : null,
                    channelName || null,
                    new Date().toISOString(),
                    responseTimeMs || null,
                    success
                );
            } catch (e) {
                console.error('[Stats] DB error trackRequest:', e.message);
            }
        }
    }

    trackNotFound() {
        this.data.totalNotFound++;
        this._getDay().notFound = (this._getDay().notFound || 0) + 1;
        this._save();
    }

    trackRateLimit() {
        this.data.totalRateLimited++;
        this._save();
    }
}

export default new Stats();