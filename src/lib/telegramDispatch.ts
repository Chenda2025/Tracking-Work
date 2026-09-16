import { ensureSchema, getPool } from "./db";
import {
  buildEventReport,
  buildMorningDigest,
  buildReminderReport,
  canAutoSendSlot,
  digestNoticeKey,
  dueTelegramItems,
  sendTelegramMessage,
  sentEventIdsForToday,
  singleDoneKeyboard,
  telegramClock,
  todayWorkItems,
  workDoneKeyboard,
  type TelegramReplyMarkup,
} from "./telegramDaily";
import { startTelegramInbox } from "./telegramInbox";
import { loadWorkspace } from "./workspace-db";

const TICK_MS = 20_000;
const START_DELAY_MS = 8_000;

type DispatchResult = { sent: number; skipped: number; errors: number };

function emptyResult(): DispatchResult {
  return { sent: 0, skipped: 0, errors: 0 };
}

async function claimNotice(userId: string, key: string): Promise<boolean> {
  const result = await getPool().query(
    `INSERT INTO telegram_notice_log (user_id, notice_key)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING notice_key`,
    [userId, key]
  );
  return (result.rowCount ?? 0) > 0;
}

async function releaseNotice(userId: string, key: string) {
  await getPool().query(
    `DELETE FROM telegram_notice_log WHERE user_id = $1 AND notice_key = $2`,
    [userId, key]
  );
}

async function markDigestSent(
  userId: string,
  slot: "morning" | "evening",
  iso: string
) {
  const column =
    slot === "morning" ? "last_auto_sent_date" : "last_evening_sent_date";
  await getPool().query(
    `UPDATE telegram_settings SET ${column} = $2 WHERE user_id = $1`,
    [userId, iso]
  );
}

async function ensureNoticeLog() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS telegram_notice_log (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notice_key TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, notice_key)
    )
  `);
}

async function cleanupOldNotices() {
  await getPool().query(
    `DELETE FROM telegram_notice_log WHERE sent_at < now() - interval '21 days'`
  );
}

async function listEnabledTelegramUserIds(): Promise<string[]> {
  const result = await getPool().query<{ user_id: string }>(
    `SELECT user_id
     FROM telegram_settings
     WHERE enabled = true
       AND btrim(bot_token) <> ''
       AND btrim(chat_id) <> ''`
  );
  return result.rows.map((row) => row.user_id);
}

export async function dispatchTelegramForUser(
  userId: string
): Promise<DispatchResult> {
  await ensureSchema();
  await ensureNoticeLog();
  await startTelegramInbox().catch(() => undefined);
  const result = emptyResult();
  const workspace = await loadWorkspace(userId);
  const settings = workspace.telegramSettings;
  if (!settings.enabled) return result;
  const token = settings.botToken.trim();
  const chatId = settings.chatId.trim();
  if (!token || !chatId) return result;

  const user = await getPool().query<{ name: string }>(
    `SELECT name FROM users WHERE id = $1`,
    [userId]
  );
  const ownerName = user.rows[0]?.name;
  const clock = telegramClock();

  for (const id of sentEventIdsForToday(settings)) {
    await claimNotice(userId, id);
    if (!id.includes(":")) {
      await claimNotice(userId, `event:${id}:${clock.iso}:start`);
    }
  }

  async function send(
    key: string,
    text: string,
    replyMarkup?: TelegramReplyMarkup
  ) {
    const claimed = await claimNotice(userId, key);
    if (!claimed) {
      result.skipped += 1;
      return;
    }
    try {
      await sendTelegramMessage({ botToken: token, chatId, text, replyMarkup });
      result.sent += 1;
    } catch (error) {
      result.errors += 1;
      await releaseNotice(userId, key);
      throw error;
    }
  }

  for (const slot of ["morning", "evening"] as const) {
    if (!canAutoSendSlot(settings, slot)) continue;
    try {
      await send(
        digestNoticeKey(slot, clock.iso),
        buildMorningDigest({
          events: workspace.events,
          reminders: workspace.reminders,
          activities: workspace.activities,
          period: slot,
          ownerName,
        }),
        workDoneKeyboard(todayWorkItems(workspace))
      );
      await markDigestSent(userId, slot, clock.iso);
      if (slot === "morning") settings.lastAutoSentDate = clock.iso;
      else settings.lastEveningSentDate = clock.iso;
    } catch (error) {
      console.error("[telegram-dispatch] digest", slot, userId, error);
    }
  }

  const due = dueTelegramItems(workspace.events, workspace.reminders, [], clock);
  for (const item of due) {
    try {
      if (item.kind === "event" && item.event) {
        await send(
          item.key,
          buildEventReport(item.event, ownerName, item.slot),
          singleDoneKeyboard("e", item.event.id)
        );
      } else if (item.kind === "reminder" && item.reminder) {
        await send(
          item.key,
          buildReminderReport(item.reminder, ownerName, item.slot),
          singleDoneKeyboard("r", item.reminder.id)
        );
      }
    } catch (error) {
      console.error("[telegram-dispatch] notice", item.key, userId, error);
    }
  }

  return result;
}

let allInFlight: Promise<DispatchResult> | null = null;

export async function dispatchTelegramForAllUsers(): Promise<DispatchResult> {
  if (allInFlight) return allInFlight;
  allInFlight = (async () => {
    await ensureSchema();
    await ensureNoticeLog();
    const ids = await listEnabledTelegramUserIds();
    const total = emptyResult();
    for (const userId of ids) {
      try {
        const next = await dispatchTelegramForUser(userId);
        total.sent += next.sent;
        total.skipped += next.skipped;
        total.errors += next.errors;
      } catch (error) {
        total.errors += 1;
        console.error("[telegram-dispatch] user", userId, error);
      }
    }
    if (Math.random() < 0.05) {
      await cleanupOldNotices().catch(() => undefined);
    }
    return total;
  })().finally(() => {
    allInFlight = null;
  });
  return allInFlight;
}

const globalStart = globalThis as typeof globalThis & {
  __thearaTelegramDispatch?: boolean;
};

export function startTelegramDispatcher() {
  if (globalStart.__thearaTelegramDispatch) return;
  if (!process.env.DATABASE_URL) return;
  globalStart.__thearaTelegramDispatch = true;

  const tick = () => {
    void startTelegramInbox().catch((error) => {
      console.error("[telegram-inbox]", error);
    });
    void dispatchTelegramForAllUsers().catch((error) => {
      console.error("[telegram-dispatch]", error);
    });
  };

  setTimeout(tick, START_DELAY_MS);
  setInterval(tick, TICK_MS);
}
