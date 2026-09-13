import { NextResponse } from "next/server";
import {
  getSessionUser,
  hashPassword,
  publicProfile,
} from "@/lib/auth-server";
import { ensureSchema, getPool } from "@/lib/db";

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      username?: string;
      password?: string;
      photo?: string | null;
    };
    await ensureSchema();
    const name = (body.name ?? user.name).trim();
    if (!name) {
      return NextResponse.json({ error: "missing_name" }, { status: 400 });
    }
    const username = (body.username ?? user.username).trim();
    if (!username) {
      return NextResponse.json({ error: "missing_username" }, { status: 400 });
    }

    const clash = await getPool().query(
      "SELECT id FROM users WHERE lower(username) = lower($1) AND id <> $2",
      [username, user.id]
    );
    if (clash.rowCount) {
      return NextResponse.json(
        { error: "username_taken" },
        { status: 409 }
      );
    }

    const photo =
      body.photo === undefined ? user.photo ?? null : body.photo || null;

    if (typeof body.password === "string" && body.password.trim()) {
      await getPool().query(
        `UPDATE users
         SET name = $1, username = $2, photo = $3, password_hash = $4, updated_at = now()
         WHERE id = $5`,
        [name, username, photo, await hashPassword(body.password), user.id]
      );
    } else {
      await getPool().query(
        `UPDATE users
         SET name = $1, username = $2, photo = $3, updated_at = now()
         WHERE id = $4`,
        [name, username, photo, user.id]
      );
    }

    return NextResponse.json({
      profile: publicProfile({
        id: user.id,
        name,
        username,
        ...(photo ? { photo } : {}),
      }),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "profile_failed" }, { status: 500 });
  }
}
