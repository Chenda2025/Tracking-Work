import { format, isToday, parseISO, startOfMonth, endOfMonth, isWithinInterval, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { km } from "date-fns/locale";
import { toKhmerLunarDate } from "khmer-chhankitek-calendar";
import type {
  Activity,
  ActivityFolder,
  ActivityRepeat,
  CalendarEvent,
  EventAlert,
  EventEndRepeat,
  EventRepeatFrequency,
  EventTravelTime,
  FamilyGoal,
  GoalContribution,
  FolderColor,
  FolderPriority,
  FinanceCategoryOption,
  MoneyCurrency,
  Reminder,
  Transaction,
} from "./types";

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export type ClockPeriod = "am" | "pm";

export function nowClockTime(): string {
  const d = new Date();
  const minutes = Math.round(d.getMinutes() / 5) * 5;
  const extraHour = minutes === 60 ? 1 : 0;
  const h = (d.getHours() + extraHour) % 24;
  const m = minutes === 60 ? 0 : minutes;
  return `${pad2(h)}:${pad2(m)}`;
}

export function splitClock(time: string): {
  hour12: number;
  minute: number;
  period: ClockPeriod;
} {
  const [rawH = "8", rawM = "0"] = (time || "08:00").split(":");
  const hour24 = Math.min(23, Math.max(0, Number(rawH) || 0));
  const minute = Math.min(59, Math.max(0, Number(rawM) || 0));
  const period: ClockPeriod = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

export function joinClock(
  hour12: number,
  minute: number,
  period: ClockPeriod
): string {
  let hour24 = hour12 % 12;
  if (period === "pm") hour24 += 12;
  return `${pad2(hour24)}:${pad2(minute)}`;
}

export function normalizeSendTime(
  value?: string | null,
  fallback = "07:00"
): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!match) return fallback;
  const hour = Math.min(23, Math.max(0, Number(match[1]) || 0));
  const minute = Math.min(59, Math.max(0, Number(match[2]) || 0));
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function isAtOrAfterTime(time: string, now = new Date()): boolean {
  const [hour, minute] = normalizeSendTime(time).split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute;
}

export function formatClock(time?: string): string {
  if (!time) return "";
  const { hour12, minute, period } = splitClock(time);
  return `${hour12}:${pad2(minute)} ${period === "am" ? "ព្រឹក" : "ល្ងាច"}`;
}

export type KhmerDateTimeStamp = {
  weekday: string;
  moon: string;
  month: string;
  year: string;
  sak: string;
  be: string;
  solar: string;
  observance: string;
  label: string;
};

export function formatKhmerLunarDateTime(date = new Date()): KhmerDateTimeStamp {
  const lunar = toKhmerLunarDate(date);
  return {
    weekday: `ថ្ងៃ${lunar.dayOfWeek}`,
    moon: `${lunar.moonDayKhmer}${lunar.moonStatus}`,
    month: `ខែ${lunar.khmerMonth}`,
    year: `ឆ្នាំ${lunar.animalYear}`,
    sak: lunar.sak,
    be: `ព.ស. ${lunar.buddhistEraYearKhmer}`,
    solar: lunar.gregorianDateText,
    observance: lunar.observanceText ?? "",
    label: lunar.fullText,
  };
}

/** Common Cambodia market rate used to show dollar and riel together. */
export const KHR_PER_USD = 4100;

export function normalizeMoneyCurrency(value: unknown): MoneyCurrency {
  return value === "KHR" ? "KHR" : "USD";
}

export function toUsd(amount: number, currency?: MoneyCurrency | string): number {
  const value = Number(amount) || 0;
  return normalizeMoneyCurrency(currency) === "KHR"
    ? value / KHR_PER_USD
    : value;
}

export function toKhr(usd: number): number {
  return Math.round((Number(usd) || 0) * KHR_PER_USD);
}

export function formatMoney(
  amount: number,
  currency: MoneyCurrency | string = "USD"
): string {
  const value = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("km-KH", {
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(value)));
  const sign = value < 0 ? "-" : "";
  return normalizeMoneyCurrency(currency) === "KHR"
    ? `${sign}៛${formatted}`
    : `${sign}$${formatted}`;
}

export function formatMoneyPair(usd: number): { khr: string; usd: string } {
  return {
    khr: formatMoney(toKhr(usd), "KHR"),
    usd: formatMoney(usd, "USD"),
  };
}

export function goalCurrentByCurrency(goal: Pick<
  FamilyGoal,
  "currency" | "currentAmount" | "currentKhr" | "currentUsd"
>): { khr: number; usd: number } {
  const hasSplit =
    Number.isFinite(Number(goal.currentKhr)) ||
    Number.isFinite(Number(goal.currentUsd));
  if (hasSplit) {
    return {
      khr: Math.max(0, Number(goal.currentKhr) || 0),
      usd: Math.max(0, Number(goal.currentUsd) || 0),
    };
  }
  const current = Math.max(0, Number(goal.currentAmount) || 0);
  return goal.currency === "USD"
    ? { khr: 0, usd: current }
    : { khr: current, usd: 0 };
}

export function withGoalCurrents(input: {
  currency?: MoneyCurrency | string;
  currentAmount?: number;
  currentKhr?: number;
  currentUsd?: number;
}): { currentKhr: number; currentUsd: number; currentAmount: number } {
  const currency = normalizeMoneyCurrency(input.currency);
  const currents = goalCurrentByCurrency({
    currency,
    currentAmount: Number(input.currentAmount) || 0,
    currentKhr: input.currentKhr as number,
    currentUsd: input.currentUsd as number,
  });
  return {
    currentKhr: currents.khr,
    currentUsd: currents.usd,
    currentAmount: currency === "USD" ? currents.usd : currents.khr,
  };
}

export function sumGoalAmounts(
  goals: FamilyGoal[],
  field: "currentAmount" | "targetAmount"
): { khr: number; usd: number } {
  return goals.reduce(
    (acc, goal) => {
      if (field === "currentAmount") {
        const currents = goalCurrentByCurrency(goal);
        acc.khr += currents.khr;
        acc.usd += currents.usd;
        return acc;
      }
      const value = Math.max(0, Number(goal.targetAmount) || 0);
      if (goal.currency === "USD") acc.usd += value;
      else acc.khr += value;
      return acc;
    },
    { khr: 0, usd: 0 }
  );
}

export function formatShortDate(date: string): string {
  try {
    return format(parseISO(date), "dd MMM yyyy", { locale: km });
  } catch {
    return date;
  }
}

export function formatMonth(date = new Date()): string {
  return format(date, "MMMM yyyy", { locale: km });
}

export function isDateToday(date: string): boolean {
  try {
    return isToday(parseISO(date));
  } catch {
    return false;
  }
}

const REPEAT_WEEKDAY: Record<ActivityRepeat, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const WEEKDAYS: ActivityRepeat[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function weekdayFromISO(iso: string): ActivityRepeat {
  try {
    const day = parseISO(iso).getDay();
    const found = (Object.keys(REPEAT_WEEKDAY) as ActivityRepeat[]).find(
      (key) => REPEAT_WEEKDAY[key] === day
    );
    return found ?? "monday";
  } catch {
    return "monday";
  }
}

export function nextISOForWeekday(day: ActivityRepeat, fromISO = todayISO()): string {
  const from = parseISO(fromISO);
  const target = REPEAT_WEEKDAY[day];
  const add = (target - from.getDay() + 7) % 7;
  const next = new Date(from);
  next.setDate(from.getDate() + add);
  return format(next, "yyyy-MM-dd");
}

export function normalizeRepeatDays(
  value?: ActivityRepeat[] | ActivityRepeat | "none" | null
): ActivityRepeat[] {
  if (!value || value === "none") return [];
  const list = Array.isArray(value) ? value : [value];
  return WEEKDAYS.filter((day) => list.includes(day));
}

export function isActivityForToday(activity: Activity, now = new Date()): boolean {
  if (isDateToday(activity.date)) return true;
  const days = normalizeRepeatDays(activity.repeat);
  if (days.length === 0) return false;
  const today = now.getDay();
  return days.some((day) => REPEAT_WEEKDAY[day] === today);
}

export function occursOnDate(
  dateISO: string,
  itemDate: string,
  repeat?: ActivityRepeat[] | null
): boolean {
  if (itemDate === dateISO) return true;
  const days = normalizeRepeatDays(repeat);
  if (days.length === 0) return false;
  try {
    const target = parseISO(dateISO);
    const origin = parseISO(itemDate);
    if (target < origin) return false;
    return days.some((day) => REPEAT_WEEKDAY[day] === target.getDay());
  } catch {
    return false;
  }
}

export function normalizeEventRepeatFrequency(
  value?: EventRepeatFrequency | ActivityRepeat[] | ActivityRepeat | "none" | null
): EventRepeatFrequency {
  if (!value || value === "never" || value === "none") return "never";
  if (
    value === "daily" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }
  const days = normalizeRepeatDays(value as ActivityRepeat[] | ActivityRepeat | "none");
  return days.length > 0 ? "weekly" : "never";
}

export function normalizeEventEndRepeat(
  value?: EventEndRepeat | null,
  fallbackDate = todayISO()
): EventEndRepeat {
  if (!value || !value.type || value.type === "never") return { type: "never" };
  if (value.type === "on_date") {
    return { type: "on_date", date: value.date || fallbackDate };
  }
  if (value.type === "after") {
    return { type: "after", count: Math.max(1, Number(value.count) || 1) };
  }
  return { type: "never" };
}

export function normalizeEventTravelTime(value?: EventTravelTime | null): EventTravelTime {
  const allowed: EventTravelTime[] = ["none", "5m", "15m", "30m", "1h", "1h30", "2h"];
  return value && allowed.includes(value) ? value : "none";
}

export function normalizeEventAlert(value?: EventAlert | null): EventAlert {
  const allowed: EventAlert[] = [
    "none",
    "at_time",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "1d",
    "2d",
    "1w",
  ];
  return value && allowed.includes(value) ? value : "none";
}

function daysBetween(origin: Date, target: Date): number {
  const a = Date.UTC(origin.getFullYear(), origin.getMonth(), origin.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export function eventOccurrenceIndex(
  event: Pick<CalendarEvent, "date" | "repeatFrequency" | "repeat">,
  dateISO: string
): number | null {
  try {
    const origin = parseISO(event.date);
    const target = parseISO(dateISO);
    if (target < origin) return null;
    const freq = normalizeEventRepeatFrequency(event.repeatFrequency ?? event.repeat);
    const diff = daysBetween(origin, target);

    if (freq === "never") return diff === 0 ? 0 : null;
    if (freq === "daily") return diff;
    if (freq === "weekly") {
      if (target.getDay() !== origin.getDay()) return null;
      return diff % 7 === 0 ? diff / 7 : null;
    }
    if (freq === "biweekly") {
      if (target.getDay() !== origin.getDay()) return null;
      return diff % 14 === 0 ? diff / 14 : null;
    }
    if (freq === "monthly") {
      if (target.getDate() !== origin.getDate()) return null;
      const months =
        (target.getFullYear() - origin.getFullYear()) * 12 +
        (target.getMonth() - origin.getMonth());
      return months >= 0 ? months : null;
    }
    if (freq === "yearly") {
      if (
        target.getDate() !== origin.getDate() ||
        target.getMonth() !== origin.getMonth()
      ) {
        return null;
      }
      return target.getFullYear() - origin.getFullYear();
    }
    return null;
  } catch {
    return null;
  }
}

export function shiftISODate(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

export function eventSpanDays(event: Pick<CalendarEvent, "date" | "endDate">): number {
  const end = event.endDate && event.endDate >= event.date ? event.endDate : event.date;
  try {
    return Math.max(0, daysBetween(parseISO(event.date), parseISO(end)));
  } catch {
    return 0;
  }
}

export function eventOccursOnDate(event: CalendarEvent, dateISO: string): boolean {
  const hasLegacyWeekdays =
    event.repeatFrequency == null && normalizeRepeatDays(event.repeat).length > 0;
  if (hasLegacyWeekdays) {
    return occursOnDate(dateISO, event.date, event.repeat);
  }

  const span = eventSpanDays(event);
  for (let i = 0; i <= span; i++) {
    const startISO = shiftISODate(dateISO, -i);
    if (startISO < event.date) continue;
    const index = eventOccurrenceIndex(event, startISO);
    if (index === null) continue;
    const end = normalizeEventEndRepeat(event.endRepeat, event.date);
    if (end.type === "on_date" && startISO > end.date) continue;
    if (end.type === "after" && index >= end.count) continue;
    return true;
  }
  return false;
}

export type CalendarCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
};

export function buildMonthGrid(month: Date): CalendarCell[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end }).map((date) => ({
    date,
    iso: format(date, "yyyy-MM-dd"),
    inMonth: isSameMonth(date, month),
    isToday: isToday(date),
  }));
}

export function shiftMonth(month: Date, delta: number): Date {
  return delta >= 0 ? addMonths(month, delta) : subMonths(month, Math.abs(delta));
}

export function isSameDayISO(a: string, b: string): boolean {
  try {
    return isSameDay(parseISO(a), parseISO(b));
  } catch {
    return a === b;
  }
}

export function eventsForDate(events: CalendarEvent[], dateISO: string): CalendarEvent[] {
  return events
    .filter((e) => eventOccursOnDate(e, dateISO))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });
}

