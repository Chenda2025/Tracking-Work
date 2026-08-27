import { format, isToday, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { km } from "date-fns/locale";
import type {
  Activity,
  ActivityFolder,
  FamilyGoal,
  FolderColor,
  FolderPriority,
  Transaction,
} from "./types";

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
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
