import { format } from "date-fns";
import { km } from "date-fns/locale";
import type {
  Activity,
  CalendarEvent,
  FamilyGoal,
  Reminder,
  TelegramSettings,
  Transaction,
} from "./types";
import {
  eventsForDate,
  filterByDateRange,
  formatClock,
  formatMoneyPair,
  formatShortDate,
  goalProgress,
  goalSavedUsd,
  goalTargetUsd,
  isActivityForToday,
  isAtOrAfterTime,
  isSavingsTx,
  labelActivityCategory,
  labelActivityStatus,
  labelGoalStatus,
  labelTransactionType,
  remindersForDate,
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

export function buildEventReport(item: CalendarEvent, ownerName?: string): string {
  const lines = [
    ...reportHeader(ownerName, "ព្រឹត្តិការណ៍"),
    "",
    item.title,
    eventWhen(item),
  ];
  if (item.location) lines.push(item.location);
  const notes = item.notes?.trim();
  if (notes) lines.push(notes);
  return joinReport(lines);
}

export function sentEventIdsForToday(
  settings: TelegramSettings,
  now = new Date()
): string[] {
  const today = format(now, "yyyy-MM-dd");
  if ((settings.autoSentEventDate ?? "") !== today) return [];
  return settings.autoSentEventIds ?? [];
}

export function dueTodayEvents(
  events: CalendarEvent[],
  sentIds: string[],
  now = new Date()
): CalendarEvent[] {
  const sent = new Set(sentIds);
  const iso = format(now, "yyyy-MM-dd");
  return eventsForDate(events, iso).filter((item) => {
    if (item.completed || item.allDay || !item.startTime) return false;
    if (sent.has(item.id)) return false;
    return isAtOrAfterTime(item.startTime, now);
  });
}

export function msUntilNextEventReport(
  events: CalendarEvent[],
  sentIds: string[],
  now = new Date()
): number {
  const sent = new Set(sentIds);
  const iso = format(now, "yyyy-MM-dd");
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let wait = Number.POSITIVE_INFINITY;
  for (const item of eventsForDate(events, iso)) {
    if (item.completed || item.allDay || !item.startTime) continue;
    if (sent.has(item.id)) continue;
    const [hour, minute] = item.startTime.split(":").map(Number);
    const startMinutes = (hour || 0) * 60 + (minute || 0);
    if (startMinutes > nowMinutes) {
      wait = Math.min(wait, (startMinutes - nowMinutes) * 60_000);
    }
  }
  return Number.isFinite(wait) ? wait : 0;
}

export function canAutoSendSlot(
  settings: TelegramSettings,
  slot: "morning" | "evening",
  now = new Date()
): boolean {
  if (!settings.enabled) return false;
  if (!settings.botToken.trim() || !settings.chatId.trim()) return false;
  const today = format(now, "yyyy-MM-dd");
  if (slot === "morning") {
    if ((settings.lastAutoSentDate ?? "") === today) return false;
    return isAtOrAfterTime(settings.sendTime, now);
  }
  if ((settings.lastEveningSentDate ?? "") === today) return false;
  return isAtOrAfterTime(settings.eveningTime || "18:00", now);
}

export async function sendTelegramMessage(opts: {
  botToken: string;
  chatId: string;
  text: string;
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