export function remindersForDate(reminders: Reminder[], dateISO: string): Reminder[] {
  return reminders
    .filter((r) => occursOnDate(dateISO, r.dueDate, r.repeat))
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.dueTime || "").localeCompare(b.dueTime || "");
    });
}

export function calendarMarksForMonth(
  month: Date,
  events: CalendarEvent[],
  reminders: Reminder[]
): Record<string, { events: number; reminders: number }> {
  const cells = buildMonthGrid(month);
  const marks: Record<string, { events: number; reminders: number }> = {};
  for (const cell of cells) {
    if (!cell.inMonth) continue;
    const eCount = eventsForDate(events, cell.iso).length;
    const rCount = remindersForDate(reminders, cell.iso).length;
    if (eCount || rCount) {
      marks[cell.iso] = { events: eCount, reminders: rCount };
    }
  }
  return marks;
}

export const WEEKDAY_HEADERS_KM = ["អា", "ច", "អ", "ព", "ព្រ", "សុ", "សៅ"] as const;

export function filterByMonth<T extends { date: string }>(
  items: T[],
  month: Date
): T[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  return items.filter((item) => {
    try {
      return isWithinInterval(parseISO(item.date), { start, end });
    } catch {
      return false;
    }
  });
}

export function filterThisMonth<T extends { date: string }>(items: T[]): T[] {
  return filterByMonth(items, new Date());
}

