import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import { sendTodayWorkList } from "@/lib/telegramInbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendTodayWorkList(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    if (message === "telegram_not_configured") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
