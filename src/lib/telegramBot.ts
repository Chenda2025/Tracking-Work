import { createHash } from "node:crypto";
import { ensureSchema, getPool } from "./db";
import {
  parseTelegramDoneData,
  type TelegramReplyMarkup,
  type TelegramWorkKind,
} from "./telegramDaily";

type TelegramApiResult<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: { id: number };
  message?: {
    message_id: number;
    chat: { id: number | string };
    text?: string;
    reply_markup?: TelegramReplyMarkup;
  };
};

export type TelegramUpdate = {
  update_id: number;
  callback_query?: TelegramCallbackQuery;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function telegramApi<T>(
  token: string,
  method: string,
  body: Record<string, unknown> = {},
  timeoutMs = 20_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token.trim()}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
    const data = (await res.json().catch(() => null)) as TelegramApiResult<T> | null;
    if (!res.ok || !data?.ok) {
      throw new Error(data?.description || `telegram ${method} failed`);
    }
    return (data.result ?? true) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureTelegramInboxTables() {
  await ensureSchema();
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS telegram_bot_cursors (
      token_hash TEXT PRIMARY KEY,
      last_update_id BIGINT NOT NULL DEFAULT 0,
      locked_at TIMESTAMPTZ
    )
  `);
  await db.query(
    `ALTER TABLE telegram_bot_cursors ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`
  );
  await db.query(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS completed_at TEXT`);
}

export async function loadBotCursor(token: string): Promise<number> {
  const result = await getPool().query<{ last_update_id: string | number }>(
    `SELECT last_update_id FROM telegram_bot_cursors WHERE token_hash = $1`,
    [tokenHash(token)]
  );
  return Number(result.rows[0]?.last_update_id || 0);
}

export async function saveBotCursor(token: string, lastUpdateId: number) {
  await getPool().query(
    `INSERT INTO telegram_bot_cursors (token_hash, last_update_id)
     VALUES ($1, $2)
     ON CONFLICT (token_hash) DO UPDATE SET last_update_id = EXCLUDED.last_update_id`,
    [tokenHash(token), lastUpdateId]
  );
}

function normalizeChatId(value: string | number | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/^[@+]+/, "")
    .replace(/\s+/g, "");
}

function sameChatId(
  stored: string | number | null | undefined,
  incoming: string | number | null | undefined
) {
  const left = normalizeChatId(stored);
  const right = normalizeChatId(incoming);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftNum = Number(left);
  const rightNum = Number(right);
  return Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum === rightNum;
}

async function findUserForChat(
  token: string,
  chatId: string,
  fromId?: number
) {
  const db = getPool();
  const result = await db.query<{ user_id: string; chat_id: string }>(
    `SELECT user_id, chat_id
     FROM telegram_settings
     WHERE btrim(bot_token) = $1
       AND btrim(bot_token) <> ''`,
    [token.trim()]
  );
  const exact = result.rows.find((row) => sameChatId(row.chat_id, chatId));
  if (exact) return exact.user_id;
  if (fromId != null) {
    const fromMatch = result.rows.find((row) => sameChatId(row.chat_id, fromId));
    if (fromMatch) return fromMatch.user_id;
  }
  if (result.rows.length === 1) return result.rows[0].user_id;
  console.warn(
    "[telegram-inbox] no chat match",
    chatId,
    fromId ?? "",
    "rows",
    result.rows.length
  );
  return null;
}

async function markWorkDone(
  userId: string,
  kind: TelegramWorkKind,
  id: string
): Promise<{ ok: boolean; title: string }> {
  const stamp = new Date().toISOString();
  if (kind === "e") {
    const result = await getPool().query<{ title: string }>(
      `UPDATE calendar_events
       SET completed = true, completed_at = $3
       WHERE user_id = $1 AND id = $2
       RETURNING title`,
      [userId, id, stamp]
    );
    const title = result.rows[0]?.title;
    return { ok: Boolean(title), title: title ?? "" };
  }
  if (kind === "r") {
    const result = await getPool().query<{ title: string }>(
      `UPDATE reminders
       SET completed = true, completed_at = $3
       WHERE user_id = $1 AND id = $2
       RETURNING title`,
      [userId, id, stamp]
    );
    const title = result.rows[0]?.title;
    return { ok: Boolean(title), title: title ?? "" };
  }
  const result = await getPool().query<{ title: string }>(
    `UPDATE activities
     SET status = 'done'
     WHERE user_id = $1 AND id = $2
     RETURNING title`,
    [userId, id]
  );
  const title = result.rows[0]?.title;
  return { ok: Boolean(title), title: title ?? "" };
}

