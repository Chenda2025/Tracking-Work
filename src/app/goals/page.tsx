"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Send, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { HydrationGate } from "@/components/HydrationGate";
import { DatePickerField } from "@/components/DatePicker";
import { Modal } from "@/components/Modal";
import { TelegramConfigModal } from "@/components/TelegramConfigModal";
import { useTrackingStore } from "@/lib/store";
import { buildGoalsReport, sendTelegramMessage } from "@/lib/telegramDaily";
import type { FamilyGoal, GoalStatus, MoneyCurrency } from "@/lib/types";
import {
  GOAL_STATUSES,
  REPORT_RANGES,
  clampDateToGoalRange,
  formatGoalMonthTick,
  formatMoney,
  GOAL_DAY_TICKS,
  goalCurrentByCurrency,
  goalMonthKeys,
  goalMonthTotals,
  goalPaidDayTicks,
  goalProgress,
  goalSavedInCurrency,
  goalSavedUsd,
  goalTargetUsd,
  labelGoalStatus,
  normalizeGoalDates,
  reportPeriod,
  shiftReportAnchor,
  sumGoalAmounts,
  todayISO,
  toKhr,
  type ReportRange,
} from "@/lib/utils";

type GoalsView = "all" | "active" | "paused" | "completed";

const GOAL_VIEWS: GoalsView[] = ["all", "active", "paused", "completed"];

function parseView(value: string | null): GoalsView {
  return GOAL_VIEWS.includes(value as GoalsView) ? (value as GoalsView) : "all";
}

function defaultGoalTrackMonth(months: string[]): string {
  if (!months.length) return todayISO().slice(0, 7);
  const now = todayISO().slice(0, 7);
  if (months.includes(now)) return now;
  if (now < months[0]) return months[0];
  return months[months.length - 1];
}

export default function GoalsPage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <GoalsContent />
      </Suspense>
    </HydrationGate>
  );
}

function GoalsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));

  const goals = useTrackingStore((s) => s.goals);
  const addGoal = useTrackingStore((s) => s.addGoal);
  const updateGoal = useTrackingStore((s) => s.updateGoal);
  const contributeGoal = useTrackingStore((s) => s.contributeGoal);
  const setGoalStatus = useTrackingStore((s) => s.setGoalStatus);
  const deleteGoal = useTrackingStore((s) => s.deleteGoal);
  const telegramSettings = useTrackingStore((s) => s.telegramSettings);
  const ownerName = useTrackingStore((s) => s.profile?.name ?? "");

  const [formOpen, setFormOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportRange, setReportRange] = useState<ReportRange>("month");
  const [reportAnchor, setReportAnchor] = useState(() => parseISO(todayISO()));
  const [sendingReport, setSendingReport] = useState(false);
  const [sendStatus, setSendStatus] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeCurrency, setContributeCurrency] =
    useState<MoneyCurrency>("KHR");
  const [contributeDate, setContributeDate] = useState(todayISO());

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [currency, setCurrency] = useState<MoneyCurrency>("KHR");
  const [startDate, setStartDate] = useState(todayISO());
  const [targetDate, setTargetDate] = useState(todayISO());
  const [members, setMembers] = useState("");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [trackMonths, setTrackMonths] = useState<Record<string, string>>({});

  const active = goals.filter((g) => g.status === "active").length;
  const paused = goals.filter((g) => g.status === "paused").length;
  const completed = goals.filter((g) => g.status === "completed").length;

  const savedTotals = sumGoalAmounts(goals, "currentAmount");
  const savedCombinedUsd = goals.reduce((sum, g) => sum + goalSavedUsd(g), 0);
  const targetCombinedUsd = goals.reduce((sum, g) => sum + goalTargetUsd(g), 0);
  const remainingCombinedUsd = Math.max(0, targetCombinedUsd - savedCombinedUsd);
  const targetTotals = {
    khr: toKhr(targetCombinedUsd),
    usd: targetCombinedUsd,
  };
  const remainingTotals = {
    khr: toKhr(remainingCombinedUsd),
    usd: remainingCombinedUsd,
  };
  const hasKhrGoals = goals.some((g) => g.currency !== "USD");
  const hasUsdGoals = goals.some((g) => g.currency === "USD");
  const showKhrBox = hasKhrGoals || savedTotals.khr > 0 || !hasUsdGoals;
  const showUsdBox = hasUsdGoals || savedTotals.usd > 0;
  const showGoalFx = goals.length > 0;

  const filtered = useMemo(() => {
    const source =
      view === "all" ? goals : goals.filter((g) => g.status === view);
    return [...source].sort((a, b) => {
      const order = { active: 0, paused: 1, completed: 2 } as const;
      const byStatus = order[a.status] - order[b.status];
      if (byStatus) return byStatus;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [goals, view]);

  const contributeGoalItem = goals.find((g) => g.id === contributeId) ?? null;

  const reportBounds = useMemo(
    () => reportPeriod(reportRange, reportAnchor),
    [reportRange, reportAnchor]
  );
  const reportPreview = useMemo(
    () =>
      buildGoalsReport({
        periodLabel: reportBounds.label,
        start: reportBounds.start,
        end: reportBounds.end,
        goals,
        view,
        ownerName,
      }),
    [reportBounds, goals, view, ownerName]
  );

  useEffect(() => {
    if (!sendStatus || reportOpen) return;
    const timer = window.setTimeout(() => setSendStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [sendStatus, reportOpen]);

  function openReportPreview() {
    setReportAnchor(parseISO(todayISO()));
    setReportRange("month");
    setSendStatus(null);
    setReportOpen(true);
  }

  function closeReportPreview() {
    setReportOpen(false);
    setSendingReport(false);
  }

  async function sendGoalsReport() {
    if (sendingReport) return;
    const token = telegramSettings.botToken.trim();
    const chatId = telegramSettings.chatId.trim();
    if (!token || !chatId) {
      setTelegramOpen(true);
      setSendStatus({ tone: "err", text: "កំណត់ Token និង Chat ID សិន" });
      return;
    }
    setSendingReport(true);
    setSendStatus(null);
    try {
      await sendTelegramMessage({
        botToken: token,
        chatId,
        text: reportPreview,
      });
      setReportOpen(false);
      setSendStatus({ tone: "ok", text: "ផ្ញើរបាយការណ៍បាន" });
    } catch {
      setSendStatus({ tone: "err", text: "ផ្ញើមិនបាន — ពិនិត្យ Telegram" });
    } finally {
      setSendingReport(false);
    }
  }

  function setGoalsNav(nextView: GoalsView) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "all") params.delete("view");
    else params.set("view", nextView);
    const qs = params.toString();
    router.replace(qs ? `/goals?${qs}` : "/goals", { scroll: false });
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setTargetAmount("");
    setCurrentAmount("");
    setCurrency("KHR");
    setStartDate(todayISO());
    setTargetDate(todayISO());
    setMembers("");
    setStatus("active");
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(goal: FamilyGoal) {
    setEditingId(goal.id);
    setTitle(goal.title);
    setDescription(goal.description);
    setTargetAmount(String(goal.targetAmount));
    setCurrentAmount(String(goal.currentAmount));
    setCurrency(goal.currency === "USD" ? "USD" : "KHR");
    const dates = normalizeGoalDates(goal);
    setStartDate(dates.startDate);
    setTargetDate(dates.targetDate);
    setMembers(goal.members.join(", "));
    setStatus(goal.status);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const target = Number(targetAmount);
    if (!title.trim() || !target || target <= 0) return;
    const current = Math.max(0, Number(currentAmount) || 0);
    const memberList = members
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const dates = normalizeGoalDates({ startDate, targetDate });
    if (editingId) {
      updateGoal(editingId, {
        title,
        description,
        targetAmount: target,
        currentAmount: current,
        currency,
        startDate: dates.startDate,
        targetDate: dates.targetDate,
        members: memberList,
        status: current >= target ? "completed" : status,
      });
    } else {
      addGoal({
        title,
        description,
        targetAmount: target,
        currentAmount: current,
        currency,
        startDate: dates.startDate,
        targetDate: dates.targetDate,
        members: memberList,
      });
    }
    closeForm();
    resetForm();
  }

  function openContribute(goal: FamilyGoal) {
    setContributeId(goal.id);
    setContributeAmount("");
    setContributeCurrency(goal.currency === "USD" ? "USD" : "KHR");
    setContributeDate(clampDateToGoalRange(todayISO(), goal));
  }

  function closeContribute() {
    setContributeId(null);
    setContributeAmount("");
  }

  function onContribute(e: FormEvent) {
    e.preventDefault();
    if (!contributeId) return;
    const amount = Number(contributeAmount);
    if (!amount || amount <= 0) return;
    contributeGoal(contributeId, amount, contributeCurrency, contributeDate);
    closeContribute();
  }

  function onDeleteCurrent() {
    if (!editingId) return;
    deleteGoal(editingId);
    closeForm();
    resetForm();
  }

  return (
    <div className="page">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-actions">
          <div
            className="tabs calendar-view-tabs"
            role="tablist"
            aria-label="គោលដៅគ្រួសារ"
          >
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "all"}
              data-active={view === "all"}
              onClick={() => setGoalsNav("all")}
            >
              ទាំងអស់
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "active"}
              data-active={view === "active"}
              onClick={() => setGoalsNav("active")}
            >
              សកម្ម
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "paused"}
              data-active={view === "paused"}
              onClick={() => setGoalsNav("paused")}
            >
              ផ្អាក
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "completed"}
              data-active={view === "completed"}
              onClick={() => setGoalsNav("completed")}
            >
              បានបញ្ចប់
            </button>
          </div>
          <button
            type="button"
            className="toolbar-send"
            aria-label="ផ្ញើរបាយការណ៍ទៅ Telegram"
            title="ផ្ញើរបាយការណ៍ទៅ Telegram"
            onClick={openReportPreview}
          >
            <Send size={15} />
            ផ្ញើ
          </button>
          <button
            type="button"
            className="toolbar-add"
            aria-label="បន្ថែមគោលដៅ"
            onClick={openCreate}
          >
            <Plus size={18} />
          </button>
        </div>
        {sendStatus && !reportOpen ? (
          <p
            className={`finance-send-status is-${sendStatus.tone}`}
            role="status"
            aria-live="polite"
          >
            {sendStatus.text}
          </p>
        ) : null}
      </div>

      <section className="surface finance-hero">
        <div className="finance-hero-main">
          <p className="calendar-kicker">សន្សំសរុប</p>
          <div
            className={`finance-hero-balance is-plus${showKhrBox && showUsdBox ? "" : " is-single"}`}
          >
            {showKhrBox ? (
              <strong className="finance-hero-chip is-khr">
                <small>រៀល</small>
                {formatMoney(savedTotals.khr, "KHR")}
              </strong>
            ) : null}
            {showUsdBox ? (
              <span className="finance-hero-chip is-usd">
                <small>ដុល្លារ</small>
                {formatMoney(savedTotals.usd, "USD")}
              </span>
            ) : null}
          </div>
          <p className="finance-hero-hint">
            {active} គោលដៅសកម្ម · {completed} បានបញ្ចប់
          </p>
        </div>
        <div className="finance-hero-split is-triple">
          <div className="finance-hero-stat is-income">
            <span>គោលដៅសកម្ម</span>
            <strong>{active}</strong>
            <em>{paused} ផ្អាក</em>
          </div>
          <div className="finance-hero-stat is-save">
            <span>គោលដៅ</span>
            {showGoalFx ? (
              <>
                <strong>{formatMoney(targetTotals.khr, "KHR")}</strong>
                <em>{formatMoney(targetTotals.usd, "USD")}</em>
              </>
            ) : (
              <strong>{formatMoney(0, "KHR")}</strong>
            )}
          </div>
          <div className="finance-hero-stat is-expense">
            <span>នៅសល់</span>
            {showGoalFx ? (
              <>
                <strong>{formatMoney(remainingTotals.khr, "KHR")}</strong>
                <em>{formatMoney(remainingTotals.usd, "USD")}</em>
              </>
            ) : (
              <strong>{formatMoney(0, "KHR")}</strong>
            )}
          </div>
        </div>
      </section>

      <section className="surface calendar-day-panel">
        {filtered.length === 0 ? (
          <EmptyState title="មិនទាន់មានគោលដៅគ្រួសារ" description="បង្កើតគោលដៅដូចជាមូលនិធិបន្ទាន់ ដំណើរកម្សាន្ត ឬការអប់រំ។" />
        ) : (
          <ul className="goal-list">
            {filtered.map((goal) => {
              const progress = goalProgress(goal);
              const currents = goalCurrentByCurrency(goal);
              const showGoalKhr = currents.khr > 0 || goal.currency !== "USD";
              const showGoalUsd = currents.usd > 0 || goal.currency === "USD";
              const combinedSaved = goalSavedInCurrency(goal, goal.currency);
              const targetLabel =
                goal.currency === "USD" ? "ដុល្លារ" : "រៀល";
              const months = goalMonthKeys(goal.startDate, goal.targetDate);
              const paidDays = goalPaidDayTicks(goal);
              const spanYears = months.some(
                (month) => month.slice(0, 4) !== months[0]?.slice(0, 4)
              );
              const currentMonth =
                (trackMonths[goal.id] && months.includes(trackMonths[goal.id])
                  ? trackMonths[goal.id]
                  : defaultGoalTrackMonth(months)) ?? months[0];
              const monthIndex = Math.max(0, months.indexOf(currentMonth));
              const ticks = paidDays.get(currentMonth);
              const monthTotals = goalMonthTotals(goal, currentMonth);
              const isPaid = Boolean(ticks?.size);
              const isNow = currentMonth === todayISO().slice(0, 7);
              return (
                <li key={goal.id}>
                  <div className={`goal-card is-${goal.status}`}>
                  <button
                    type="button"
                    className="goal-card-main"
                    onClick={() => openEdit(goal)}
                  >
                    <div className="goal-card-head">
                      <div className="min-w-0">
                        <p className="goal-card-title">{goal.title}</p>
                        {goal.description ? (
                          <p className="goal-card-desc">{goal.description}</p>
                        ) : null}
                      </div>
                      <span className={`goal-status is-${goal.status}`}>
                        {labelGoalStatus(goal.status)}
                      </span>
                    </div>

                    <div className="goal-progress-row">
                      <span>វឌ្ឍនភាព</span>
                      <strong>{progress}%</strong>
                    </div>
                    <div className="progress goal-progress">
                      <span style={{ width: `${progress}%` }} />
                    </div>

                    <div className="goal-money-stack">
                      <div
                        className={`goal-money-saved${showGoalKhr && showGoalUsd ? "" : " is-single"}`}
                      >
                        {showGoalKhr ? (
                          <span className="goal-money-chip is-khr">
                            <small>រៀល</small>
                            {formatMoney(currents.khr, "KHR")}
                          </span>
                        ) : null}
                        {showGoalUsd ? (
                          <span className="goal-money-chip is-usd">
                            <small>ដុល្លារ</small>
                            {formatMoney(currents.usd, "USD")}
                          </span>
                        ) : null}
                      </div>
                      <p className="goal-money-summary">
                        <span>សរុប {formatMoney(combinedSaved, goal.currency)}</span>
                        <span className="goal-money-of">នៃ</span>
                        <span>
                          {targetLabel} {formatMoney(goal.targetAmount, goal.currency)}
                        </span>
                      </p>
                    </div>
                  </button>
                    <div className={`goal-month-track${isPaid ? " is-paid" : ""}${isNow ? " is-now" : ""}`}>
                      <div className="goal-month-nav">
                        <button
                          type="button"
                          className="goal-month-nav-btn"
                          disabled={monthIndex <= 0}
                          onClick={() =>
                            setTrackMonths((prev) => ({
                              ...prev,
                              [goal.id]: months[monthIndex - 1],
                            }))
                          }
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <div className="goal-month-head">
                          <strong>
                            {formatGoalMonthTick(currentMonth, spanYears)}
                          </strong>
                          <span className="goal-month-money">
                            {monthTotals.khr > 0 ||
                            (!monthTotals.usd && goal.currency !== "USD") ? (
                              <em className="is-khr">
                                {formatMoney(monthTotals.khr, "KHR")}
                              </em>
                            ) : null}
                            {monthTotals.usd > 0 ||
                            (!monthTotals.khr && goal.currency === "USD") ? (
                              <em className="is-usd">
                                {formatMoney(monthTotals.usd, "USD")}
                              </em>
                            ) : null}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="goal-month-nav-btn"
                          disabled={monthIndex >= months.length - 1}
                          onClick={() =>
                            setTrackMonths((prev) => ({
                              ...prev,
                              [goal.id]: months[monthIndex + 1],
                            }))
                          }
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="goal-month-line" aria-hidden="true">
                        {GOAL_DAY_TICKS.map((day) => (
                          <span
                            key={day}
                            className={`goal-month-day${ticks?.has(day) ? " is-hit" : ""}`}
                          >
                            <i />
                            <em>{day}</em>
                          </span>
                        ))}
                      </div>
                      {goal.members.length ? (
                        <p className="goal-card-meta">
                          {`សមាជិក៖ ${goal.members.join(", ")}`}
                        </p>
                      ) : null}
                    </div>

                    <div className="goal-card-actions">
                      <button
                        type="button"
                        className="goal-action-contribute"
                        onClick={() => openContribute(goal)}
                      >
                        រួមចំណែក
                      </button>
                      <div
                        className="goal-status-switch"
                        role="group"
                        aria-label="ស្ថានភាព"
                      >
                        {GOAL_STATUSES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            data-active={goal.status === s.value}
                            aria-pressed={goal.status === s.value}
                            onClick={() => setGoalStatus(goal.id, s.value)}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="goal-action-delete"
                        onClick={() => deleteGoal(goal.id)}
                        aria-label="លុបគោលដៅ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={formOpen}
        title={editingId ? "កែគោលដៅ" : "គោលដៅគ្រួសារថ្មី"}
        onClose={closeForm}
      >
        <form className="event-form finance-form" onSubmit={onSubmit}>
          <section className="event-card">
            <label className="event-row">
              <span className="event-row-label">ចំណងជើងគោលដៅ</span>
              <input
                className="event-row-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ដំណើរកម្សាន្តគ្រួសារ / មូលនិធិបន្ទាន់"
                required
              />
            </label>
            <div className="event-row finance-amount-row">
              <span className="event-row-label">ចំនួនគោលដៅ</span>
              <input
                className="event-row-input"
                type="number"
                min={1}
                step={1}
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder={currency === "KHR" ? "2000000" : "500"}
                required
              />
              <div className="event-period" role="group" aria-label="រូបិយប័ណ្ណ">
                <button
                  type="button"
                  data-active={currency === "KHR"}
                  aria-pressed={currency === "KHR"}
                  onClick={() => setCurrency("KHR")}
                >
                  រៀល
                </button>
                <button
                  type="button"
                  data-active={currency === "USD"}
                  aria-pressed={currency === "USD"}
                  onClick={() => setCurrency("USD")}
                >
                  ដុល្លារ
                </button>
              </div>
            </div>
            <label className="event-row">
              <span className="event-row-label">ចំនួនបច្ចុប្បន្ន</span>
              <input
                className="event-row-input"
                type="number"
                min={0}
                step={1}
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                placeholder="0"
              />
            </label>
            <DatePickerField
              label="ចាប់ផ្តើមគោលដៅ"
              value={startDate}
              onChange={(next) => {
                setStartDate(next);
                if (targetDate < next) setTargetDate(next);
              }}
              required
            />
            <DatePickerField
              label="បញ្ចប់គោលដៅ"
              value={targetDate}
              onChange={(next) => {
                setTargetDate(next < startDate ? startDate : next);
              }}
              required
            />
            <label className="event-row">
              <span className="event-row-label">សមាជិក</span>
              <input
                className="event-row-input"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                placeholder="អ្នក, ដៃគូ, កូន"
              />
            </label>
            {editingId ? (
              <div className="event-row event-row-stack">
                <span className="event-row-label">ស្ថានភាព</span>
                <div className="event-period is-kinds" role="group" aria-label="ស្ថានភាព">
                  {GOAL_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      data-active={status === s.value}
                      aria-pressed={status === s.value}
                      onClick={() => setStatus(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="event-notes-field">
              <span className="event-row-label">ពិពណ៌នា</span>
              <textarea
                className="event-notes-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ហេតុអ្វីដែលគោលដៅនេះសំខាន់"
              />
            </label>
          </section>

          <div className="form-actions event-form-actions">
            {editingId ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={onDeleteCurrent}
              >
                <Trash2 size={15} /> លុប
              </button>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                បោះបង់
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              រក្សាទុកគោលដៅ
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(contributeId)}
        title="រួមចំណែក"
        onClose={closeContribute}
      >
        <form className="event-form finance-form" onSubmit={onContribute}>
          <section className="event-card">
            {contributeGoalItem ? (
              <div className="event-row">
                <span className="event-row-label">គោលដៅ</span>
                <span className="event-row-input finance-date-value">
                  {contributeGoalItem.title}
                </span>
              </div>
            ) : null}
            <div className="event-row finance-amount-row">
              <span className="event-row-label">ចំនួន</span>
              <input
                className="event-row-input"
                type="number"
                min={1}
                step={1}
                value={contributeAmount}
                onChange={(e) => setContributeAmount(e.target.value)}
                placeholder={contributeCurrency === "USD" ? "50" : "200000"}
                required
              />
              <div className="event-period" role="group" aria-label="រូបិយប័ណ្ណ">
                <button
                  type="button"
                  data-active={contributeCurrency === "KHR"}
                  aria-pressed={contributeCurrency === "KHR"}
                  onClick={() => setContributeCurrency("KHR")}
                >
                  រៀល
                </button>
                <button
                  type="button"
                  data-active={contributeCurrency === "USD"}
                  aria-pressed={contributeCurrency === "USD"}
                  onClick={() => setContributeCurrency("USD")}
                >
                  ដុល្លារ
                </button>
              </div>
            </div>
            <DatePickerField
              label="ថ្ងៃ"
              value={contributeDate}
              onChange={(next) =>
                setContributeDate(
                  contributeGoalItem
                    ? clampDateToGoalRange(next, contributeGoalItem)
                    : next
                )
              }
              required
            />
          </section>
          <div className="form-actions event-form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeContribute}
            >
              បោះបង់
            </button>
            <button type="submit" className="btn btn-primary">
              បន្ថែមការរួមចំណែក
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={reportOpen}
        title="ផ្ញើរបាយការណ៍"
        onClose={closeReportPreview}
      >
        <div className="event-form finance-report">
          <div
            className="tabs calendar-view-tabs finance-report-tabs"
            role="tablist"
            aria-label="រយៈពេលរបាយការណ៍"
          >
            {REPORT_RANGES.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                className="tab"
                aria-selected={reportRange === item.value}
                data-active={reportRange === item.value}
                onClick={() => setReportRange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="calendar-month-head finance-report-nav">
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="មុន"
              onClick={() =>
                setReportAnchor(shiftReportAnchor(reportRange, reportAnchor, -1))
              }
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="calendar-month-title finance-report-period">
              {reportBounds.label}
            </h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="បន្ទាប់"
              onClick={() =>
                setReportAnchor(shiftReportAnchor(reportRange, reportAnchor, 1))
              }
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <section className="event-card">
            <pre className="finance-report-text">{reportPreview}</pre>
          </section>

          {sendStatus ? (
            <p
              className={`finance-send-status is-${sendStatus.tone}`}
              role="status"
              aria-live="polite"
            >
              {sendStatus.text}
            </p>
          ) : null}

          <div className="form-actions event-form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeReportPreview}
            >
              បោះបង់
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={sendingReport}
              onClick={() => void sendGoalsReport()}
            >
              <Send size={15} />
              {sendingReport ? "កំពុងផ្ញើ…" : "ផ្ញើ"}
            </button>
          </div>
        </div>
      </Modal>

      <TelegramConfigModal
        open={telegramOpen}
        onClose={() => setTelegramOpen(false)}
      />
    </div>
  );
}