export function financeMarksForMonth(
  month: Date,
  transactions: Transaction[]
): Record<string, { income: number; expense: number }> {
  const marks: Record<string, { income: number; expense: number }> = {};
  for (const item of filterByMonth(transactions, month)) {
    const current = marks[item.date] ?? { income: 0, expense: 0 };
    if (item.type === "income") current.income += 1;
    else current.expense += 1;
    marks[item.date] = current;
  }
  return marks;
}

export function sumIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + toUsd(t.amount, t.currency), 0);
}

export function isSavingsTx(item: Transaction): boolean {
  return item.type === "save" || item.category === "savings";
}

export function sumExpense(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "expense" && !isSavingsTx(t))
    .reduce((sum, t) => sum + toUsd(t.amount, t.currency), 0);
}

export function sumSavings(transactions: Transaction[]): number {
  return transactions
    .filter(isSavingsTx)
    .reduce((sum, t) => sum + toUsd(t.amount, t.currency), 0);
}

export function goalSavedUsd(
  goal: Pick<FamilyGoal, "currency" | "currentAmount" | "currentKhr" | "currentUsd">
): number {
  const currents = goalCurrentByCurrency(goal);
  return toUsd(currents.khr, "KHR") + toUsd(currents.usd, "USD");
}

export function goalTargetUsd(
  goal: Pick<FamilyGoal, "targetAmount" | "currency">
): number {
  return toUsd(goal.targetAmount, goal.currency);
}

