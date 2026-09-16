import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/telegramBot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update || typeof update.update_id !== "number") {
    return NextResponse.json({ error: "invalid_update" }, { status: 400 });
  }
  await ensureSchema();
  const chatId = String(
    update.callback_query?.message?.chat.id ??
      update.callback_query?.from?.id ??
      ""
  );
  if (!chatId) return NextResponse.json({ ok: true });

  const row = await getPool().query<{ bot_token: string }>(
    `SELECT bot_token FROM telegram_settings
     WHERE enabled = true AND btrim(chat_id) = $1 AND btrim(bot_token) <> ''
     LIMIT 1`,
    [chatId]
  );
  const token = row.rows[0]?.bot_token?.trim();
  if (!token) return NextResponse.json({ ok: true });
  await handleTelegramUpdate(token, update);
  return NextResponse.json({ ok: true });
}
