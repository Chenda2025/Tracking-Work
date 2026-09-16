import { format } from "date-fns";
import { km } from "date-fns/locale";
import type {
  Activity,
  CalendarEvent,
  EventAlert,
  FamilyGoal,
  Reminder,
  TelegramSettings,
  Transaction,
} from "./types";
import {
  eventOccursOnDate,
  eventsForDate,
  filterByDateRange,
  formatClock,
  formatMoneyPair,
  formatShortDate,
  goalProgress,
  goalSavedUsd,
  goalTargetUsd,
  isActivityForToday,
  isSavingsTx,
  labelActivityCategory,
  labelActivityStatus,
  labelEventAlert,
  labelGoalStatus,
  labelTransactionType,
  normalizeEventAlert,
  normalizeSendTime,
  occursOnDate,
  remindersForDate,
  shiftISODate,
  sumExpense,
  sumIncome,
  toUsd,
} from "./utils";

const REPORT_RULE = "────────";

export function reportOwnerName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed || "ថេរ";
}

function reportHeader(ownerName: string | undefined, title: string, period?: string) {
  const lines = [reportOwnerName(ownerName), title];
  if (period) lines.push(period);
  lines.push(REPORT_RULE);
  return lines;
}

function moneyField(label: string, usd: number, sign = "") {
  const pair = formatMoneyPair(usd);
  const amounts = [`  ${sign}${pair.khr}`, `  ${sign}${pair.usd}`];
  return label ? [label, ...amounts] : amounts;
}