export function goalSavedInCurrency(
  goal: Pick<
    FamilyGoal,
    "currency" | "currentAmount" | "currentKhr" | "currentUsd"
  >,
  currency: MoneyCurrency = normalizeMoneyCurrency(goal.currency)
): number {
  const savedUsd = goalSavedUsd(goal);
  return currency === "USD" ? savedUsd : toKhr(savedUsd);
}

export function goalProgress(goal: FamilyGoal): number {
  const target = goalTargetUsd(goal);
  if (target <= 0) return 0;
  return Math.min(100, Math.round((goalSavedUsd(goal) / target) * 100));
}

export function goalIsReached(goal: FamilyGoal): boolean {
  const target = goalTargetUsd(goal);
  return target > 0 && goalSavedUsd(goal) >= target;
}

export function normalizeGoalDates(input: {
  startDate?: string;
  targetDate?: string;
  createdAt?: string;
}): { startDate: string; targetDate: string } {
  const today = todayISO();
  const created = input.createdAt?.slice(0, 10);
  const start = input.startDate || created || input.targetDate || today;
  const end = input.targetDate || start;
  if (end < start) return { startDate: start, targetDate: start };
  return { startDate: start, targetDate: end };
}

export function formatGoalDateRange(goal: Pick<FamilyGoal, "startDate" | "targetDate">): string {
  const { startDate, targetDate } = normalizeGoalDates(goal);
  const start = formatShortDate(startDate);
  const end = formatShortDate(targetDate);
  if (startDate === targetDate) return start;
  return `${start} – ${end}`;
}

