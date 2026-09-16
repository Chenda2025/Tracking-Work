import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import { dispatchTelegramForUser } from "@/lib/telegramDispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await dispatchTelegramForUser(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "dispatch_failed" }, { status: 500 });
  }
}