function joinReport(lines: string[]) {
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

function eventWhen(item: CalendarEvent): string {
  if (item.allDay) return "ពេញថ្ងៃ";
  const start = item.startTime ? formatClock(item.startTime) : "";
  const end = item.endTime ? formatClock(item.endTime) : "";
  if (start && end) return start + " – " + end;
  return start || "—";
}

export function buildMorningDigest(input: {
  events: CalendarEvent[];
  reminders: Reminder[];
  activities: Activity[];
  now?: Date;
  period?: "morning" | "evening";
  ownerName?: string;
}): string {
  const now = input.now ?? new Date();
  const period = input.period ?? "morning";
  const iso = format(now, "yyyy-MM-dd");
  const heading = format(now, "EEEE d MMMM yyyy", { locale: km });
  const events = eventsForDate(input.events, iso);
  const reminders = remindersForDate(input.reminders, iso).filter((item) =>
    period === "evening" ? true : !item.completed
  );
  const activities = input.activities.filter((item) =>
    isActivityForToday(item, now)
  );
  const periodLabel = period === "evening" ? "ល្ងាច" : "ព្រឹក";

  const blocks: string[] = [
    ...reportHeader(input.ownerName, "សកម្មភាពថ្ងៃនេះ · " + periodLabel, heading),
    "",
  ];

  if (events.length) {
    blocks.push("ព្រឹត្តិការណ៍");
    events.forEach((item, index) => {
      const extra = [item.location, item.completed ? "រួចរាល់" : ""]
        .filter(Boolean)
        .join(" · ");
      blocks.push(
        `${index + 1}. ${item.title} · ${eventWhen(item)}${extra ? " · " + extra : ""}`
      );
    });
    blocks.push("");
  }

  if (reminders.length) {
    blocks.push("ការរំលឹក");
    reminders.forEach((item, index) => {
      const when = item.dueTime ? formatClock(item.dueTime) : "—";
      blocks.push(`${index + 1}. ${item.title} · ${when}`);
    });
    blocks.push("");
  }

  if (activities.length) {
    blocks.push("សកម្មភាព");
    activities.forEach((item, index) => {
      const extra = [
        item.startTime ? formatClock(item.startTime) : "",
        labelActivityCategory(item.category),
        labelActivityStatus(item.status),
      ]
        .filter(Boolean)
        .join(" · ");
      blocks.push(`${index + 1}. ${item.title}${extra ? " · " + extra : ""}`);
    });
    blocks.push("");
  }

  if (!events.length && !reminders.length && !activities.length) {
    blocks.push("មិនមានសកម្មភាពថ្ងៃនេះ");
  }

  return blocks.join("\n").trim().slice(0, 4000);
}

export function buildFinanceReport(input: {
  periodLabel: string;
  transactions: Transaction[];
  view?: "month" | "list" | "income" | "expense";
  categoryLabel: (id: string) => string;
  ownerName?: string;
}): string {
  const view = input.view ?? "month";
  const monthTx = input.transactions;
  const income = sumIncome(monthTx);
  const expense = sumExpense(monthTx);
  const title =
    view === "income"
      ? "របាយការណ៍ចំណូល"
      : view === "expense"
        ? "របាយការណ៍ចំណាយ"
        : "របាយការណ៍លុយ";

  const source =
    view === "income"
      ? monthTx.filter((item) => item.type === "income")
      : view === "expense"
        ? monthTx.filter((item) => item.type === "expense" && !isSavingsTx(item))
        : monthTx;

  const lines: string[] = [
    ...reportHeader(input.ownerName, title, input.periodLabel),
    "",
    ...moneyField("សមតុល្យសុទ្ធ", income - expense),
    "",
    ...moneyField("ចំណូល", income),
    "",
    ...moneyField("ចំណាយ", expense),
  ];

  const categoryTotals = new Map<string, number>();
  for (const item of source) {
    categoryTotals.set(
      item.category,
      (categoryTotals.get(item.category) ?? 0) + toUsd(item.amount, item.currency)
    );
  }
  const ranked = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length) {
    lines.push(
      "",
      REPORT_RULE,
      view === "income"
        ? "ប្រភេទចំណូល"
        : view === "expense"
          ? "ប្រភេទចំណាយ"
          : "ប្រភេទ"
    );
    ranked.forEach(([id, total], index) => {
      lines.push("", `${index + 1}. ${input.categoryLabel(id)}`, ...moneyField("", total));
    });
  }

  const sorted = [...source].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });

  if (!sorted.length) {
    lines.push("", REPORT_RULE, "មិនទាន់មានប្រតិបត្តិការ");
    return joinReport(lines);
  }

  lines.push("", REPORT_RULE, `ប្រតិបត្តិការ · ${sorted.length}`);
  let lastDate = "";
  for (const item of sorted) {
    if (item.date !== lastDate) {
      lastDate = item.date;
      lines.push("", formatShortDate(item.date));
    }
    const saved = isSavingsTx(item);
    const typeLabel = saved
      ? labelTransactionType("save")
      : labelTransactionType(item.type === "income" ? "income" : "expense");
    const usd = toUsd(item.amount, item.currency);
    const sign = item.type === "income" || saved ? "+" : "-";
    const note = item.note.trim();
    const extra = [
      "",
      `• ${input.categoryLabel(item.category)}`,
      `  ${typeLabel}`,
      ...moneyField("", usd, sign),
    ];
    if (note) extra.push(`  ${note}`);
    const draft = [...lines, ...extra].join("\n");
    if (draft.length > 4000) {
      lines.push("…");
      break;
    }
    lines.push(...extra);
  }

  return joinReport(lines);
}