export function clampDateToGoalRange(
  date: string,
  goal: Pick<FamilyGoal, "startDate" | "targetDate" | "createdAt">
): string {
  const { startDate, targetDate } = normalizeGoalDates(goal);
  if (date < startDate) return startDate;
  if (date > targetDate) return targetDate;
  return date;
}

export function normalizeGoalContributions(list: unknown): GoalContribution[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<GoalContribution>;
    const amount = Math.max(0, Number(row.amount) || 0);
    const date =
      typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(row.date)
        ? row.date.slice(0, 10)
        : "";
    if (!amount || !date) return [];
    return [
      {
        id: typeof row.id === "string" && row.id ? row.id : uid(),
        amount,
        currency: normalizeMoneyCurrency(row.currency),
        date,
      },
    ];
  });
}

export function seedGoalContributions(
  currents: { currentKhr: number; currentUsd: number },
  date: string
): GoalContribution[] {
  const items: GoalContribution[] = [];
  if (currents.currentKhr > 0) {
    items.push({
      id: uid(),
      amount: currents.currentKhr,
      currency: "KHR",
      date,
    });
  }
  if (currents.currentUsd > 0) {
    items.push({
      id: uid(),
      amount: currents.currentUsd,
      currency: "USD",
      date,
    });
  }
  return items;
}

export function goalMonthKeys(startDate?: string, targetDate?: string): string[] {
  const dates = normalizeGoalDates({ startDate, targetDate });
  const start = parseISO(`${dates.startDate.slice(0, 7)}-01`);
  const end = parseISO(`${dates.targetDate.slice(0, 7)}-01`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [dates.startDate.slice(0, 7)];
  }
  const months: string[] = [];
  let cursor = start;
  for (let i = 0; i < 60 && cursor.getTime() <= end.getTime(); i += 1) {
    months.push(format(cursor, "yyyy-MM"));
    cursor = addMonths(cursor, 1);
  }
  return months.length ? months : [dates.startDate.slice(0, 7)];
}

export const GOAL_DAY_TICKS = [1, 10, 20, 30] as const;

export function goalDayTick(day: number): (typeof GOAL_DAY_TICKS)[number] {
  const value = Math.max(1, Math.min(31, Math.round(Number(day) || 1)));
  if (value <= 5) return 1;
  if (value <= 15) return 10;
  if (value <= 25) return 20;
  return 30;
}

export function goalPaidDayTicks(
  goal: Pick<
    FamilyGoal,
    | "contributions"
    | "startDate"
    | "createdAt"
    | "currency"
    | "currentAmount"
    | "currentKhr"
    | "currentUsd"
  >
): Map<string, Set<number>> {
  const paid = new Map<string, Set<number>>();

  function mark(date: string) {
    const month = date.slice(0, 7);
    const day = Number(date.slice(8, 10));
    if (!month || !day) return;
    const ticks = paid.get(month) ?? new Set<number>();
    ticks.add(goalDayTick(day));
    paid.set(month, ticks);
  }

  for (const item of goal.contributions ?? []) {
    if (item?.date && Number(item.amount) > 0) mark(item.date);
  }

  if (paid.size === 0) {
    const currents = goalCurrentByCurrency(goal);
    if (currents.khr > 0 || currents.usd > 0) {
      mark((goal.startDate || goal.createdAt || todayISO()).slice(0, 10));
    }
  }

  return paid;
}

