import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { ensureSchema, getPool } from "./db";

const scrypt = promisify(scryptCb);
const COOKIE = "theara_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  photo?: string;
};

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short");
  }
  return secret;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function signToken(userId: string) {
  const payload = `${userId}.${Math.floor(Date.now() / 1000)}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function readToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, issued, sig] = parts;
  if (!userId || !issued || !sig) return null;
  const payload = `${userId}.${issued}`;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const age = Math.floor(Date.now() / 1000) - Number(issued);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_SEC) return null;
  return userId;
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, signToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  await ensureSchema();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const userId = readToken(token);
  if (!userId) return null;
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    username: string;
    photo: string | null;
  }>("SELECT id, name, username, photo FROM users WHERE id = $1", [userId]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    ...(row.photo ? { photo: row.photo } : {}),
  };
}

export function publicProfile(user: SessionUser) {
  return {
    name: user.name,
    username: user.username,
    password: "",
    ...(user.photo ? { photo: user.photo } : {}),
  };
}