function remainingKeyboard(
  markup: TelegramReplyMarkup | undefined,
  data: string
): TelegramReplyMarkup {
  const rows = (markup?.inline_keyboard ?? []).filter(
    (row) => !row.some((button) => button.callback_data === data)
  );
  return { inline_keyboard: rows };
}

export async function drainTelegramCallbacks(token: string): Promise<number> {
  const hash = tokenHash(token);
  const claimed = await getPool().query<{ last_update_id: string | number }>(
    `INSERT INTO telegram_bot_cursors (token_hash, last_update_id, locked_at)
     VALUES ($1, 0, now())
     ON CONFLICT (token_hash) DO UPDATE
       SET locked_at = now()
     WHERE telegram_bot_cursors.locked_at IS NULL
        OR telegram_bot_cursors.locked_at < now() - interval '20 seconds'
     RETURNING last_update_id`,
    [hash]
  );
  if (!claimed.rows[0]) return 0;

  let lastId = Number(claimed.rows[0].last_update_id || 0);
  let processed = 0;
  try {
    const updates = await telegramApi<TelegramUpdate[]>(
      token,
      "getUpdates",
      {
        offset: lastId + 1,
        timeout: 0,
        allowed_updates: ["callback_query"],
      },
      12_000
    );
    for (const update of updates) {
      lastId = Math.max(lastId, update.update_id);
      if (update.callback_query) {
        console.info("[telegram-inbox] callback", update.callback_query.data);
        await handleTelegramUpdate(token, update);
        processed += 1;
      }
    }
    return processed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/conflict/i.test(message)) {
      console.warn("[telegram-inbox] getUpdates busy, retry next tick");
    } else {
      console.error("[telegram-inbox] drain", message);
    }
    return processed;
  } finally {
    await getPool().query(
      `UPDATE telegram_bot_cursors
       SET last_update_id = GREATEST(last_update_id, $2), locked_at = NULL
       WHERE token_hash = $1`,
      [hash, lastId]
    );
  }
}

export async function handleTelegramUpdate(token: string, update: TelegramUpdate) {
  const query = update.callback_query;
  if (!query?.data) return;
  const parsed = parseTelegramDoneData(query.data);
  const chatId = String(query.message?.chat.id ?? query.from?.id ?? "");
  try {
    if (!parsed) {
      await telegramApi(token, "answerCallbackQuery", {
        callback_query_id: query.id,
        text: "មិនស្គាល់ពាក្យបញ្ជា",
        show_alert: false,
      });
      return;
    }
    const userId = await findUserForChat(token, chatId, query.from?.id);
    if (!userId) {
      await telegramApi(token, "answerCallbackQuery", {
        callback_query_id: query.id,
        text: "រកមិនឃើញគណនី",
        show_alert: true,
      });
      return;
    }
    const marked = await markWorkDone(userId, parsed.kind, parsed.id);
    console.info(
      "[telegram-inbox] marked",
      parsed.kind,
      parsed.id,
      marked.ok ? marked.title : "missing"
    );
    await telegramApi(token, "answerCallbackQuery", {
      callback_query_id: query.id,
      text: marked.ok ? `រួចរាល់ · ${marked.title}` : "រកមិនឃើញការងារ",
      show_alert: !marked.ok,
    });
    if (!marked.ok) return;
    const message = query.message;
    if (!message) return;
    const nextMarkup = remainingKeyboard(message.reply_markup, query.data);
    const nextText = message.text?.includes("✅ រួចរាល់")
      ? message.text
      : `${message.text ?? ""}\n✅ រួចរាល់ · ${marked.title}`.trim();
    await telegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: message.message_id,
      text: nextText.slice(0, 4096),
      disable_web_page_preview: true,
      reply_markup: nextMarkup,
    }).catch(async () => {
      await telegramApi(token, "editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: message.message_id,
        reply_markup: nextMarkup,
      }).catch(() => undefined);
    });
  } catch (error) {
    console.error("[telegram-inbox] callback", error);
    await telegramApi(token, "answerCallbackQuery", {
      callback_query_id: query.id,
      text: "មិនអាចសម្គាល់រួច",
      show_alert: true,
    }).catch(() => undefined);
  }
}
