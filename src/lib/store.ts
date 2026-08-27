"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Activity,
  ActivityCategory,
  ActivityFolder,
  ActivityRepeat,
  ActivityStatus,
  FamilyGoal,
  FinanceCategory,
  FolderColor,
  FolderPriority,
  GoalStatus,
  Transaction,
  TransactionType,
} from "./types";
import { todayISO, uid, normalizeRepeatDays } from "./utils";

interface TrackingStore {
  activities: Activity[];
  transactions: Transaction[];
  goals: FamilyGoal[];
  activityFolders: ActivityFolder[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;

  addActivity: (input: {
    title: string;
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
    category: FinanceCategory;
    note?: string;
    date?: string;
  }) => void;
  updateTransaction: (
    id: string,
    patch: Partial<Omit<Transaction, "id" | "createdAt">>
  ) => void;
  deleteTransaction: (id: string) => void;

  addGoal: (input: {
    title: string;
    description?: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate: string;
    members?: string[];
  }) => void;
  updateGoal: (id: string, patch: Partial<Omit<FamilyGoal, "id" | "createdAt">>) => void;
  contributeGoal: (id: string, amount: number) => void;
  deleteGoal: (id: string) => void;
  setGoalStatus: (id: string, status: GoalStatus) => void;
}

export const useTrackingStore = create<TrackingStore>()(
  persist(
    (set, get) => ({
      activities: [],
      transactions: [],
      goals: [],
      activityFolders: [],
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),

      addActivity: (input) => {
        const activity: Activity = {
          id: uid(),
          title: input.title.trim(),
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
          category: input.category,
          note: input.note?.trim() ?? "",
          date: input.date ?? todayISO(),
          createdAt: new Date().toISOString(),
        };
        set({ transactions: [transaction, ...get().transactions] });
      },

      updateTransaction: (id, patch) => {
        set({
          transactions: get().transactions.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        });
      },

      deleteTransaction: (id) => {
        set({
          transactions: get().transactions.filter((item) => item.id !== id),
        });
      },

      addGoal: (input) => {
        const goal: FamilyGoal = {
          id: uid(),
          title: input.title.trim(),
          description: input.description?.trim() ?? "",
          targetAmount: Math.max(0, Number(input.targetAmount) || 0),
          currentAmount: Math.max(0, Number(input.currentAmount) || 0),
          targetDate: input.targetDate,
          members: input.members?.map((m) => m.trim()).filter(Boolean) ?? [],
          status: "active",
          createdAt: new Date().toISOString(),
        };
        set({ goals: [goal, ...get().goals] });
      },

      updateGoal: (id, patch) => {
        set({
          goals: get().goals.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        });
      },

      contributeGoal: (id, amount) => {
        const value = Math.max(0, Number(amount) || 0);
        set({
          goals: get().goals.map((item) => {
            if (item.id !== id) return item;
            const currentAmount = item.currentAmount + value;
            const status =
              currentAmount >= item.targetAmount ? "completed" : item.status;
            return { ...item, currentAmount, status };
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
    }),
    {
      name: "steady-personal-tracking",
      partialize: (state) => ({
        activities: state.activities,
        transactions: state.transactions,
        goals: state.goals,
        activityFolders: state.activityFolders,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TrackingStore>;
        return {
          ...current,
          ...p,
          activities: (p.activities ?? []).map((a) => ({
            ...a,
            folderId: a.folderId ?? null,
            category: (a.category as ActivityCategory) || "work",
            repeat: normalizeRepeatDays(
              a.repeat as ActivityRepeat[] | ActivityRepeat | "none" | undefined
            ),
          })),
          activityFolders: (p.activityFolders ?? []).map((f) => ({
            ...f,
            parentId: f.parentId ?? null,
          })),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
