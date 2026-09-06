export type ActivityCategory =
  | "work"
  | "personal"
  | "health"
  | "learning"
  | "family"
  | "other";

export type ActivityStatus = "planned" | "in_progress" | "done";

export type ActivityRepeat =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type FolderColor =
  | "teal"
  | "blue"
  | "green"
  | "amber"
  | "coral"
  | "slate";

export type FolderPriority = "high" | "medium" | "low";

export interface ActivityFolder {
  id: string;
  name: string;
  parentId: string | null;
  color?: FolderColor;
  priority?: FolderPriority;
}

export interface Activity {
  id: string;
  title: string;
  location?: string;
  notes: string;
  category: ActivityCategory;
  folderId: string | null;
  status: ActivityStatus;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm 24h
  durationMinutes: number;
  repeat?: ActivityRepeat[];
  createdAt: string;
}

export type TransactionType = "income" | "expense" | "save";

export type FinanceCatalogKind = TransactionType;

export type MoneyCurrency = "USD" | "KHR";

export type FinanceCategory = string;

export interface FinanceCategoryOption {
  id: string;
  label: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: MoneyCurrency;
  category: FinanceCategory;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export type GoalStatus = "active" | "completed" | "paused";

export interface GoalContribution {
  id: string;
  amount: number;
  currency: MoneyCurrency;
  date: string;
}

export interface FamilyGoal {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  currentKhr: number;
  currentUsd: number;
  currency: MoneyCurrency;
  startDate: string;
  targetDate: string;
  members: string[];
  contributions: GoalContribution[];
  status: GoalStatus;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  notes: string;
  date: string; // YYYY-MM-DD start
  endDate: string; // YYYY-MM-DD end
  startTime?: string; // HH:mm 24h; empty when allDay
  endTime?: string;
  allDay: boolean;
  folderId: string | null;
  /** @deprecated legacy weekday chips — prefer repeatFrequency */
  repeat?: ActivityRepeat[];
  travelTime: EventTravelTime;
  repeatFrequency: EventRepeatFrequency;
  endRepeat: EventEndRepeat;
  alert: EventAlert;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export type EventTravelTime =
  | "none"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "1h30"
  | "2h";

export type EventRepeatFrequency =
  | "never"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly";

export type EventEndRepeat =
  | { type: "never" }
  | { type: "on_date"; date: string }
  | { type: "after"; count: number };

export type EventAlert =
  | "none"
  | "at_time"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "1d"
  | "2d"
  | "1w";

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm 24h optional
  completed: boolean;
  repeat?: ActivityRepeat[];
  alert?: EventAlert;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  username: string;
  password: string;
  photo?: string;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  enabled: boolean;
  sendTime: string;
  eveningTime: string;
  lastAutoSentDate?: string;
  lastEveningSentDate?: string;
  autoSentEventDate?: string;
  autoSentEventIds?: string[];
}

export interface AppState {
  activities: Activity[];
  transactions: Transaction[];
  goals: FamilyGoal[];
  activityFolders: ActivityFolder[];
  events: CalendarEvent[];
  reminders: Reminder[];
  hydrated: boolean;
}