export function buildGoalsReport(input: {
  periodLabel: string;
  start: Date;
  end: Date;
  goals: FamilyGoal[];
  view?: "all" | "active" | "paused" | "completed";
  ownerName?: string;
}): string {
  const view = input.view ?? "all";
  const source =
    view === "all"
      ? input.goals
      : input.goals.filter((goal) => goal.status === view);
  const title =
    view === "active"
      ? "របាយការណ៍គោលដៅសកម្ម"
      : view === "paused"
        ? "របាយការណ៍គោលដៅផ្អាក"
        : view === "completed"
          ? "របាយការណ៍គោលដៅបានបញ្ចប់"
          : "របាយការណ៍គោលដៅ";

  const periodRows: { date: string; title: string; usd: number }[] = [];
  let periodUsd = 0;
  for (const goal of source) {
    const contribs = filterByDateRange(
      goal.contributions ?? [],
      input.start,
      input.end
    );
    for (const item of contribs) {
      const usd = toUsd(item.amount, item.currency);
      periodUsd += usd;
      periodRows.push({ date: item.date, title: goal.title, usd });
    }
  }

  const savedUsd = source.reduce((sum, goal) => sum + goalSavedUsd(goal), 0);
  const targetUsd = source.reduce((sum, goal) => sum + goalTargetUsd(goal), 0);
  const active = source.filter((goal) => goal.status === "active").length;
  const paused = source.filter((goal) => goal.status === "paused").length;
  const completed = source.filter((goal) => goal.status === "completed").length;

  const lines: string[] = [
    ...reportHeader(input.ownerName, title, input.periodLabel),
    "",
    ...moneyField("សន្សំក្នុងរយៈពេល", periodUsd),
    "",
    ...moneyField("សន្សំសរុប", savedUsd),
    "",
    ...moneyField("គោលដៅ", targetUsd),
    "",
    ...moneyField("នៅសល់", Math.max(0, targetUsd - savedUsd)),
    "",
    REPORT_RULE,
    `សកម្ម ${active}`,
    `ផ្អាក ${paused}`,
    `បានបញ្ចប់ ${completed}`,
  ];

  if (source.length) {
    lines.push("", REPORT_RULE, "គោលដៅ");
    source.forEach((goal, index) => {
      const periodForGoal = filterByDateRange(
        goal.contributions ?? [],
        input.start,
        input.end
      ).reduce((sum, item) => sum + toUsd(item.amount, item.currency), 0);
      lines.push(
        "",
        `${index + 1}. ${goal.title}`,
        `  ${labelGoalStatus(goal.status)} · ${goalProgress(goal)}%`,
        "សន្សំ",
        ...moneyField("", goalSavedUsd(goal)),
        "គោលដៅ",
        ...moneyField("", goalTargetUsd(goal))
      );
      if (periodForGoal > 0) {
        lines.push("ក្នុងរយៈពេល", ...moneyField("", periodForGoal, "+"));
      }
    });
  }

  const sortedRows = [...periodRows].sort((a, b) => b.date.localeCompare(a.date));
  if (sortedRows.length) {
    lines.push("", REPORT_RULE, `ការរួមចំណែក · ${sortedRows.length}`);
    let lastDate = "";
    for (const row of sortedRows) {
      const extra =
        row.date !== lastDate
          ? ["", formatShortDate(row.date), `• ${row.title}`, ...moneyField("", row.usd, "+")]
          : [`• ${row.title}`, ...moneyField("", row.usd, "+")];
      lastDate = row.date;
      const draft = [...lines, ...extra].join("\n");
      if (draft.length > 4000) {
        lines.push("…");
        break;
      }
      lines.push(...extra);
    }
  } else if (!source.length) {
    lines.push("", REPORT_RULE, "មិនទាន់មានគោលដៅ");
  } else {
    lines.push("", REPORT_RULE, "មិនមានការរួមចំណែកក្នុងរយៈពេលនេះ");
  }

  return joinReport(lines);
}

export function buildEventReport(
  item: CalendarEvent,
  ownerName?: string,
  slot: "start" | "alert" = "start"
): string {
  const heading =
    slot === "alert"
      ? `ព្រឹត្តិការណ៍ · ជូនដំណឹង ${labelEventAlert(item.alert)}`
      : "ព្រឹត្តិការណ៍";
  const lines = [...reportHeader(ownerName, heading), "", item.title, eventWhen(item)];
  if (item.location) lines.push(item.location);
  const notes = item.notes?.trim();
  if (notes) lines.push(notes);
  return joinReport(lines);
}

export function buildReminderReport(
  item: Reminder,
  ownerName?: string,
  slot: "start" | "alert" = "start"
): string {
  const heading =
    slot === "alert"
      ? `ការរំលឹក · ជូនដំណឹង ${labelEventAlert(item.alert)}`
      : "ការរំលឹក";
  const when = item.dueTime ? formatClock(item.dueTime) : "—";
  const lines = [...reportHeader(ownerName, heading), "", item.title, when];
  const notes = item.notes?.trim();
  if (notes) lines.push(notes);
  return joinReport(lines);
}

