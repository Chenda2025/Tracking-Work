import { Pool, type PoolClient } from "pg";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower
  ON users (lower(username));

CREATE TABLE IF NOT EXISTS activity_folders (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT,
  color TEXT,
  priority TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  notes TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  folder_id TEXT,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  repeat_days JSONB NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS finance_categories (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (user_id, kind, id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_amount DOUBLE PRECISION NOT NULL,
  current_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_khr DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  start_date TEXT NOT NULL,
  target_date TEXT NOT NULL,
  members JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL,
  date TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT,
  notes TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  all_day BOOLEAN NOT NULL DEFAULT false,
  folder_id TEXT,
  repeat_days JSONB,
  travel_time TEXT NOT NULL DEFAULT 'none',
  repeat_frequency TEXT NOT NULL DEFAULT 'never',
  end_repeat JSONB NOT NULL DEFAULT '{"type":"never"}',
  alert TEXT NOT NULL DEFAULT 'none',
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL,
  due_time TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  repeat_days JSONB,
  alert TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS telegram_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bot_token TEXT NOT NULL DEFAULT '',
  chat_id TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  send_time TEXT NOT NULL DEFAULT '07:00',
  evening_time TEXT NOT NULL DEFAULT '18:00',
  last_auto_sent_date TEXT,
  last_evening_sent_date TEXT,
  auto_sent_event_date TEXT,
  auto_sent_event_ids JSONB NOT NULL DEFAULT '[]'
);
`;

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
    });
  }
  return pool;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
