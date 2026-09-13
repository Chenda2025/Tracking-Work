import type { UserProfile } from "./types";

export type AuthPayload = {
  profile: UserProfile;
  workspace: Record<string, unknown>;
};

const AUTH_ERRORS: Record<string, string> = {
  missing_name: "Enter name",
  missing_username: "Enter username",
  missing_password: "Enter password",
  account_exists: "Account already exists",
  invalid_credentials: "Username or password is wrong",
  username_taken: "Username already taken",
  missing_database_url: "Server missing DATABASE_URL",
  missing_session_secret: "Server missing SESSION_SECRET",
  database_unreachable: "Cannot connect to database",
  database_auth_failed: "Database login failed",
  signup_failed: "Could not create account",
  login_failed: "Could not sign in",
  profile_failed: "Could not update profile",
};

export function authErrorMessage(code?: string) {
  if (!code) return "Something went wrong";
  return AUTH_ERRORS[code] ?? code;
}

async function readError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return authErrorMessage(data.error);
  } catch {
    return authErrorMessage("login_failed");
  }
}

export async function apiSignup(input: {
  name: string;
  username: string;
  password: string;
}): Promise<AuthPayload | string> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return readError(res);
  return (await res.json()) as AuthPayload;
}

export async function apiLogin(username: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return readError(res);
  return (await res.json()) as AuthPayload;
}

export async function apiLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function apiMe() {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as AuthPayload & { signedIn: boolean };
}

export async function apiSaveWorkspace(workspace: unknown) {
  await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workspace),
  });
}

export async function apiPatchProfile(patch: Partial<UserProfile>) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return readError(res);
  return (await res.json()) as { profile: UserProfile };
}
