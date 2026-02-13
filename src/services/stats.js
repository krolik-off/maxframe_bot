import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');
const STATS_FILE = resolve(DATA_DIR, 'stats.json');

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
    }

    trackRequest(userId) {
        this.data.totalRequests++;
        this._getDay().requests++;
        if (!this.data.users[userId]) {
            this.data.users[userId] = { firstSeen: this._today(), name: null };
        }
        this._save();
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
