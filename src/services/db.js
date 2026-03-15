import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');
const DB_PATH = resolve(DATA_DIR, 'bot.db');

if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        total_starts INTEGER DEFAULT 0,
        total_requests INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        channel_id TEXT,
        channel_name TEXT,
        timestamp TEXT NOT NULL,
        response_time_ms INTEGER,
        success INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_requests_user ON requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_requests_channel ON requests(channel_id);
    CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
`);

export default db;