/** Cambodia time (UTC+7) so Coolify UTC servers match the calendar clock. */
export const TELEGRAM_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export type TelegramClock = {
  iso: string;
  hour: number;
  minute: number;
  minutes: number;
};

export function telegramClock(now = new Date()): TelegramClock {
  const shifted = new Date(now.getTime() + TELEGRAM_TZ_OFFSET_MS);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return {
    iso: shifted.toISOString().slice(0, 10),
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

export function alertOffsetMinutes(alert?: EventAlert | null): number | null {
  switch (normalizeEventAlert(alert)) {
    case "5m":
      return 5;
    case "10m":
      return 10;
    case "15m":
      return 15;
    case "30m":
      return 30;
    case "1h":
      return 60;
    case "2h":
      return 120;
    case "1d":
      return 1440;
    case "2d":
      return 2880;
    case "1w":
      return 10080;
    default:
      return null;
  }
}

function clockToMinutes(time: string): number {
  const [hour, minute] = normalizeSendTime(time).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function shiftDateTime(
  iso: string,
  time: string,
  deltaMinutes: number
): { iso: string; time: string } {
  const mins = clockToMinutes(time) + deltaMinutes;
  const dayShift = Math.floor(mins / 1440);
  const wrapped = ((mins % 1440) + 1440) % 1440;
  return {
    iso: shiftISODate(iso, dayShift),
    time: `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`,
  };
}

function isClockAtOrAfter(time: string, clock: TelegramClock): boolean {
  return clock.minutes >= clockToMinutes(time);
}

const SEND_GRACE_MINUTES = 10;

function minutesFromToday(iso: string, time: string, todayISO: string): number {
  const dueDay = Date.parse(`${iso}T00:00:00Z`);
  const today = Date.parse(`${todayISO}T00:00:00Z`);
  const days = Math.round((dueDay - today) / 86400000);
  return days * 1440 + clockToMinutes(time);
}

function isRecentlyDue(
  iso: string,
  time: string,
  clock: TelegramClock,
  graceMinutes = SEND_GRACE_MINUTES
): boolean {
  const delta = clock.minutes - minutesFromToday(iso, time, clock.iso);
  return delta >= 0 && delta <= graceMinutes;
}

export type DueTelegramItem = {
  key: string;
  kind: "event" | "reminder";
  slot: "start" | "alert";
  event?: CalendarEvent;
  reminder?: Reminder;
};

const ALERT_LOOKAHEAD_DAYS = 7;

function noticeKey(
  kind: "event" | "reminder",
  id: string,
  occurrenceISO: string,
  slot: "start" | "alert"
) {
  return `${kind}:${id}:${occurrenceISO}:${slot}`;
}

function hasLegacyStartSent(sentIds: Set<string>, id: string) {
  return sentIds.has(id);
}

export function dueTelegramItems(
  events: CalendarEvent[],
  reminders: Reminder[],
  sentIds: string[] = [],
  clock = telegramClock()
): DueTelegramItem[] {
  const sent = new Set(sentIds);
  const due: DueTelegramItem[] = [];

  function considerTimed(opts: {
    kind: "event" | "reminder";
    id: string;
    occurrenceISO: string;
    time: string;
    alert?: EventAlert | null;
    event?: CalendarEvent;
    reminder?: Reminder;
  }) {
    const startKey = noticeKey(opts.kind, opts.id, opts.occurrenceISO, "start");
    if (
      isRecentlyDue(opts.occurrenceISO, opts.time, clock) &&
      !sent.has(startKey) &&
      !hasLegacyStartSent(sent, opts.id)
    ) {
      due.push({
        key: startKey,
        kind: opts.kind,
        slot: "start",
        event: opts.event,
        reminder: opts.reminder,
      });
    }

    const offset = alertOffsetMinutes(opts.alert);
    if (offset == null) return;
    const fire = shiftDateTime(opts.occurrenceISO, opts.time, -offset);
    const alertKey = noticeKey(opts.kind, opts.id, opts.occurrenceISO, "alert");
    if (
      isRecentlyDue(fire.iso, fire.time, clock) &&
      !sent.has(alertKey)
    ) {
      due.push({
        key: alertKey,
        kind: opts.kind,
        slot: "alert",
        event: opts.event,
        reminder: opts.reminder,
      });
    }
  }

  for (let day = 0; day <= ALERT_LOOKAHEAD_DAYS; day++) {
    const occurrenceISO = shiftISODate(clock.iso, day);
    for (const item of events) {
      if (item.completed || item.allDay || !item.startTime) continue;
      if (!eventOccursOnDate(item, occurrenceISO)) continue;
      considerTimed({
        kind: "event",
        id: item.id,
        occurrenceISO,
        time: item.startTime,
        alert: item.alert,
        event: item,
      });
    }
    for (const item of reminders) {
      if (item.completed || !item.dueTime) continue;
      if (!occursOnDate(occurrenceISO, item.dueDate, item.repeat)) continue;
      considerTimed({
        kind: "reminder",
        id: item.id,
        occurrenceISO,
        time: item.dueTime,
        alert: item.alert,
        reminder: item,
      });
    }
  }

  return due;
}

export function sentEventIdsForToday(
  settings: TelegramSettings,
  now = new Date()
): string[] {
  const today = telegramClock(now).iso;
  if ((settings.autoSentEventDate ?? "") !== today) return [];
  return settings.autoSentEventIds ?? [];
}

export function dueTodayEvents(
  events: CalendarEvent[],
  sentIds: string[],
  now = new Date()
): CalendarEvent[] {
  return dueTelegramItems(events, [], sentIds, telegramClock(now))
    .filter((item) => item.kind === "event" && item.slot === "start" && item.event)
    .map((item) => item.event as CalendarEvent);
}

export function msUntilNextEventReport(
  events: CalendarEvent[],
  sentIds: string[],
  now = new Date(),
  reminders: Reminder[] = []
): number {
  const clock = telegramClock(now);
  const sent = new Set(sentIds);
  let wait = Number.POSITIVE_INFINITY;

  function consider(occurrenceISO: string, time: string, key: string, legacyId?: string) {
    if (sent.has(key) || (legacyId && sent.has(legacyId))) return;
    if (occurrenceISO !== clock.iso) return;
    const startMinutes = clockToMinutes(time);
    if (startMinutes > clock.minutes) {
      wait = Math.min(wait, (startMinutes - clock.minutes) * 60_000);
    }
  }

  for (let day = 0; day <= ALERT_LOOKAHEAD_DAYS; day++) {
    const occurrenceISO = shiftISODate(clock.iso, day);
    for (const item of events) {
      if (item.completed || item.allDay || !item.startTime) continue;
      if (!eventOccursOnDate(item, occurrenceISO)) continue;
      consider(
        occurrenceISO,
        item.startTime,
        noticeKey("event", item.id, occurrenceISO, "start"),
        item.id
      );
      const offset = alertOffsetMinutes(item.alert);
      if (offset == null) continue;
      const fire = shiftDateTime(occurrenceISO, item.startTime, -offset);
      consider(fire.iso, fire.time, noticeKey("event", item.id, occurrenceISO, "alert"));
    }
    for (const item of reminders) {
      if (item.completed || !item.dueTime) continue;
      if (!occursOnDate(occurrenceISO, item.dueDate, item.repeat)) continue;
      consider(
        occurrenceISO,
        item.dueTime,
        noticeKey("reminder", item.id, occurrenceISO, "start"),
        item.id
      );
      const offset = alertOffsetMinutes(item.alert);
      if (offset == null) continue;
      const fire = shiftDateTime(occurrenceISO, item.dueTime, -offset);
      consider(
        fire.iso,
        fire.time,
        noticeKey("reminder", item.id, occurrenceISO, "alert")
      );
    }
  }

  return Number.isFinite(wait) ? wait : 0;
}

export function digestNoticeKey(slot: "morning" | "evening", iso: string) {
  return `digest:${slot}:${iso}`;
}

export function canAutoSendSlot(
  settings: TelegramSettings,
  slot: "morning" | "evening",
  now = new Date()
): boolean {
  if (!settings.enabled) return false;
  if (!settings.botToken.trim() || !settings.chatId.trim()) return false;
  const clock = telegramClock(now);
  if (slot === "morning") {
    if ((settings.lastAutoSentDate ?? "") === clock.iso) return false;
    return isClockAtOrAfter(settings.sendTime, clock);
  }
  if ((settings.lastEveningSentDate ?? "") === clock.iso) return false;
  return isClockAtOrAfter(settings.eveningTime || "18:00", clock);
}

export async function sendTelegramMessage(opts: {
  botToken: string;
  chatId: string;
  text: string;
  replyMarkup?: TelegramReplyMarkup;
}): Promise<void> {
  const token = opts.botToken.trim();
  const chatId = opts.chatId.trim();
  if (!token || !chatId) throw new Error("missing telegram config");

  const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: opts.text.slice(0, 4096),
      disable_web_page_preview: true,
      ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "telegram send failed");
  }
}

export type TelegramWorkKind = "e" | "r" | "a";

export type TelegramWorkItem = {
  kind: TelegramWorkKind;
  id: string;
  title: string;
};

export type TelegramReplyMarkup = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

export function telegramDoneData(kind: TelegramWorkKind, id: string) {
  return `d:${kind}:${id}`.slice(0, 64);
}

export function parseTelegramDoneData(data: string): {
  kind: TelegramWorkKind;
  id: string;
} | null {
  const match = /^d:(e|r|a):(.+)$/.exec(data.trim());
  if (!match) return null;
  return { kind: match[1] as TelegramWorkKind, id: match[2] };
}

function truncateButton(title: string, max = 34) {
  const clean = title.trim() || "ការងារ";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function singleDoneKeyboard(
  kind: TelegramWorkKind,
  id: string
): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [{ text: "✅ សម្គាល់រួច", callback_data: telegramDoneData(kind, id) }],
    ],
  };
}

