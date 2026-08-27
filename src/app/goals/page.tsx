"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { HydrationGate } from "@/components/HydrationGate";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { useTrackingStore } from "@/lib/store";
import type { GoalStatus } from "@/lib/types";
import {
  GOAL_STATUSES,
  formatMoney,
  formatShortDate,
  goalProgress,
  labelGoalStatus,
  todayISO,
} from "@/lib/utils";

export default function GoalsPage() {
  return (
    <HydrationGate>
      <GoalsContent />
    </HydrationGate>
  );
}

function GoalsContent() {
  const goals = useTrackingStore((s) => s.goals);
  const addGoal = useTrackingStore((s) => s.addGoal);
  const contributeGoal = useTrackingStore((s) => s.contributeGoal);
  const setGoalStatus = useTrackingStore((s) => s.setGoalStatus);
  const deleteGoal = useTrackingStore((s) => s.deleteGoal);

  const [open, setOpen] = useState(false);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [targetDate, setTargetDate] = useState(todayISO());
  const [members, setMembers] = useState("");

  const sorted = useMemo(
    () =>
      [...goals].sort((a, b) => {
        const order = { active: 0, paused: 1, completed: 2 } as const;
        return order[a.status] - order[b.status];
      }),
    [goals]
  );

  const active = goals.filter((g) => g.status === "active").length;
  const completed = goals.filter((g) => g.status === "completed").length;
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  function resetForm() {
    setTitle("");
    setDescription("");
    setTargetAmount("");
    setCurrentAmount("0");
    setTargetDate(todayISO());
    setMembers("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const target = Number(targetAmount);
    if (!title.trim() || !target || target <= 0) return;
    addGoal({
      title,
      description,
      targetAmount: target,
      currentAmount: Number(currentAmount) || 0,
      targetDate,
      members: members.split(",").map((m) => m.trim()).filter(Boolean),
    });
    resetForm();
    setOpen(false);
  }

  function onContribute(e: FormEvent) {
    e.preventDefault();
    if (!contributeId) return;
    const amount = Number(contributeAmount);
    if (!amount || amount <= 0) return;
    contributeGoal(contributeId, amount);
    setContributeAmount("");
    setContributeId(null);
  }

  return (
    <div className="page">
      <PageHeader
        title="គោលដៅគ្រួសារ"
        subtitle="គោលដៅរួមរបស់គ្រួសារ — សន្សំ ចំណុចសំខាន់ និងវឌ្ឍនភាព។"
        action={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> បន្ថែមគោលដៅ
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="គោលដៅសកម្ម" value={String(active)} tone="brand" />
        <StatCard label="បានបញ្ចប់" value={String(completed)} tone="success" />
        <StatCard label="សន្សំសរុប" value={formatMoney(totalSaved)} tone="accent" />
      </div>

      <section className="surface p-4 md:p-5">
        {sorted.length === 0 ? (
          <EmptyState
            title="មិនទាន់មានគោលដៅគ្រួសារ"
            description="បង្កើតគោលដៅដូចជាមូលនិធិបន្ទាន់ ដំណើរកម្សាន្ត ឬការអប់រំ។"
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {sorted.map((goal) => {
              const progress = goalProgress(goal);
              return (
                <li
                  key={goal.id}
                  className="rounded-[14px] border border-line bg-bg-elevated p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg">{goal.title}</p>
                      {goal.description ? (
                        <p className="font-subtitle mt-1 text-sm text-ink-muted">
                          {goal.description}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`badge shrink-0 ${
                        goal.status === "completed"
                          ? "bg-success-soft text-success"
                          : goal.status === "paused"
                            ? "bg-warning-soft text-warning"
                            : "bg-brand-soft text-brand-deep"
                      }`}
                    >
                      {labelGoalStatus(goal.status)}
                    </span>
                  </div>

                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-ink-muted">វឌ្ឍនភាព</span>
                    <span className="font-semibold">{progress}%</span>
                  </div>
                  <div className="progress mb-2">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-sm text-ink-muted">
                    {formatMoney(goal.currentAmount)} នៃ{" "}
                    {formatMoney(goal.targetAmount)} · គោលដៅ{" "}
                    {formatShortDate(goal.targetDate)}
                  </p>

                  {goal.members.length > 0 ? (
                    <p className="mt-2 text-sm text-ink-soft">
                      សមាជិក៖ {goal.members.join(", ")}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setContributeId(goal.id)}
                    >
                      រួមចំណែក
                    </button>
                    <select
                      className="input w-auto py-2"
                      value={goal.status}
                      onChange={(e) =>
                        setGoalStatus(goal.id, e.target.value as GoalStatus)
                      }
                    >
                      {GOAL_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-danger btn-icon"
                      onClick={() => deleteGoal(goal.id)}
                      aria-label="លុបគោលដៅ"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal open={open} title="គោលដៅគ្រួសារថ្មី" onClose={() => setOpen(false)}>
        <form className="space-y-3.5" onSubmit={onSubmit}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">ចំណងជើងគោលដៅ</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ដំណើរកម្សាន្តគ្រួសារ / មូលនិធិបន្ទាន់"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">ពិពណ៌នា</span>
            <textarea
              className="input min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ហេតុអ្វីដែលគោលដៅនេះសំខាន់"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">ចំនួនគោលដៅ</span>
              <input
                className="input"
                type="number"
                min={1}
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">ចំនួនបច្ចុប្បន្ន</span>
              <input
                className="input"
                type="number"
                min={0}
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">កាលបរិច្ឆេទគោលដៅ</span>
              <input
                className="input"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">សមាជិក</span>
              <input
                className="input"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                placeholder="អ្នក, ដៃគូ, កូន"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              បោះបង់
            </button>
            <button type="submit" className="btn btn-primary">
              រក្សាទុកគោលដៅ
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(contributeId)}
        title="រួមចំណែកលើគោលដៅ"
        onClose={() => {
          setContributeId(null);
          setContributeAmount("");
        }}
      >
        <form className="space-y-3.5" onSubmit={onContribute}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">ចំនួនទឹកប្រាក់</span>
            <input
              className="input"
              type="number"
              min={1}
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              placeholder="100"
              required
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setContributeId(null);
                setContributeAmount("");
              }}
            >
              បោះបង់
            </button>
            <button type="submit" className="btn btn-primary">
              បន្ថែមការរួមចំណែក
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
