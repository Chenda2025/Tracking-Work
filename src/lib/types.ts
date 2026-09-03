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

export type TransactionType = "income" | "expense";

export type FinanceCategory =
  | "salary"
  | "freelance"
  | "business"
  | "gift"
  | "food"
  | "transport"
  | "housing"
  | "utilities"
  | "health"
  | "education"
  | "family"
  | "entertainment"
  | "savings"
  | "other";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: FinanceCategory;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export type GoalStatus = "active" | "completed" | "paused";

export interface FamilyGoal {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  members: string[];
  status: GoalStatus;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  notes: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm 24h; empty when allDay
  endTime?: string;
  allDay: boolean;
  repeat?: ActivityRepeat[];
  createdAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm 24h optional
  completed: boolean;
  repeat?: ActivityRepeat[];
  createdAt: string;
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