export function goalMonthTotals(
  goal: Pick<
    FamilyGoal,
    | "contributions"
    | "startDate"
    | "createdAt"
    | "currency"
    | "currentAmount"
    | "currentKhr"
    | "currentUsd"
  >,
  monthKey: string
): { khr: number; usd: number } {
  const totals = { khr: 0, usd: 0 };
  const contributions = goal.contributions ?? [];
  let found = false;
  for (const item of contributions) {
    if (!item?.date || Number(item.amount) <= 0) continue;
    if (item.date.slice(0, 7) !== monthKey) continue;
    found = true;
    if (item.currency === "USD") totals.usd += item.amount;
    else totals.khr += item.amount;
  }
  if (!found && contributions.length === 0) {
    const startMonth = (goal.startDate || goal.createdAt || todayISO()).slice(
      0,
      7
    );
    if (startMonth === monthKey) {
      return goalCurrentByCurrency(goal);
    }
  }
  return totals;
}

export function goalPaidMonthKeys(
  goal: Pick<
    FamilyGoal,
    | "contributions"
    | "startDate"
    | "createdAt"
    | "currency"
    | "currentAmount"
    | "currentKhr"
    | "currentUsd"
  >
): Set<string> {
  const paid = new Set<string>();
  for (const item of goal.contributions ?? []) {
    if (item?.date && Number(item.amount) > 0) {
      paid.add(item.date.slice(0, 7));
    }
  }
  if (paid.size === 0) {
    const currents = goalCurrentByCurrency(goal);
    if (currents.khr > 0 || currents.usd > 0) {
      paid.add((goal.startDate || goal.createdAt || todayISO()).slice(0, 7));
    }
  }
  return paid;
}

export function formatGoalMonthTick(monthKey: string, withYear = false): string {
  try {
    return format(parseISO(`${monthKey}-01`), withYear ? "MMM yy" : "MMM", {
      locale: km,
    });
  } catch {
    return monthKey;
  }
}

export function activityStats(activities: Activity[]) {
  const total = activities.length;
  const done = activities.filter((a) => a.status === "done").length;
  const minutes = activities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
  return { total, done, minutes, rate: total ? Math.round((done / total) * 100) : 0 };
}

const PRIORITY_ORDER: Record<FolderPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function getFolderColor(folder: Pick<ActivityFolder, "color"> | { color?: FolderColor }): FolderColor {
  return folder.color ?? "teal";
}

export function getFolderPriority(
  folder: Pick<ActivityFolder, "priority"> | { priority?: FolderPriority }
): FolderPriority {
  return folder.priority ?? "medium";
}

export function getChildFolders(
  folders: ActivityFolder[],
  parentId: string | null
): ActivityFolder[] {
  return folders
    .filter((f) => (f.parentId ?? null) === parentId)
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[getFolderPriority(a)];
      const pb = PRIORITY_ORDER[getFolderPriority(b)];
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, "km");
    });
}

export function getFolderPath(
  folders: ActivityFolder[],
  folderId: string
): ActivityFolder[] {
  const path: ActivityFolder[] = [];
  let current = folders.find((f) => f.id === folderId);
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    path.unshift(current);
    current = current.parentId
      ? folders.find((f) => f.id === current!.parentId)
      : undefined;
  }
  return path;
}

export const FOLDER_COLORS: {
  value: FolderColor;
  label: string;
  swatch: string;
  soft: string;
  text: string;
}[] = [
  { value: "teal", label: "បៃតងខៀវ", swatch: "#0b6557", soft: "#e4f3ef", text: "#084840" },
  { value: "blue", label: "ខៀវ", swatch: "#1d6fa5", soft: "#e6f1f8", text: "#0f4d73" },
  { value: "green", label: "បៃតង", swatch: "#1a7348", soft: "#e6f4ec", text: "#0f5132" },
  { value: "amber", label: "លឿងទឹកក្រូច", swatch: "#9a6700", soft: "#fff6df", text: "#7a5200" },
  { value: "coral", label: "ទឹកក្រូច", swatch: "#b85a24", soft: "#f7ebe3", text: "#8a4015" },
  { value: "slate", label: "ប្រផេះ", swatch: "#5a6b64", soft: "#eef1ef", text: "#3d4a45" },
];

export const FOLDER_PRIORITIES: {
  value: FolderPriority;
  label: string;
}[] = [
  { value: "high", label: "ខ្ពស់" },
  { value: "medium", label: "មធ្យម" },
  { value: "low", label: "ទាប" },
];

export function folderColorMeta(color?: FolderColor) {
  return FOLDER_COLORS.find((c) => c.value === (color ?? "teal")) ?? FOLDER_COLORS[0];
}

export function labelFolderPriority(value?: FolderPriority): string {
  const priority = value ?? "medium";
  return FOLDER_PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
}

