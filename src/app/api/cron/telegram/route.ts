import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchTelegramForAllUsers } from "@/lib/telegramDispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronSecret() {
  return process.env.CRON_SECRET || process.env.SESSION_SECRET || "";
}

function authorized(request: Request) {
  const secret = cronSecret();
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : new URL(request.url).searchParams.get("secret") ?? "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await dispatchTelegramForAllUsers();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "dispatch_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
