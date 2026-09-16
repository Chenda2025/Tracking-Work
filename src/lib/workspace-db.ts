import type { PoolClient } from "pg";
import type {
  Activity,
  ActivityFolder,
  CalendarEvent,
  FamilyGoal,
  FinanceCategoryOption,
  Reminder,
  TelegramSettings,
  Transaction,
} from "./types";
import { ensureSchema, getPool, withTransaction } from "./db";

export type WorkspacePayload = {
  activities: Activity[];
  transactions: Transaction[];
  goals: FamilyGoal[];
  activityFolders: ActivityFolder[];
  events: CalendarEvent[];
  reminders: Reminder[];
  incomeCategories: FinanceCategoryOption[];
  expenseCategories: FinanceCategoryOption[];
  saveCategories: FinanceCategoryOption[];
  telegramSettings: TelegramSettings;
};

function emptyTelegram(): TelegramSettings {
  return {
    botToken: "",
    chatId: "",
    enabled: false,
    sendTime: "07:00",
    eveningTime: "18:00",
    lastAutoSentDate: "",
    lastEveningSentDate: "",
    autoSentEventDate: "",
    autoSentEventIds: [],
  };
}

function laterDate(a?: string | null, b?: string | null) {
  const x = (a ?? "").trim();
  const y = (b ?? "").trim();
  return x > y ? x : y;
}

function mergeCompletion(
  incomingDone: boolean,
  incomingAt?: string | null,
  existing?: { completed?: boolean; completed_at?: string | null }
) {
  if (!existing) {
    return {
      completed: incomingDone,
      completedAt: incomingAt ?? null,
    };
  }
  const remoteAt = Date.parse(existing.completed_at || "") || 0;
  const localAt = Date.parse(incomingAt || "") || 0;
  if (remoteAt > localAt) {
    return {
      completed: Boolean(existing.completed),
      completedAt: existing.completed_at ?? null,
    };
  }
  return {
    completed: incomingDone,
    completedAt: incomingAt ?? existing.completed_at ?? null,
  };
}

function mergeNoticeIds(
  prevDate?: string | null,
  prevIds?: unknown,
  nextDate?: string | null,
  nextIds?: unknown
) {
  const pDate = (prevDate ?? "").trim();
  const nDate = (nextDate ?? "").trim();
  const asIds = (value: unknown) =>
    Array.isArray(value)
      ? value.filter(
          (id): id is string => typeof id === "string" && id.length > 0
        )
      : [];
  const pIds = asIds(prevIds);
  const nIds = asIds(nextIds);
  if (pDate && nDate && pDate === nDate) {
    return { date: nDate, ids: [...new Set([...pIds, ...nIds])] };
  }
  if (nDate > pDate) return { date: nDate, ids: nIds };
  if (pDate > nDate) return { date: pDate, ids: pIds };
  return { date: nDate || pDate, ids: [...new Set([...pIds, ...nIds])] };
}

export function isWorkspaceEmpty(data: WorkspacePayload) {
  return (
    data.activities.length === 0 &&
    data.transactions.length === 0 &&
    data.goals.length === 0 &&
    data.activityFolders.length === 0 &&
    data.events.length === 0 &&
    data.reminders.length === 0
  );
}

