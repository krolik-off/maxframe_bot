import db from './db.js';
import MaxframeApi from './maxframeApi.js';

// Отправка событий bot_added/bot_removed по каналам в MaxFrame.
// Источник — таблица bot_events: всё, что ещё не отправлено (synced_at IS NULL), досылается пачками.

const BATCH_SIZE = 1000;
const RETRY_INTERVAL = 60 * 1000;

const maxframeApi = new MaxframeApi();

const selectPending = db.prepare(`
    SELECT id, event_type, chat_id, timestamp FROM bot_events
    WHERE synced_at IS NULL
      AND is_channel = 1
      AND chat_id IS NOT NULL
      AND event_type IN ('bot_added', 'bot_removed')
    ORDER BY id
    LIMIT ${BATCH_SIZE}
`);

const markSynced = db.prepare(`UPDATE bot_events SET synced_at = ? WHERE id = ?`);
const markSyncedMany = db.transaction((ids, at) => {
    for (const id of ids) markSynced.run(at, id);
});

let running = false;
let rerun = false;

/**
 * Отправить все неотправленные события. Безопасно вызывать часто: параллельные вызовы схлопываются.
 */
export async function syncMembership() {
    if (running) {
        rerun = true;
        return;
    }
    running = true;
    try {
        do {
            rerun = false;
            let rows;
            while ((rows = selectPending.all()).length > 0) {
                const events = rows.map(r => ({
                    max_channel_id: r.chat_id,
                    bot_in_channel: r.event_type === 'bot_added',
                    event_time: Date.parse(r.timestamp)
                }));
                const ok = await maxframeApi.sendChannelMembership(events);
                if (!ok) return; // повторим по таймеру
                markSyncedMany(rows.map(r => r.id), new Date().toISOString());
                console.log(`[MembershipSync] Sent ${rows.length} event(s)`);
                if (rows.length < BATCH_SIZE) break;
            }
        } while (rerun);
    } catch (e) {
        console.error('[MembershipSync] Sync error:', e.message);
    } finally {
        running = false;
    }
}

export function startMembershipSync() {
    syncMembership();
    setInterval(syncMembership, RETRY_INTERVAL).unref();
}
