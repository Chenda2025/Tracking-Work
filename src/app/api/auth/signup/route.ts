import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  hashPassword,
  publicProfile,
  setSessionCookie,
} from "@/lib/auth-server";
import { ensureSchema, getPool } from "@/lib/db";
import { loadWorkspace } from "@/lib/workspace-db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      username?: string;
      password?: string;
    };
    const name = body.name?.trim() ?? "";
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    if (!name) {
      return NextResponse.json({ error: "missing_name" }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: "missing_username" }, { status: 400 });
    }
    if (!password.trim()) {
      return NextResponse.json({ error: "missing_password" }, { status: 400 });
    }

    await ensureSchema();
    const existing = await getPool().query(
      "SELECT id FROM users WHERE lower(username) = lower($1)",
      [username]
    );
    if (existing.rowCount) {
      return NextResponse.json({ error: "account_exists" }, { status: 409 });
    }

    const id = randomUUID();
    await getPool().query(
      `INSERT INTO users (id, name, username, password_hash)
       VALUES ($1,$2,$3,$4)`,
      [id, name, username, await hashPassword(password)]
    );
    await setSessionCookie(id);
    const user = { id, name, username };
    return NextResponse.json({
      profile: publicProfile(user),
      workspace: await loadWorkspace(id),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "signup_failed" }, { status: 500 });
  }
}