export async function loadWorkspace(userId: string): Promise<WorkspacePayload> {
  await ensureSchema();
  const db = getPool();
  const [
    folders,
    activities,
    categories,
    transactions,
    goals,
    contributions,
    events,
    reminders,
    telegram,
  ] = await Promise.all([
    db.query("SELECT * FROM activity_folders WHERE user_id = $1", [userId]),
    db.query("SELECT * FROM activities WHERE user_id = $1", [userId]),
    db.query("SELECT * FROM finance_categories WHERE user_id = $1", [userId]),
    db.query("SELECT * FROM transactions WHERE user_id = $1", [userId]),
    db.query("SELECT * FROM goals WHERE user_id = $1", [userId]),
    db.query("SELECT * FROM goal_contributions WHERE user_id = $1", [userId]),
    db.query("SELECT * FROM calendar_events WHERE user_id = $1", [userId]),
    db.query("SELECT * FROM reminders WHERE user_id = $1", [userId]),
    db.query("SELECT * FROM telegram_settings WHERE user_id = $1", [userId]),
  ]);

  const contribByGoal = new Map<string, FamilyGoal["contributions"]>();
  for (const row of contributions.rows) {
    const list = contribByGoal.get(row.goal_id) ?? [];
    list.push({
      id: row.id,
      amount: Number(row.amount),
      currency: row.currency,
      date: row.date,
    });
    contribByGoal.set(row.goal_id, list);
  }

  const incomeCategories: FinanceCategoryOption[] = [];
  const expenseCategories: FinanceCategoryOption[] = [];
  const saveCategories: FinanceCategoryOption[] = [];
  for (const row of categories.rows) {
    const item = { id: row.id, label: row.label };
    if (row.kind === "income") incomeCategories.push(item);
    else if (row.kind === "save") saveCategories.push(item);
    else expenseCategories.push(item);
  }

  const tg = telegram.rows[0];

  return {
    activityFolders: folders.rows.map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id ?? null,
      ...(row.color ? { color: row.color } : {}),
      ...(row.priority ? { priority: row.priority } : {}),
    })),
    activities: activities.rows.map((row) => ({
      id: row.id,
      title: row.title,
      location: row.location ?? "",
      notes: row.notes ?? "",
      category: row.category,
      folderId: row.folder_id ?? null,
      status: row.status,
      date: row.date,
      startTime: row.start_time ?? "",
      durationMinutes: Number(row.duration_minutes) || 0,
      repeat: row.repeat_days ?? [],
      createdAt: row.created_at,
    })),
    incomeCategories,
    expenseCategories,
    saveCategories,
    transactions: transactions.rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: Number(row.amount),
      currency: row.currency,
      category: row.category,
      note: row.note ?? "",
      date: row.date,
      createdAt: row.created_at,
    })),
    goals: goals.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      targetAmount: Number(row.target_amount),
      currentAmount: Number(row.current_amount),
      currentKhr: Number(row.current_khr),
      currentUsd: Number(row.current_usd),
      currency: row.currency,
      startDate: row.start_date,
      targetDate: row.target_date,
      members: row.members ?? [],
      contributions: contribByGoal.get(row.id) ?? [],
      status: row.status,
      createdAt: row.created_at,
    })),
    events: events.rows.map((row) => ({
      id: row.id,
      title: row.title,
      location: row.location ?? "",
      notes: row.notes ?? "",
      date: row.date,
      endDate: row.end_date,
      startTime: row.start_time ?? "",
      endTime: row.end_time ?? "",
      allDay: Boolean(row.all_day),
      folderId: row.folder_id ?? null,
      repeat: row.repeat_days ?? [],
      travelTime: row.travel_time,
      repeatFrequency: row.repeat_frequency,
      endRepeat: row.end_repeat ?? { type: "never" },
      alert: row.alert,
      completed: Boolean(row.completed),
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
    })),
    reminders: reminders.rows.map((row) => ({
      id: row.id,
      title: row.title,
      notes: row.notes ?? "",
      dueDate: row.due_date,
      dueTime: row.due_time ?? "",
      completed: Boolean(row.completed),
      completedAt: row.completed_at ?? undefined,
      repeat: row.repeat_days ?? [],
      alert: row.alert ?? undefined,
      createdAt: row.created_at,
    })),
    telegramSettings: tg
      ? {
          botToken: tg.bot_token ?? "",
          chatId: tg.chat_id ?? "",
          enabled: Boolean(tg.enabled),
          sendTime: tg.send_time ?? "07:00",
          eveningTime: tg.evening_time ?? "18:00",
          lastAutoSentDate: tg.last_auto_sent_date ?? "",
          lastEveningSentDate: tg.last_evening_sent_date ?? "",
          autoSentEventDate: tg.auto_sent_event_date ?? "",
          autoSentEventIds: tg.auto_sent_event_ids ?? [],
        }
      : emptyTelegram(),
  };
}

async function replaceUserRows(
  client: PoolClient,
  table: string,
  userId: string
) {
  await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
}

