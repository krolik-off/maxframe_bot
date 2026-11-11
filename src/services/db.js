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

    CREATE TABLE IF NOT EXISTS channels (
        chat_id INTEGER PRIMARY KEY,
        title TEXT,
        link TEXT,
        type TEXT,
        is_public INTEGER DEFAULT 0,
        participants_count INTEGER,
        updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_channels_link ON channels(link);

    CREATE TABLE IF NOT EXISTS bot_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        chat_id INTEGER,
        user_id INTEGER,
        user_name TEXT,
        is_channel INTEGER,
        timestamp TEXT NOT NULL,
        synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_bot_events_type ON bot_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_bot_events_user ON bot_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_bot_events_timestamp ON bot_events(timestamp);
`);

// Миграция: synced_at для таблиц bot_events, созданных до появления синхронизации с MaxFrame
const botEventsColumns = db.prepare('PRAGMA table_info(bot_events)').all().map(c => c.name);
if (!botEventsColumns.includes('synced_at')) {
    db.exec('ALTER TABLE bot_events ADD COLUMN synced_at TEXT');
}

export default db;