"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Goal } from "lucide-react";
import { HydrationGate } from "@/components/HydrationGate";
import { useTrackingStore } from "@/lib/store";
import {
  filterThisMonth,
  formatMoney,
  formatMoneyPair,
  goalCurrentByCurrency,
  formatMonth,
  goalProgress,
  isSavingsTx,
  formatClock,
  sumExpense,
  sumIncome,
  todayISO,
  eventsForDate,
  remindersForDate,
} from "@/lib/utils";

export default function DashboardPage() {
  return (
    <HydrationGate>
      <DashboardContent />
    </HydrationGate>
  );
}

function DashboardContent() {
  const transactions = useTrackingStore((s) => s.transactions);
  const goals = useTrackingStore((s) => s.goals);
  const events = useTrackingStore((s) => s.events);
  const reminders = useTrackingStore((s) => s.reminders);

  const today = todayISO();
  const todayEvents = eventsForDate(events, today);
  const todayReminders = remindersForDate(reminders, today).filter(
    (r) => !r.completed
  );
  const monthTx = filterThisMonth(transactions);
  const income = sumIncome(monthTx);
  const expense = sumExpense(monthTx);
  const balance = income - expense;
  const incomeCount = monthTx.filter((item) => item.type === "income").length;
  const expenseCount = monthTx.filter(
    (item) => item.type === "expense" && !isSavingsTx(item)
  ).length;
  const activeGoals = goals.filter((g) => g.status === "active");
  const doneGoals = goals.filter((g) => g.status === "completed").length;
  const topGoals = [...goals]
    .sort((a, b) => goalProgress(b) - goalProgress(a))
    .slice(0, 4);
  const todayCount = todayEvents.length + todayReminders.length;

  return (
    <div className="page dash">
      <section className="surface finance-hero">
        <div className="finance-hero-main">
          <p className="calendar-kicker">{formatMonth()}</p>
          <div
            className={`finance-hero-balance ${
              balance >= 0 ? "is-plus" : "is-minus"
            }`}
          >
            <strong className="finance-hero-chip is-khr">
              <small>រៀល</small>
              {formatMoneyPair(balance).khr}
            </strong>
            <span className="finance-hero-chip is-usd">
              <small>ដុល្លារ</small>
              {formatMoneyPair(balance).usd}
            </span>
          </div>
          <p className="finance-hero-hint">សមតុល្យសុទ្ធ</p>
        </div>
        <div className="finance-hero-split">
          <div className="finance-hero-stat is-income">
            <span>ចំណូល</span>
            <strong>{formatMoneyPair(income).khr}</strong>
            <em>{formatMoneyPair(income).usd}</em>
          </div>
          <div className="finance-hero-stat is-expense">
            <span>ចំណាយ</span>
            <strong>{formatMoneyPair(expense).khr}</strong>
            <em>{formatMoneyPair(expense).usd}</em>
          </div>
        </div>
      </section>

      <div className="dash-kpis">
        <Link href="/calendar" className="surface dash-kpi is-brand">
          <p className="dash-kpi-label">ប្រតិទិន</p>
          <p className="dash-kpi-value">{todayCount}</p>
          <p className="dash-kpi-hint">
            {todayEvents.length} ព្រឹត្តិការណ៍ · {todayReminders.length} ការរំលឹក
          </p>
        </Link>
        <Link href="/finance" className="surface dash-kpi is-accent">
          <p className="dash-kpi-label">លុយ</p>
          <p className="dash-kpi-value">{monthTx.length}</p>
          <p className="dash-kpi-hint">
            {incomeCount} ចំណូល · {expenseCount} ចំណាយ
          </p>
        </Link>
        <Link href="/goals" className="surface dash-kpi is-success">
          <p className="dash-kpi-label">គោលដៅ</p>
          <p className="dash-kpi-value">{activeGoals.length}</p>
          <p className="dash-kpi-hint">បានបញ្ចប់ {doneGoals}</p>
        </Link>
      </div>

      <div className="dash-panels">
        <section className="surface dash-panel">
          <div className="section-head">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <CalendarDays size={14} />
              </span>
              <h2 className="section-title">ថ្ងៃនេះ</h2>
            </div>
            <Link href="/calendar" className="link-quiet">
              មើលទាំងអស់ <ArrowRight size={14} />
            </Link>
          </div>

          {todayCount === 0 ? (
            <div className="dash-empty">
              <p>មិនទាន់មានព្រឹត្តិការណ៍ ឬការរំលឹក</p>
              <Link href="/calendar">បើកប្រតិទិន</Link>
            </div>
          ) : (
            <ul>
              {todayEvents.slice(0, 5).map((item) => (
                <li key={item.id} className="dash-row">
                  <i className="dash-mark is-event" aria-hidden />
                  <div className="dash-row-body">
                    <p className="dash-row-title">{item.title}</p>
                    <p className="dash-row-meta">ព្រឹត្តិការណ៍</p>
                  </div>
                  <p className="dash-row-side font-subtitle text-xs font-semibold text-ink-muted">
                    {item.allDay
                      ? "ពេញថ្ងៃ"
                      : item.startTime
                        ? formatClock(item.startTime)
                        : "—"}
                  </p>
                </li>
              ))}
              {todayReminders.slice(0, 4).map((item) => (
                <li key={item.id} className="dash-row">
                  <i className="dash-mark is-reminder" aria-hidden />
                  <div className="dash-row-body">
                    <p className="dash-row-title">{item.title}</p>
                    <p className="dash-row-meta">ការរំលឹក</p>
                  </div>
                  <p className="dash-row-side font-subtitle text-xs font-semibold text-ink-muted">
                    {item.dueTime ? formatClock(item.dueTime) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface dash-panel">
          <div className="section-head">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Goal size={14} />
              </span>
              <h2 className="section-title">គោលដៅ</h2>
            </div>
            <Link href="/goals" className="link-quiet">
              បើក <ArrowRight size={14} />
            </Link>
          </div>

          {topGoals.length === 0 ? (
            <div className="dash-empty">
              <p>មិនទាន់មានគោលដៅ</p>
              <Link href="/goals">បន្ថែមគោលដៅ</Link>
            </div>
          ) : (
            <ul>
              {topGoals.map((goal) => {
                const progress = goalProgress(goal);
                const currents = goalCurrentByCurrency(goal);
                const saved = [
                  currents.khr ? formatMoney(currents.khr, "KHR") : "",
                  currents.usd ? formatMoney(currents.usd, "USD") : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={goal.id} className="dash-goal">
                    <div className="dash-goal-top">
                      <p className="truncate">{goal.title}</p>
                      <span>{progress}%</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <p className="dash-row-meta">
                      {saved || formatMoney(0, goal.currency)} /{" "}
                      {formatMoney(goal.targetAmount, goal.currency)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