export async function saveWorkspace(userId: string, data: WorkspacePayload) {
  await ensureSchema();
  await withTransaction(async (client) => {
    const existingTg = await client.query(
      `SELECT last_auto_sent_date, last_evening_sent_date,
              auto_sent_event_date, auto_sent_event_ids
       FROM telegram_settings WHERE user_id = $1`,
      [userId]
    );
    const existingEvents = await client.query<{
      id: string;
      completed: boolean;
      completed_at: string | null;
    }>(
      `SELECT id, completed, completed_at FROM calendar_events WHERE user_id = $1`,
      [userId]
    );
    const existingReminders = await client.query<{
      id: string;
      completed: boolean;
      completed_at: string | null;
    }>(
      `SELECT id, completed, completed_at FROM reminders WHERE user_id = $1`,
      [userId]
    );
    const existingActivities = await client.query<{
      id: string;
      status: string;
    }>(`SELECT id, status FROM activities WHERE user_id = $1`, [userId]);
    await replaceUserRows(client, "goal_contributions", userId);
    await replaceUserRows(client, "activities", userId);
    await replaceUserRows(client, "activity_folders", userId);
    await replaceUserRows(client, "finance_categories", userId);
    await replaceUserRows(client, "transactions", userId);
    await replaceUserRows(client, "goals", userId);
    await replaceUserRows(client, "calendar_events", userId);
    await replaceUserRows(client, "reminders", userId);
    await replaceUserRows(client, "telegram_settings", userId);

    for (const folder of data.activityFolders ?? []) {
      await client.query(
        `INSERT INTO activity_folders (id, user_id, name, parent_id, color, priority)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          folder.id,
          userId,
          folder.name,
          folder.parentId ?? null,
          folder.color ?? null,
          folder.priority ?? null,
        ]
      );
    }

    for (const item of data.activities ?? []) {
      const prevActivity = existingActivities.rows.find((row) => row.id === item.id);
      const status =
        item.status === "done" || prevActivity?.status === "done"
          ? "done"
          : item.status;
      await client.query(
        `INSERT INTO activities (
           id, user_id, title, location, notes, category, folder_id, status,
           date, start_time, duration_minutes, repeat_days, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          item.id,
          userId,
          item.title,
          item.location ?? "",
          item.notes ?? "",
          item.category,
          item.folderId ?? null,
          status,
          item.date,
          item.startTime ?? "",
          item.durationMinutes ?? 0,
          JSON.stringify(item.repeat ?? []),
          item.createdAt,
        ]
      );
    }

    const catalogs: Array<[string, FinanceCategoryOption[]]> = [
      ["income", data.incomeCategories ?? []],
      ["expense", data.expenseCategories ?? []],
      ["save", data.saveCategories ?? []],
    ];
    for (const [kind, rows] of catalogs) {
      for (const row of rows) {
        await client.query(
          `INSERT INTO finance_categories (id, user_id, kind, label)
           VALUES ($1,$2,$3,$4)`,
          [row.id, userId, kind, row.label]
        );
      }
    }

    for (const item of data.transactions ?? []) {
      await client.query(
        `INSERT INTO transactions (
           id, user_id, type, amount, currency, category, note, date, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          item.id,
          userId,
          item.type,
          item.amount,
          item.currency,
          item.category,
          item.note ?? "",
          item.date,
          item.createdAt,
        ]
      );
    }

    for (const goal of data.goals ?? []) {
      await client.query(
        `INSERT INTO goals (
           id, user_id, title, description, target_amount, current_amount,
           current_khr, current_usd, currency, start_date, target_date,
           members, status, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          goal.id,
          userId,
          goal.title,
          goal.description ?? "",
          goal.targetAmount,
          goal.currentAmount,
          goal.currentKhr,
          goal.currentUsd,
          goal.currency,
          goal.startDate,
          goal.targetDate,
          JSON.stringify(goal.members ?? []),
          goal.status,
          goal.createdAt,
        ]
      );
      for (const contrib of goal.contributions ?? []) {
        await client.query(
          `INSERT INTO goal_contributions (id, user_id, goal_id, amount, currency, date)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            contrib.id,
            userId,
            goal.id,
            contrib.amount,
            contrib.currency,
            contrib.date,
          ]
        );
      }
    }

    for (const item of data.events ?? []) {
      const done = mergeCompletion(
        Boolean(item.completed),
        item.completedAt,
        existingEvents.rows.find((row) => row.id === item.id)
      );
      await client.query(
        `INSERT INTO calendar_events (
           id, user_id, title, location, notes, date, end_date, start_time,
           end_time, all_day, folder_id, repeat_days, travel_time,
           repeat_frequency, end_repeat, alert, completed, completed_at, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          item.id,
          userId,
          item.title,
          item.location ?? "",
          item.notes ?? "",
          item.date,
          item.endDate,
          item.startTime ?? "",
          item.endTime ?? "",
          Boolean(item.allDay),
          item.folderId ?? null,
          JSON.stringify(item.repeat ?? []),
          item.travelTime,
          item.repeatFrequency,
          JSON.stringify(item.endRepeat ?? { type: "never" }),
          item.alert,
          done.completed,
          done.completedAt,
          item.createdAt,
        ]
      );
    }

    for (const item of data.reminders ?? []) {
      const done = mergeCompletion(
        Boolean(item.completed),
        item.completedAt,
        existingReminders.rows.find((row) => row.id === item.id)
      );
      await client.query(
        `INSERT INTO reminders (
           id, user_id, title, notes, due_date, due_time, completed, completed_at,
           repeat_days, alert, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          item.id,
          userId,
          item.title,
          item.notes ?? "",
          item.dueDate,
          item.dueTime ?? "",
          done.completed,
          done.completedAt,
          JSON.stringify(item.repeat ?? []),
          item.alert ?? null,
          item.createdAt,
        ]
      );
    }

    const tg = data.telegramSettings ?? emptyTelegram();
    const prev = existingTg.rows[0];
    const mergedNotices = mergeNoticeIds(
      prev?.auto_sent_event_date,
      prev?.auto_sent_event_ids,
      tg.autoSentEventDate,
      tg.autoSentEventIds
    );
    await client.query(
      `INSERT INTO telegram_settings (
         user_id, bot_token, chat_id, enabled, send_time, evening_time,
         last_auto_sent_date, last_evening_sent_date, auto_sent_event_date,
         auto_sent_event_ids
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        userId,
        tg.botToken ?? "",
        tg.chatId ?? "",
        Boolean(tg.enabled),
        tg.sendTime ?? "07:00",
        tg.eveningTime ?? "18:00",
        laterDate(prev?.last_auto_sent_date, tg.lastAutoSentDate),
        laterDate(prev?.last_evening_sent_date, tg.lastEveningSentDate),
        mergedNotices.date,
        JSON.stringify(mergedNotices.ids),
      ]
    );
  });
}
