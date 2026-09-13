# Theara personal tracking

Khmer personal tracking for activities, money, and family goals.

Data is stored in **PostgreSQL**, not browser localStorage.

## Database (pgAdmin)

Use the Homebrew server, not EnterpriseDB port 5432:

- Host: `127.0.0.1`
- Port: `5433`
- Username: `admin123`
- Password: empty
- Database: `activity`

Tables: `users`, `activity_folders`, `activities`, `finance_categories`, `transactions`, `goals`, `goal_contributions`, `calendar_events`, `reminders`, `telegram_settings`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

Copy `.env.example` to `.env.local` if needed:

```
DATABASE_URL=postgresql://admin123@127.0.0.1:5433/activity
SESSION_SECRET=change-this-to-a-long-random-string
GEMINI_API_KEY=your-gemini-api-key
```

## Production (Docker)

Set these environment variables on the host (Coolify / VPS):

- `DATABASE_URL` — Postgres URL reachable from the container (not `127.0.0.1` unless Postgres shares the same Docker network)
- `SESSION_SECRET` — long random string (16+ characters)
- `GEMINI_API_KEY` — optional, only for translate

Example:

```
DATABASE_URL=postgresql://user:password@postgres:5432/activity
SESSION_SECRET=replace-with-a-long-random-secret
```