export const ACTIVITY_CATEGORIES = [
  { value: "work", label: "ការងារ" },
  { value: "personal", label: "ផ្ទាល់ខ្លួន" },
  { value: "health", label: "សុខភាព" },
  { value: "learning", label: "ការសិក្សា" },
  { value: "family", label: "គ្រួសារ" },
  { value: "other", label: "ផ្សេងៗ" },
] as const;

export const ACTIVITY_STATUSES = [
  { value: "planned", label: "បានគ្រោង" },
  { value: "in_progress", label: "កំពុងធ្វើ" },
  { value: "done", label: "រួចរាល់" },
] as const;

export const ACTIVITY_REPEATS: {
  value: ActivityRepeat;
  label: string;
  short: string;
}[] = [
  { value: "monday", label: "រៀងរាល់ថ្ងៃច័ន្ទ", short: "ច" },
  { value: "tuesday", label: "រៀងរាល់ថ្ងៃអង្គារ", short: "អ" },
  { value: "wednesday", label: "រៀងរាល់ថ្ងៃពុធ", short: "ព" },
  { value: "thursday", label: "រៀងរាល់ថ្ងៃព្រហស្បតិ៍", short: "ព្រ" },
  { value: "friday", label: "រៀងរាល់ថ្ងៃសុក្រ", short: "សុ" },
  { value: "saturday", label: "រៀងរាល់ថ្ងៃសៅរ៍", short: "សៅ" },
  { value: "sunday", label: "រៀងរាល់ថ្ងៃអាទិត្យ", short: "អា" },
];

export function labelActivityRepeat(
  value?: ActivityRepeat[] | ActivityRepeat | "none" | null
): string {
  const days = normalizeRepeatDays(value);
  if (days.length === 0) return "";
  return days
    .map((day) => ACTIVITY_REPEATS.find((r) => r.value === day)?.label ?? day)
    .join(" · ");
}

export const EVENT_TRAVEL_TIMES: { value: EventTravelTime; label: string }[] = [
  { value: "none", label: "គ្មាន" },
  { value: "5m", label: "៥ នាទី" },
  { value: "15m", label: "១៥ នាទី" },
  { value: "30m", label: "៣០ នាទី" },
  { value: "1h", label: "១ ម៉ោង" },
  { value: "1h30", label: "១ ម៉ោង ៣០ នាទី" },
  { value: "2h", label: "២ ម៉ោង" },
];

export const EVENT_REPEAT_FREQUENCIES: {
  value: EventRepeatFrequency;
  label: string;
}[] = [
  { value: "never", label: "មិនធ្វើម្តងទៀត" },
  { value: "daily", label: "រៀងរាល់ថ្ងៃ" },
  { value: "weekly", label: "រៀងរាល់សប្តាហ៍" },
  { value: "biweekly", label: "រៀងរាល់ ២ សប្តាហ៍" },
  { value: "monthly", label: "រៀងរាល់ខែ" },
  { value: "yearly", label: "រៀងរាល់ឆ្នាំ" },
];

export const EVENT_ALERTS: { value: EventAlert; label: string }[] = [
  { value: "none", label: "គ្មាន" },
  { value: "at_time", label: "នៅពេលចាប់ផ្តើម" },
  { value: "5m", label: "៥ នាទីមុន" },
  { value: "15m", label: "១៥ នាទីមុន" },
  { value: "30m", label: "៣០ នាទីមុន" },
  { value: "1h", label: "១ ម៉ោងមុន" },
  { value: "2h", label: "២ ម៉ោងមុន" },
  { value: "1d", label: "១ ថ្ងៃមុន" },
  { value: "2d", label: "២ ថ្ងៃមុន" },
  { value: "1w", label: "១ សប្តាហ៍មុន" },
];

export function labelEventTravelTime(value?: EventTravelTime | null): string {
  const v = normalizeEventTravelTime(value);
  return EVENT_TRAVEL_TIMES.find((o) => o.value === v)?.label ?? "";
}

export function labelEventRepeatFrequency(
  value?: EventRepeatFrequency | ActivityRepeat[] | null
): string {
  const v = normalizeEventRepeatFrequency(value);
  if (v === "never") return "";
  return EVENT_REPEAT_FREQUENCIES.find((o) => o.value === v)?.label ?? "";
}

