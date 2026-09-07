"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Activity,
  ActivityCategory,
  ActivityFolder,
  ActivityRepeat,
  ActivityStatus,
  CalendarEvent,
  EventAlert,
  EventEndRepeat,
  EventRepeatFrequency,
  EventTravelTime,
  FamilyGoal,
  FinanceCatalogKind,
  FinanceCategory,
  FinanceCategoryOption,
  FolderColor,
  FolderPriority,
  GoalStatus,
  MoneyCurrency,
  Reminder,
  TelegramSettings,
  Transaction,
  TransactionType,
  UserProfile,
} from "./types";
import {
  todayISO,
  uid,
  normalizeRepeatDays,
  normalizeEventAlert,
  normalizeEventEndRepeat,
  normalizeEventRepeatFrequency,
  normalizeEventTravelTime,
  normalizeSendTime,
  normalizeMoneyCurrency,
  normalizeGoalDates,
  withGoalCurrents,
  goalIsReached,
  normalizeGoalContributions,
  seedGoalContributions,
  clampDateToGoalRange,
  defaultIncomeCategories,
  defaultExpenseCategories,
  defaultSaveCategories,
  normalizeFinanceCategories,
} from "./utils";
import { buildDemoFinanceTransactions } from "./seedFinance";

function catalogKey(
  kind: FinanceCatalogKind
): "incomeCategories" | "expenseCategories" | "saveCategories" {
  if (kind === "income") return "incomeCategories";
  if (kind === "save") return "saveCategories";
  return "expenseCategories";
}

