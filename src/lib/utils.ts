import { format, isToday, parseISO, startOfMonth, endOfMonth, isWithinInterval, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { km } from "date-fns/locale";
import type {
  Activity,
  ActivityFolder,
  ActivityRepeat,
  CalendarEvent,
  FamilyGoal,
  FolderColor,
  FolderPriority,
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

export function formatClock(time?: string): string {
  if (!time) return "";
  const { hour12, minute, period } = splitClock(time);
  return `${hour12}:${pad2(minute)} ${period === "am" ? "ព្រឹក" : "ល្ងាច"}`;
}

export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("km-KH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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
    .filter((e) => occursOnDate(dateISO, e.date, e.repeat))
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

export function filterThisMonth<T extends { date: string }>(items: T[]): T[] {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  return items.filter((item) => {
    try {
      return isWithinInterval(parseISO(item.date), { start, end });
    } catch {
      return false;
    }
  });
}

export function sumIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
}

export function sumExpense(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
}

export function goalProgress(goal: FamilyGoal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
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

export function labelGoalStatus(value: string): string {
  return GOAL_STATUS_MAP[value] ?? value;
}

export function labelTransactionType(type: "income" | "expense"): string {
  return type === "income" ? "ចំណូល" : "ចំណាយ";
}