export function workDoneKeyboard(items: TelegramWorkItem[]): TelegramReplyMarkup | undefined {
  const rows = items.slice(0, 40).map((item) => [
    {
      text: `✅ ${truncateButton(item.title)}`,
      callback_data: telegramDoneData(item.kind, item.id),
    },
  ]);
  if (!rows.length) return undefined;
  return { inline_keyboard: rows };
}

export function todayWorkItems(input: {
  events: CalendarEvent[];
  reminders: Reminder[];
  activities: Activity[];
  now?: Date;
}): TelegramWorkItem[] {
  const iso = telegramClock(input.now).iso;
  const items: TelegramWorkItem[] = [];
  for (const item of eventsForDate(input.events, iso)) {
    if (item.completed) continue;
    items.push({ kind: "e", id: item.id, title: item.title });
  }
  for (const item of remindersForDate(input.reminders, iso)) {
    if (item.completed) continue;
    items.push({ kind: "r", id: item.id, title: item.title });
  }
  for (const item of input.activities) {
    if (item.status === "done") continue;
    if (!isActivityForToday(item, input.now ?? new Date())) continue;
    items.push({ kind: "a", id: item.id, title: item.title });
  }
  return items;
}

export function buildTodayWorkList(input: {
  events: CalendarEvent[];
  reminders: Reminder[];
  activities: Activity[];
  ownerName?: string;
  now?: Date;
}): string {
  const digest = buildMorningDigest({
    events: input.events,
    reminders: input.reminders,
    activities: input.activities,
    now: input.now,
    period: "morning",
    ownerName: input.ownerName,
  });
  return joinReport([
    digest,
    "",
    REPORT_RULE,
    "ចុច ✅ លើការងារ ដើម្បីសម្គាល់រួចក្នុងប្រព័ន្ធ",
  ]);
}