type AccountSnapshot = {
  profile: UserProfile;
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

type WorkspaceData = Omit<AccountSnapshot, "profile">;

function accountKey(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

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

function emptyWorkspace(): WorkspaceData {
  return {
    activities: [],
    transactions: [],
    goals: [],
    activityFolders: [],
    events: [],
    reminders: [],
    incomeCategories: defaultIncomeCategories(),
    expenseCategories: defaultExpenseCategories(),
    saveCategories: defaultSaveCategories(),
    telegramSettings: emptyTelegram(),
  };
}

function normalizeProfile(value?: Partial<UserProfile> | null): UserProfile | null {
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  if (!name) return null;
  const username =
    typeof value?.username === "string" && value.username.trim()
      ? value.username.trim()
      : name;
  return {
    name,
    username,
    password: typeof value?.password === "string" ? value.password : "",
    ...(typeof value?.photo === "string" && value.photo
      ? { photo: value.photo }
      : {}),
  };
}

function snapshotWorkspace(
  state: Pick<
    TrackingStore,
    | "activities"
    | "transactions"
    | "goals"
    | "activityFolders"
    | "events"
    | "reminders"
    | "incomeCategories"
    | "expenseCategories"
    | "saveCategories"
    | "telegramSettings"
  >
): WorkspaceData {
  return {
    activities: state.activities,
    transactions: state.transactions,
    goals: state.goals,
    activityFolders: state.activityFolders,
    events: state.events,
    reminders: state.reminders,
    incomeCategories: state.incomeCategories,
    expenseCategories: state.expenseCategories,
    saveCategories: state.saveCategories,
    telegramSettings: state.telegramSettings,
  };
}

function normalizeWorkspace(
  p: Partial<WorkspaceData> | Partial<TrackingStore>,
  allowDemo: boolean
): WorkspaceData {
  const existing = (p.transactions ?? []).map((t) => ({
    ...t,
    currency: normalizeMoneyCurrency(t.currency),
  }));
  const hasDemo = existing.some((t) => String(t.id).startsWith("demo-tx-"));
  const transactions =
    allowDemo && !hasDemo
      ? [...buildDemoFinanceTransactions(100), ...existing]
      : existing;

  return {
    activities: (p.activities ?? []).map((a) => ({
      ...a,
      folderId: a.folderId ?? null,
      category: (a.category as ActivityCategory) || "work",
      repeat: normalizeRepeatDays(
        a.repeat as ActivityRepeat[] | ActivityRepeat | "none" | undefined
      ),
    })),
    transactions,
    goals: (p.goals ?? []).map((g) => {
      const dates = normalizeGoalDates({
        startDate: g.startDate,
        targetDate: g.targetDate,
        createdAt: g.createdAt,
      });
      const currency = normalizeMoneyCurrency(g.currency);
      const currents = withGoalCurrents({
        currency,
        currentAmount: g.currentAmount,
        currentKhr: g.currentKhr,
        currentUsd: g.currentUsd,
      });
      return {
        ...g,
        description: g.description ?? "",
        targetAmount: Math.max(0, Number(g.targetAmount) || 0),
        currentAmount: currents.currentAmount,
        currentKhr: currents.currentKhr,
        currentUsd: currents.currentUsd,
        currency,
        startDate: dates.startDate,
        targetDate: dates.targetDate,
        contributions: (() => {
          const existingContrib = normalizeGoalContributions(g.contributions);
          if (existingContrib.length) return existingContrib;
          return seedGoalContributions(currents, dates.startDate);
        })(),
        members: Array.isArray(g.members)
          ? g.members.map((m) => String(m).trim()).filter(Boolean)
          : [],
        status:
          g.status === "completed" || g.status === "paused" ? g.status : "active",
      };
    }),
    activityFolders: (p.activityFolders ?? []).map((f) => ({
      ...f,
      parentId: f.parentId ?? null,
    })),
    events: (p.events ?? []).map((e) => {
      const date = e.date || todayISO();
      const legacyDays = normalizeRepeatDays(
        e.repeat as ActivityRepeat[] | ActivityRepeat | "none" | undefined
      );
      return {
        ...e,
        location: e.location ?? "",
        notes: e.notes ?? "",
        allDay: Boolean(e.allDay),
        endDate: e.endDate && e.endDate >= date ? e.endDate : date,
        startTime: e.startTime ?? "",
        endTime: e.endTime ?? "",
        folderId: e.folderId ?? null,
        repeat: legacyDays,
        travelTime: normalizeEventTravelTime(e.travelTime),
        repeatFrequency: normalizeEventRepeatFrequency(
          e.repeatFrequency ?? (legacyDays.length ? "weekly" : "never")
        ),
        endRepeat: normalizeEventEndRepeat(e.endRepeat, date),
        alert: normalizeEventAlert(e.alert),
        completed: Boolean(e.completed),
        completedAt: e.completedAt,
      };
    }),
    reminders: (p.reminders ?? []).map((r) => ({
      ...r,
      notes: r.notes ?? "",
      dueTime: r.dueTime ?? "",
      completed: Boolean(r.completed),
      repeat: normalizeRepeatDays(
        r.repeat as ActivityRepeat[] | ActivityRepeat | "none" | undefined
      ),
      alert: normalizeEventAlert(r.alert),
    })),
    incomeCategories: normalizeFinanceCategories(
      p.incomeCategories,
      defaultIncomeCategories()
    ),
    expenseCategories: normalizeFinanceCategories(
      p.expenseCategories,
      defaultExpenseCategories()
    ),
    saveCategories: normalizeFinanceCategories(
      p.saveCategories,
      defaultSaveCategories()
    ),
    telegramSettings: {
      botToken: p.telegramSettings?.botToken?.trim() ?? "",
      chatId: p.telegramSettings?.chatId?.trim() ?? "",
      enabled: Boolean(p.telegramSettings?.enabled),
      sendTime: normalizeSendTime(p.telegramSettings?.sendTime),
      eveningTime: normalizeSendTime(
        p.telegramSettings?.eveningTime,
        "18:00"
      ),
      lastAutoSentDate: p.telegramSettings?.lastAutoSentDate ?? "",
      lastEveningSentDate: p.telegramSettings?.lastEveningSentDate ?? "",
      autoSentEventDate: p.telegramSettings?.autoSentEventDate ?? "",
      autoSentEventIds: Array.isArray(p.telegramSettings?.autoSentEventIds)
        ? p.telegramSettings.autoSentEventIds.filter(
            (id): id is string => typeof id === "string" && id.length > 0
          )
        : [],
    },
  };
}

function findAccount(
  accounts: Record<string, AccountSnapshot>,
  username: string
): AccountSnapshot | undefined {
  const key = accountKey(username);
  if (accounts[key]) return accounts[key];
  return Object.values(accounts).find((item) => {
    const user = accountKey(item.profile.username);
    const name = accountKey(item.profile.name);
    return user === key || name === key;
  });
}

function withSavedAccount(
  state: TrackingStore,
  accounts = { ...state.accounts }
): Record<string, AccountSnapshot> {
  if (!state.profile) return accounts;
  const key = accountKey(state.profile.username || state.profile.name);
  if (!key) return accounts;
  accounts[key] = {
    profile: state.profile,
    ...snapshotWorkspace(state),
  };
  return accounts;
}

interface TrackingStore {
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
  profile: UserProfile | null;
  accounts: Record<string, AccountSnapshot>;
  signedIn: boolean;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setTelegramSettings: (patch: Partial<TelegramSettings>) => void;
  setProfile: (patch: Partial<UserProfile>) => void;
  clearProfile: () => void;
  login: (username: string, password: string) => string | null;
  signUp: (input: {
    name: string;
    username: string;
    password: string;
  }) => string | null;
  signOut: () => void;

  addActivity: (input: {
    title: string;
    location?: string;
    notes?: string;
    category: ActivityCategory;
    folderId?: string | null;
    status?: ActivityStatus;
    date?: string;
    startTime?: string;
    durationMinutes?: number;
    repeat?: ActivityRepeat[];
  }) => void;
  updateActivity: (id: string, patch: Partial<Omit<Activity, "id" | "createdAt">>) => void;
  deleteActivity: (id: string) => void;

  addActivityFolder: (
    name: string,
    parentId?: string | null,
    options?: { color?: FolderColor; priority?: FolderPriority }
  ) => string | null;
  updateActivityFolder: (
    id: string,
    name: string,
    options?: { color?: FolderColor; priority?: FolderPriority }
  ) => boolean;
  deleteActivityFolder: (id: string) => void;

  addTransaction: (input: {
    type: TransactionType;
    amount: number;
    currency?: MoneyCurrency;
    category: FinanceCategory;
    note?: string;
    date?: string;
  }) => void;
  updateTransaction: (
    id: string,
    patch: Partial<Omit<Transaction, "id" | "createdAt">>
  ) => void;
  deleteTransaction: (id: string) => void;
  addFinanceCategory: (kind: FinanceCatalogKind, label: string) => string | null;
  updateFinanceCategory: (
    kind: FinanceCatalogKind,
    id: string,
    label: string
  ) => boolean;
  deleteFinanceCategory: (kind: FinanceCatalogKind, id: string) => boolean;

  addGoal: (input: {
    title: string;
    description?: string;
    targetAmount: number;
    currentAmount?: number;
    currency?: MoneyCurrency;
    startDate: string;
    targetDate: string;
    members?: string[];
  }) => void;
  updateGoal: (id: string, patch: Partial<Omit<FamilyGoal, "id" | "createdAt">>) => void;
  contributeGoal: (
    id: string,
    amount: number,
    currency?: MoneyCurrency,
    date?: string
  ) => void;
  deleteGoal: (id: string) => void;
  setGoalStatus: (id: string, status: GoalStatus) => void;

  addEvent: (input: {
    title: string;
    location?: string;
    notes?: string;
    date?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    folderId?: string | null;
    travelTime?: EventTravelTime;
    repeatFrequency?: EventRepeatFrequency;
    endRepeat?: EventEndRepeat;
    alert?: EventAlert;
  }) => void;
  updateEvent: (id: string, patch: Partial<Omit<CalendarEvent, "id" | "createdAt">>) => void;
  setEventCompleted: (id: string, completed: boolean) => void;
  deleteEvent: (id: string) => void;

  addReminder: (input: {
    title: string;
    notes?: string;
    dueDate?: string;
    dueTime?: string;
    repeat?: ActivityRepeat[];
    alert?: EventAlert;
  }) => void;
  updateReminder: (id: string, patch: Partial<Omit<Reminder, "id" | "createdAt">>) => void;
  toggleReminder: (id: string) => void;
  deleteReminder: (id: string) => void;
}

export const useTrackingStore = create<TrackingStore>()(
  persist(
    (set, get) => ({
      activities: [],
      transactions: [],
      goals: [],
      activityFolders: [],
      events: [],
      reminders: [],
      incomeCategories: defaultIncomeCategories(),
      expenseCategories: defaultExpenseCategories(),
      saveCategories: defaultSaveCategories(),
      telegramSettings: emptyTelegram(),
      profile: null,
      accounts: {},
      signedIn: false,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      setProfile: (patch) => {
        const current = get().profile;
        const name = (patch.name ?? current?.name ?? "").trim();
        if (!name) {
          get().signOut();
          return;
        }
        const oldKey = accountKey(current?.username || current?.name);
        const username = (patch.username ?? current?.username ?? "").trim();
        const password =
          patch.password !== undefined
            ? patch.password
            : current?.password ?? "";
        const photo =
          patch.photo !== undefined ? patch.photo : current?.photo;
        const profile: UserProfile = {
          name,
          username,
          password,
          ...(photo ? { photo } : {}),
        };
        const newKey = accountKey(profile.username || profile.name);
        const accounts = { ...get().accounts };
        if (oldKey && newKey && oldKey !== newKey) {
          if (accounts[newKey]) return;
          if (accounts[oldKey]) {
            accounts[newKey] = { ...accounts[oldKey], profile };
            delete accounts[oldKey];
          }
        }
        set({
          profile,
          signedIn: true,
          accounts,
        });
      },
      clearProfile: () => get().signOut(),
      signOut: () => {
        const accounts = withSavedAccount(get());
        set({
          ...emptyWorkspace(),
          profile: null,
          signedIn: false,
          accounts,
        });
      },
      signUp: ({ name, username, password }) => {
        const nextName = name.trim();
        const nextUser = username.trim();
        if (!nextName) return "បញ្ចូលឈ្មោះ";
        if (!nextUser) return "បញ្ចូលឈ្មោះអ្នកប្រើ";
        if (!password.trim()) return "បញ្ចូលពាក្យសម្ងាត់";
        const key = accountKey(nextUser);
        const accounts = withSavedAccount(get());
        if (findAccount(accounts, nextUser)) {
          return "មានគណនីរួចហើយ — សូមចូល";
        }
        const profile: UserProfile = {
          name: nextName,
          username: nextUser,
          password,
        };
        const workspace = emptyWorkspace();
        accounts[key] = { profile, ...workspace };
        set({
          ...workspace,
          profile,
          signedIn: true,
          accounts,
        });
        return null;
      },
      login: (username, password) => {
        const nextUser = username.trim();
        if (!nextUser) return "បញ្ចូលឈ្មោះអ្នកប្រើ";
        if (!password.trim()) return "បញ្ចូលពាក្យសម្ងាត់";
        const accounts = withSavedAccount(get());
        const existing = findAccount(accounts, nextUser);
        if (!existing) return "មិនទាន់មានគណនី — សូមបង្កើតគណនី";
        const storedUser = (
          existing.profile.username ||
          existing.profile.name ||
          ""
        ).trim();
        if (
          accountKey(storedUser) !== accountKey(nextUser) ||
          existing.profile.password !== password
        ) {
          return "ឈ្មោះអ្នកប្រើ ឬ ពាក្យសម្ងាត់មិនត្រូវ";
        }
        const profile = existing.profile.username
          ? existing.profile
          : { ...existing.profile, username: nextUser };
        const key = accountKey(profile.username || profile.name);
        const workspace = normalizeWorkspace(existing, false);
        accounts[key] = { profile, ...workspace };
        set({
          ...workspace,
          profile,
          signedIn: true,
          accounts,
        });
        return null;
      },

      setTelegramSettings: (patch) => {
        const current = get().telegramSettings;
        set({
          telegramSettings: {
            ...current,
            ...patch,
            botToken: (patch.botToken ?? current.botToken).trim(),
            chatId: (patch.chatId ?? current.chatId).trim(),
            sendTime: normalizeSendTime(patch.sendTime ?? current.sendTime),
            eveningTime: normalizeSendTime(
              patch.eveningTime ?? current.eveningTime,
              "18:00"
            ),
          },
        });
      },

      addActivity: (input) => {
        const activity: Activity = {
          id: uid(),
          title: input.title.trim(),
          location: input.location?.trim() ?? "",
          notes: input.notes?.trim() ?? "",
          category: input.category,
          folderId: input.folderId ?? null,
          status: input.status ?? "planned",
          date: input.date ?? todayISO(),
          startTime: input.startTime ?? "",
          durationMinutes: input.durationMinutes ?? 0,
          repeat: input.repeat ?? [],
          createdAt: new Date().toISOString(),
        };
        set({ activities: [activity, ...get().activities] });
      },

      updateActivity: (id, patch) => {
        set({
          activities: get().activities.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        });
      },

      deleteActivity: (id) => {
        set({ activities: get().activities.filter((item) => item.id !== id) });
      },

      addActivityFolder: (name, parentId = null, options) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const parent = parentId ? String(parentId) : null;
        const folders = get().activityFolders.map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
          color: f.color ?? "teal",
          priority: f.priority ?? "medium",
        }));
        if (parent && !folders.some((f) => f.id === parent)) {
          return null;
        }
        const exists = folders.some(
          (f) =>
            (f.parentId ?? null) === parent &&
            f.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) return null;
        const folder: ActivityFolder = {
          id: uid(),
          name: trimmed,
          parentId: parent,
          color: options?.color ?? "teal",
          priority: options?.priority ?? "medium",
        };
        set({ activityFolders: [...folders, folder] });
        return folder.id;
      },

      updateActivityFolder: (id, name, options) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        const current = get().activityFolders.find((f) => f.id === id);
        if (!current) return false;
        const parent = current.parentId ?? null;
        const duplicate = get().activityFolders.some(
          (f) =>
            f.id !== id &&
            (f.parentId ?? null) === parent &&
            f.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (duplicate) return false;
        set({
          activityFolders: get().activityFolders.map((f) =>
            f.id === id
              ? {
                  ...f,
                  name: trimmed,
                  color: options?.color ?? f.color ?? "teal",
                  priority: options?.priority ?? f.priority ?? "medium",
                }
              : f
          ),
        });
        return true;
      },

      deleteActivityFolder: (id) => {
        const folders = get().activityFolders;
        const removeIds = new Set<string>([id]);
        const queue = [id];
        while (queue.length) {
          const current = queue.shift()!;
          for (const child of folders) {
            if ((child.parentId ?? null) === current && !removeIds.has(child.id)) {
              removeIds.add(child.id);
              queue.push(child.id);
            }
          }
        }
        const parentOfDeleted =
          folders.find((f) => f.id === id)?.parentId ?? null;
        set({
          activityFolders: folders.filter((f) => !removeIds.has(f.id)),
          activities: get().activities.map((a) =>
            a.folderId && removeIds.has(a.folderId)
              ? { ...a, folderId: parentOfDeleted }
              : a
          ),
        });
      },

      addTransaction: (input) => {
        const transaction: Transaction = {
          id: uid(),
          type: input.type,
          amount: Math.max(0, Number(input.amount) || 0),
          currency: normalizeMoneyCurrency(input.currency ?? "KHR"),
          category: input.category,
          note: input.note?.trim() ?? "",
          date: input.date ?? todayISO(),
          createdAt: new Date().toISOString(),
        };
        set({ transactions: [transaction, ...get().transactions] });
      },

      updateTransaction: (id, patch) => {
        set({
          transactions: get().transactions.map((item) => {
            if (item.id !== id) return item;
            const next = { ...item, ...patch };
            return {
              ...next,
              note: (patch.note ?? next.note).trim(),
              amount: Math.max(0, Number(patch.amount ?? next.amount) || 0),
              currency: normalizeMoneyCurrency(patch.currency ?? next.currency),
              date: patch.date ?? next.date,
            };
          }),
        });
      },

      deleteTransaction: (id) => {
        set({
          transactions: get().transactions.filter((item) => item.id !== id),
        });
      },

      addFinanceCategory: (kind, label) => {
        const name = label.trim();
        if (!name) return null;
        const key = catalogKey(kind);
        const current = get()[key];
        if (current.some((item) => item.label === name)) {
          return current.find((item) => item.label === name)?.id ?? null;
        }
        const option: FinanceCategoryOption = {
          id: `cat-${uid()}`,
          label: name,
        };
        set({ [key]: [...current, option] });
        return option.id;
      },

      updateFinanceCategory: (kind, id, label) => {
        const name = label.trim();
        if (!name || id === "savings") return false;
        const key = catalogKey(kind);
        const current = get()[key];
        if (!current.some((item) => item.id === id)) return false;
        set({
          [key]: current.map((item) =>
            item.id === id ? { ...item, label: name } : item
          ),
        });
        return true;
      },

      deleteFinanceCategory: (kind, id) => {
        if (id === "savings" || id === "other") return false;
        const key = catalogKey(kind);
        const current = get()[key];
        const next = current.filter((item) => item.id !== id);
        if (next.length === current.length || next.length === 0) return false;
        const fallback =
          next.find((item) => item.id === "other")?.id ?? next[0].id;
        set({
          [key]: next,
          transactions: get().transactions.map((item) =>
            item.type === kind && item.category === id
              ? { ...item, category: fallback }
              : item
          ),
        });
        return true;
      },

      addGoal: (input) => {
        const dates = normalizeGoalDates({
          startDate: input.startDate,
          targetDate: input.targetDate,
        });
        const currency = normalizeMoneyCurrency(input.currency ?? "KHR");
        const entered = Math.max(0, Number(input.currentAmount) || 0);
        const currents = withGoalCurrents({
          currency,
          currentKhr: currency === "KHR" ? entered : 0,
          currentUsd: currency === "USD" ? entered : 0,
        });
        const goal: FamilyGoal = {
          id: uid(),
          title: input.title.trim(),
          description: input.description?.trim() ?? "",
          targetAmount: Math.max(0, Number(input.targetAmount) || 0),
          currentAmount: currents.currentAmount,
          currentKhr: currents.currentKhr,
          currentUsd: currents.currentUsd,
          currency,
          startDate: dates.startDate,
          targetDate: dates.targetDate,
          members: input.members?.map((m) => m.trim()).filter(Boolean) ?? [],
          contributions: seedGoalContributions(currents, dates.startDate),
          status: "active",
          createdAt: new Date().toISOString(),
        };
        set({ goals: [goal, ...get().goals] });
      },

      updateGoal: (id, patch) => {
        set({
          goals: get().goals.map((item) => {
            if (item.id !== id) return item;
            const next = { ...item, ...patch };
            const dates = normalizeGoalDates({
              startDate: next.startDate,
              targetDate: next.targetDate,
              createdAt: next.createdAt,
            });
            const currency = normalizeMoneyCurrency(
              patch.currency ?? next.currency
            );
            const existing = withGoalCurrents(item);
            const enteredCurrent = Math.max(
              0,
              Number(patch.currentAmount ?? next.currentAmount) || 0
            );
            const currents = withGoalCurrents({
              currency,
              currentKhr:
                patch.currentKhr ??
                (currency === "KHR" ? enteredCurrent : existing.currentKhr),
              currentUsd:
                patch.currentUsd ??
                (currency === "USD" ? enteredCurrent : existing.currentUsd),
            });
            const existingContributions = normalizeGoalContributions(
              next.contributions ?? item.contributions
            );
            const extras = seedGoalContributions(
              {
                currentKhr: Math.max(
                  0,
                  currents.currentKhr - existing.currentKhr
                ),
                currentUsd: Math.max(
                  0,
                  currents.currentUsd - existing.currentUsd
                ),
              },
              dates.startDate
            );
            const updated: FamilyGoal = {
              ...next,
              title: (patch.title ?? next.title).trim(),
              description: (patch.description ?? next.description).trim(),
              targetAmount: Math.max(
                0,
                Number(patch.targetAmount ?? next.targetAmount) || 0
              ),
              currentAmount: currents.currentAmount,
              currentKhr: currents.currentKhr,
              currentUsd: currents.currentUsd,
              currency,
              startDate: dates.startDate,
              targetDate: dates.targetDate,
              members: (patch.members ?? next.members)
                .map((m) => m.trim())
                .filter(Boolean),
              contributions: [...existingContributions, ...extras],
            };
            return {
              ...updated,
              status: goalIsReached(updated)
                ? "completed"
                : updated.status,
            };
          }),
        });
      },

      contributeGoal: (id, amount, currency, date) => {
        const value = Math.max(0, Number(amount) || 0);
        set({
          goals: get().goals.map((item) => {
            if (item.id !== id) return item;
            const existing = withGoalCurrents(item);
            const kind = normalizeMoneyCurrency(currency ?? item.currency);
            const currents = withGoalCurrents({
              currency: item.currency,
              currentKhr:
                existing.currentKhr + (kind === "KHR" ? value : 0),
              currentUsd:
                existing.currentUsd + (kind === "USD" ? value : 0),
            });
            const next = {
              ...item,
              ...currents,
              contributions: [
                ...normalizeGoalContributions(item.contributions),
                {
                  id: uid(),
                  amount: value,
                  currency: kind,
                  date: clampDateToGoalRange(date || todayISO(), item),
                },
              ],
            };
            return {
              ...next,
              status: goalIsReached(next) ? "completed" : item.status,
            };
          }),
        });
      },

      deleteGoal: (id) => {
        set({ goals: get().goals.filter((item) => item.id !== id) });
      },

      setGoalStatus: (id, status) => {
        set({
          goals: get().goals.map((item) =>
            item.id === id ? { ...item, status } : item
          ),
        });
      },

      addEvent: (input) => {
        const allDay = Boolean(input.allDay);
        const date = input.date ?? todayISO();
        const endDate = input.endDate && input.endDate >= date ? input.endDate : date;
        const event: CalendarEvent = {
          id: uid(),
          title: input.title.trim(),
          location: input.location?.trim() ?? "",
          notes: input.notes?.trim() ?? "",
          date,
          endDate,
          startTime: allDay ? "" : input.startTime ?? "",
          endTime: allDay ? "" : input.endTime ?? "",
          allDay,
          folderId: input.folderId ? String(input.folderId) : null,
          repeat: [],
          travelTime: normalizeEventTravelTime(input.travelTime),
          repeatFrequency: normalizeEventRepeatFrequency(input.repeatFrequency),
          endRepeat: normalizeEventEndRepeat(input.endRepeat, date),
          alert: normalizeEventAlert(input.alert),
          completed: false,
          createdAt: new Date().toISOString(),
        };
        set({ events: [event, ...get().events] });
      },

      updateEvent: (id, patch) => {
        set({
          events: get().events.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        });
      },

      setEventCompleted: (id, completed) => {
        set({
          events: get().events.map((item) =>
            item.id === id
              ? {
                  ...item,
                  completed,
                  completedAt: completed ? new Date().toISOString() : undefined,
                }
              : item
          ),
        });
      },

      deleteEvent: (id) => {
        set({ events: get().events.filter((item) => item.id !== id) });
      },

      addReminder: (input) => {
        const reminder: Reminder = {
          id: uid(),
          title: input.title.trim(),
          notes: input.notes?.trim() ?? "",
          dueDate: input.dueDate ?? todayISO(),
          dueTime: input.dueTime ?? "",
          completed: false,
          repeat: input.repeat ?? [],
          alert: normalizeEventAlert(input.alert),
          createdAt: new Date().toISOString(),
        };
        set({ reminders: [reminder, ...get().reminders] });
      },

      updateReminder: (id, patch) => {
        set({
          reminders: get().reminders.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        });
      },

      toggleReminder: (id) => {
        set({
          reminders: get().reminders.map((item) =>
            item.id === id ? { ...item, completed: !item.completed } : item
          ),
        });
      },

      deleteReminder: (id) => {
        set({ reminders: get().reminders.filter((item) => item.id !== id) });
      },
    }),
    {
      name: "steady-personal-tracking",
      partialize: (state) => {
        const accounts = withSavedAccount(state);
        return {
          accounts,
          signedIn: state.signedIn,
          profile: state.profile,
        };
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TrackingStore> & {
          accounts?: Record<string, AccountSnapshot>;
          activeAccount?: string | null;
        };
        const accounts: Record<string, AccountSnapshot> = {};
        const rawAccounts =
          p.accounts && typeof p.accounts === "object" ? p.accounts : {};

        for (const [rawKey, rec] of Object.entries(rawAccounts)) {
          const profile = normalizeProfile(rec?.profile);
          if (!profile) continue;
          const key = accountKey(profile.username || profile.name || rawKey);
          accounts[key] = {
            profile,
            ...normalizeWorkspace(rec, false),
          };
        }

        const legacyProfile = normalizeProfile(p.profile);
        if (legacyProfile && Object.keys(accounts).length === 0) {
          const key = accountKey(legacyProfile.username || legacyProfile.name);
          accounts[key] = {
            profile: legacyProfile,
            ...normalizeWorkspace(p, true),
          };
        }

        const activeKey = accountKey(
          p.activeAccount || legacyProfile?.username || legacyProfile?.name
        );
        const signedIn =
          p.signedIn === true ||
          (p.signedIn == null && Boolean(legacyProfile));
        const active =
          signedIn && activeKey ? accounts[activeKey] ?? findAccount(accounts, activeKey) : undefined;

        if (active) {
          const workspace = normalizeWorkspace(active, false);
          return {
            ...current,
            ...workspace,
            profile: active.profile,
            accounts,
            signedIn: true,
          };
        }

        return {
          ...current,
          ...emptyWorkspace(),
          profile: null,
          accounts,
          signedIn: false,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
