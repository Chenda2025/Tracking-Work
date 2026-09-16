import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import { ensureTelegramRuntime } from "@/lib/telegramInbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await ensureTelegramRuntime();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "inbox_failed" }, { status: 500 });
  }
}