export function labelEventAlert(value?: EventAlert | null): string {
  const v = normalizeEventAlert(value);
  if (v === "none") return "";
  return EVENT_ALERTS.find((o) => o.value === v)?.label ?? "";
}

export function labelEventEndRepeat(value?: EventEndRepeat | null): string {
  const end = normalizeEventEndRepeat(value);
  if (end.type === "never") return "";
  if (end.type === "on_date") return `បញ្ចប់ ${formatShortDate(end.date)}`;
  return `បញ្ចប់បន្ទាប់ពី ${end.count} ដង`;
}

export const INCOME_CATEGORIES = [
  { value: "salary", label: "ប្រាក់ខែ" },
  { value: "freelance", label: "ការងារឯករាជ្យ" },
  { value: "business", label: "អាជីវកម្ម" },
  { value: "gift", label: "អំណោយ" },
  { value: "other", label: "ផ្សេងៗ" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "food", label: "អាហារ" },
  { value: "transport", label: "ដឹកជញ្ជូន" },
  { value: "housing", label: "លំនៅដ្ឋាន" },
  { value: "utilities", label: "សេវាប្រើប្រាស់" },
  { value: "health", label: "សុខភាព" },
  { value: "education", label: "អប់រំ" },
  { value: "family", label: "គ្រួសារ" },
  { value: "entertainment", label: "កម្សាន្ត" },
  { value: "savings", label: "សន្សំ" },
  { value: "other", label: "ផ្សេងៗ" },
] as const;

export const GOAL_STATUSES = [
  { value: "active", label: "សកម្ម" },
  { value: "paused", label: "ផ្អាក" },
  { value: "completed", label: "បានបញ្ចប់" },
] as const;

const ACTIVITY_CATEGORY_MAP = Object.fromEntries(
  ACTIVITY_CATEGORIES.map((c) => [c.value, c.label])
);
const ACTIVITY_STATUS_MAP = Object.fromEntries(
  ACTIVITY_STATUSES.map((s) => [s.value, s.label])
);
const FINANCE_CATEGORY_MAP = Object.fromEntries(
  [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => [c.value, c.label])
);
const GOAL_STATUS_MAP = Object.fromEntries(
  GOAL_STATUSES.map((s) => [s.value, s.label])
);

export function labelActivityCategory(value: string): string {
  return ACTIVITY_CATEGORY_MAP[value] ?? value;
}

export function labelActivityStatus(value: string): string {
  return ACTIVITY_STATUS_MAP[value] ?? value;
}

export function labelFinanceCategory(value: string): string {
  return FINANCE_CATEGORY_MAP[value] ?? value;
}

export function defaultIncomeCategories(): FinanceCategoryOption[] {
  return INCOME_CATEGORIES.map((item) => ({
    id: item.value,
    label: item.label,
  }));
}

export function defaultExpenseCategories(): FinanceCategoryOption[] {
  return EXPENSE_CATEGORIES.map((item) => ({
    id: item.value,
    label: item.label,
  }));
}

export function defaultSaveCategories(): FinanceCategoryOption[] {
  const other =
    EXPENSE_CATEGORIES.find((item) => item.value === "other")?.label ?? "other";
  return [
    { id: "phone", label: "ទូរស័ព្ទ" },
    { id: "other", label: other },
  ];
}

export function normalizeFinanceCategories(
  list: unknown,
  fallback: FinanceCategoryOption[]
): FinanceCategoryOption[] {
  if (!Array.isArray(list) || list.length === 0) {
    return fallback.map((item) => ({ ...item }));
  }
  const seen = new Set<string>();
  const next: FinanceCategoryOption[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; label?: unknown; value?: unknown };
    const id = String(row.id ?? row.value ?? "").trim();
    const label = String(row.label ?? "").trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    next.push({ id, label });
  }
  return next.length ? next : fallback.map((item) => ({ ...item }));
}

export function resolveFinanceCategoryLabel(
  id: string,
  catalogs: FinanceCategoryOption[] = []
): string {
  return catalogs.find((item) => item.id === id)?.label ?? labelFinanceCategory(id);
}

export function labelGoalStatus(value: string): string {
  return GOAL_STATUS_MAP[value] ?? value;
}

export function labelTransactionType(type: "income" | "expense" | "save"): string {
  if (type === "income") return "ចំណូល";
  if (type === "save") return "សន្សំ";
  return "ចំណាយ";
}
