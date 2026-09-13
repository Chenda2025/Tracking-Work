import { NextResponse } from "next/server";
import {
  publicProfile,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth-server";
import { ensureSchema, getPool } from "@/lib/db";
import { loadWorkspace } from "@/lib/workspace-db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    if (!username) {
      return NextResponse.json({ error: "missing_username" }, { status: 400 });
    }
    if (!password.trim()) {
      return NextResponse.json({ error: "missing_password" }, { status: 400 });
    }

    await ensureSchema();
    const { rows } = await getPool().query<{
      id: string;
      name: string;
      username: string;
      password_hash: string;
      photo: string | null;
    }>(
      `SELECT id, name, username, password_hash, photo
       FROM users WHERE lower(username) = lower($1)`,
      [username]
    );
    const row = rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    await setSessionCookie(row.id);
    const user = {
      id: row.id,
      name: row.name,
      username: row.username,
      ...(row.photo ? { photo: row.photo } : {}),
    };
    return NextResponse.json({
      profile: publicProfile(user),
      workspace: await loadWorkspace(row.id),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "login_failed" }, { status: 500 });
  }
}
