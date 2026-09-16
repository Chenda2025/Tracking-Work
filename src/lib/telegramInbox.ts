import { ensureSchema, getPool } from "./db";
import {
  drainTelegramCallbacks,
  ensureTelegramInboxTables,
  telegramApi,
} from "./telegramBot";
import {
  buildTodayWorkList,
  sendTelegramMessage,
  todayWorkItems,
  workDoneKeyboard,
} from "./telegramDaily";
import { loadWorkspace } from "./workspace-db";

type InboxState = {
  active: Set<string>;
  beat: Record<string, number>;
  timer?: ReturnType<typeof setInterval>;
  clearedWebhook?: Set<string>;
};

const g = globalThis as typeof globalThis & {
  __thearaTelegramInbox?: InboxState;
};

function inboxState(): InboxState {
  if (!g.__thearaTelegramInbox) {
    g.__thearaTelegramInbox = {
      active: new Set(),
      beat: {},
      clearedWebhook: new Set(),
    };
  }
  if (!g.__thearaTelegramInbox.clearedWebhook) {
    g.__thearaTelegramInbox.clearedWebhook = new Set();
  }
  return g.__thearaTelegramInbox;
}

function stopLegacyPollers() {
  const state = inboxState();
  state.active.clear();
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = undefined;
  }
}

async function uniqueBotTokens(): Promise<string[]> {
  const result = await getPool().query<{ bot_token: string }>(
    `SELECT DISTINCT btrim(bot_token) AS bot_token
     FROM telegram_settings
     WHERE btrim(bot_token) <> '' AND btrim(chat_id) <> ''`
  );
  return result.rows.map((row) => row.bot_token).filter(Boolean);
}

async function clearWebhookOnce(token: string) {
  const state = inboxState();
  if (state.clearedWebhook?.has(token)) return;
  await telegramApi(token, "deleteWebhook", {
    drop_pending_updates: false,
  }).catch(() => undefined);
  state.clearedWebhook?.add(token);
}

export async function ensureTelegramRuntime() {
  stopLegacyPollers();
  if (!process.env.DATABASE_URL) return { polling: 0, processed: 0 };
  await ensureTelegramInboxTables();
  const tokens = await uniqueBotTokens();
  let processed = 0;
  for (const token of tokens) {
    await clearWebhookOnce(token);
    processed += await drainTelegramCallbacks(token);
  }
  return { polling: tokens.length, processed };
}

export async function startTelegramInbox() {
  return ensureTelegramRuntime();
}

export async function sendTodayWorkList(userId: string) {
  await ensureSchema();
  await ensureTelegramRuntime();
  const workspace = await loadWorkspace(userId);
  const settings = workspace.telegramSettings;
  const token = settings.botToken.trim();
  const chatId = settings.chatId.trim();
  if (!token || !chatId) {
    throw new Error("telegram_not_configured");
  }
  const user = await getPool().query<{ name: string }>(
    `SELECT name FROM users WHERE id = $1`,
    [userId]
  );
  const items = todayWorkItems(workspace);
  await sendTelegramMessage({
    botToken: token,
    chatId,
    text: buildTodayWorkList({
      events: workspace.events,
      reminders: workspace.reminders,
      activities: workspace.activities,
      ownerName: user.rows[0]?.name,
    }),
    replyMarkup: workDoneKeyboard(items),
  });
  return { sent: true, count: items.length };
}
