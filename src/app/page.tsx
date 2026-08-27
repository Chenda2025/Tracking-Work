"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Goal,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { HydrationGate } from "@/components/HydrationGate";
import { useTrackingStore } from "@/lib/store";
import {
  activityStats,
  filterThisMonth,
  formatMoney,
  formatMonth,
  formatShortDate,
  goalProgress,
  isActivityForToday,
  labelActivityCategory,
  labelActivityStatus,
  labelFinanceCategory,
  formatClock,
  sumExpense,
  sumIncome,
} from "@/lib/utils";

export default function DashboardPage() {
  return (
    <HydrationGate>
      <DashboardContent />
    </HydrationGate>
  );
}

function DashboardContent() {
  const activities = useTrackingStore((s) => s.activities);
  const transactions = useTrackingStore((s) => s.transactions);
  const goals = useTrackingStore((s) => s.goals);

  const todayActivities = activities.filter((a) => isActivityForToday(a));
  const monthTx = filterThisMonth(transactions);
  const income = sumIncome(monthTx);
  const expense = sumExpense(monthTx);
  const balance = income - expense;
  const stats = activityStats(todayActivities);
  const activeGoals = goals.filter((g) => g.status === "active");
  const recentTx = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const topGoals = [...goals]
    .sort((a, b) => goalProgress(b) - goalProgress(a))
    .slice(0, 4);

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div className="min-w-0">
          <p className="font-subtitle text-sm text-brand">ទិដ្ឋភាពទូទៅ</p>
          <h1 className="page-header-title mt-1">
            សួស្តី សូមស្វាគមន៍មកកាន់ ថេរ
          </h1>
          <p className="font-subtitle mt-2 max-w-xl text-[0.9rem] text-ink-muted sm:text-[0.95rem]">
            សង្ខេបសកម្មភាព លុយ និងគោលដៅគ្រួសារសម្រាប់ {formatMonth()}។
          </p>
        </div>
        <div className="page-header-actions">
          <div className="flex flex-wrap gap-2">
            <Link href="/activities" className="btn btn-secondary">
              <Plus size={15} /> សកម្មភាព
            </Link>
            <Link href="/finance" className="btn btn-secondary">
              <Plus size={15} /> ប្រតិបត្តិការ
            </Link>
            <Link href="/goals" className="btn btn-primary">
              <Plus size={15} /> គោលដៅ
            </Link>
          </div>
        </div>
      </header>

      {/* Hero finance strip */}
      <section className="surface relative overflow-hidden p-5 md:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(500px 180px at 0% 0%, rgba(11,101,87,0.12), transparent 60%), radial-gradient(420px 160px at 100% 0%, rgba(184,90,36,0.08), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-medium text-ink-muted">
              សមតុល្យសុទ្ធ · {formatMonth()}
            </p>
            <p
              className={`font-display mt-2 text-3xl md:text-4xl ${
                balance >= 0 ? "text-brand-deep" : "text-danger"
              }`}
            >
              {formatMoney(balance)}
            </p>
            <p className="font-subtitle mt-2 text-sm text-ink-soft">
              ចំណូលដកចំណាយក្នុងខែនេះ
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[14px] border border-line bg-surface/80 p-3.5">
              <div className="mb-2 flex items-center gap-2 text-success">
                <TrendingUp size={16} />
                <span className="text-xs font-semibold">ចំណូល</span>
              </div>
              <p className="font-display text-xl text-success">
                {formatMoney(income)}
              </p>
            </div>
            <div className="rounded-[14px] border border-line bg-surface/80 p-3.5">
              <div className="mb-2 flex items-center gap-2 text-accent">
                <TrendingDown size={16} />
                <span className="text-xs font-semibold">ចំណាយ</span>
              </div>
              <p className="font-display text-xl text-accent">
                {formatMoney(expense)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          icon={<Activity size={16} />}
          label="សកម្មភាពថ្ងៃនេះ"
          value={`${stats.done}/${stats.total || 0}`}
          hint={`រួចរាល់ ${stats.rate}% · ${stats.minutes} នាទី`}
          tone="brand"
          href="/activities"
        />
        <KpiCard
          icon={<Wallet size={16} />}
          label="ប្រតិបត្តិការខែនេះ"
          value={String(monthTx.length)}
          hint={`${monthTx.filter((t) => t.type === "income").length} ចំណូល · ${monthTx.filter((t) => t.type === "expense").length} ចំណាយ`}
          tone="accent"
          href="/finance"
        />
        <KpiCard
          icon={<Goal size={16} />}
          label="គោលដៅសកម្ម"
          value={String(activeGoals.length)}
          hint={`បានបញ្ចប់ ${goals.filter((g) => g.status === "completed").length}`}
          tone="success"
          href="/goals"
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-3 lg:grid-cols-5">
        {/* Activities — wider */}
        <section className="surface p-4 md:p-5 lg:col-span-3">
          <div className="section-head">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Activity size={15} />
              </span>
              <h2 className="section-title">សកម្មភាពថ្ងៃនេះ</h2>
            </div>
            <Link href="/activities" className="link-quiet">
              មើលទាំងអស់ <ArrowRight size={14} />
            </Link>
          </div>

          {todayActivities.length === 0 ? (
            <CompactEmpty
              title="មិនទាន់មានសកម្មភាព"
              description="ចាប់ផ្តើមកត់ត្រាការងារ ឬភារកិច្ចផ្ទាល់ខ្លួន។"
              href="/activities"
              action="បន្ថែមសកម្មភាព"
            />
          ) : (
            <ul className="list-stack">
              {todayActivities.slice(0, 7).map((item) => (
                <li key={item.id} className="list-row items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {labelActivityCategory(item.category)} ·{" "}
                      {labelActivityStatus(item.status)}
                    </p>
                  </div>
                  <span className="badge bg-brand-soft text-brand-deep">
                    {item.startTime ? formatClock(item.startTime) : labelActivityStatus(item.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Goals */}
        <section className="surface p-4 md:p-5 lg:col-span-2">
          <div className="section-head">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Goal size={15} />
              </span>
              <h2 className="section-title">គោលដៅ</h2>
            </div>
            <Link href="/goals" className="link-quiet">
              បើក <ArrowRight size={14} />
            </Link>
          </div>

          {topGoals.length === 0 ? (
            <CompactEmpty
              title="មិនទាន់មានគោលដៅ"
              description="បង្កើតគោលដៅគ្រួសារដំបូងរបស់អ្នក។"
              href="/goals"
              action="បន្ថែមគោលដៅ"
            />
          ) : (
            <ul className="space-y-4">
              {topGoals.map((goal) => {
                const progress = goalProgress(goal);
                return (
                  <li key={goal.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{goal.title}</p>
                      <span className="shrink-0 text-xs font-semibold text-ink-muted">
                        {progress}%
                      </span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {formatMoney(goal.currentAmount)} /{" "}
                      {formatMoney(goal.targetAmount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Recent money */}
      <section className="surface p-4 md:p-5">
        <div className="section-head">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Wallet size={15} />
            </span>
            <h2 className="section-title">ប្រតិបត្តិការថ្មីៗ</h2>
          </div>
          <Link href="/finance" className="link-quiet">
            មើលទាំងអស់ <ArrowRight size={14} />
          </Link>
        </div>

        {recentTx.length === 0 ? (
          <CompactEmpty
            title="មិនទាន់មានប្រតិបត្តិការ"
            description="បន្ថែមចំណូល ឬចំណាយដើម្បីមើលសមតុល្យ។"
            href="/finance"
            action="បន្ថែមប្រតិបត្តិការ"
          />
        ) : (
          <ul className="list-stack">
            {recentTx.map((item) => (
              <li key={item.id} className="list-row items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      item.type === "income"
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-danger"
                    }`}
                  >
                    {item.type === "income" ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {labelFinanceCategory(item.category)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {formatShortDate(item.date)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </div>
                </div>
                <p
                  className={`shrink-0 font-semibold ${
                    item.type === "income" ? "text-success" : "text-danger"
                  }`}
                >
                  {item.type === "income" ? "+" : "-"}
                  {formatMoney(item.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "brand" | "accent" | "success";
  href: string;
}) {
  const toneMap = {
    brand: {
      bar: "bg-brand",
      icon: "bg-brand-soft text-brand",
      value: "text-brand-deep",
    },
    accent: {
      bar: "bg-accent",
      icon: "bg-accent-soft text-accent",
      value: "text-accent",
    },
    success: {
      bar: "bg-success",
      icon: "bg-success-soft text-success",
      value: "text-success",
    },
  }[tone];

  return (
    <Link
      href={href}
      className="surface group relative block overflow-hidden p-4 transition-shadow hover:shadow-[var(--shadow)]"
    >
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${toneMap.bar}`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div>
          <p className="text-[0.8rem] font-medium text-ink-muted">{label}</p>
          <p className={`font-display mt-1.5 text-2xl ${toneMap.value}`}>
            {value}
          </p>
          <p className="font-subtitle mt-1 text-sm text-ink-soft">{hint}</p>
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneMap.icon} transition-transform group-hover:scale-105`}
        >
          {icon}
        </span>
      </div>
    </Link>
  );
}

function CompactEmpty({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="rounded-[14px] border border-dashed border-line bg-bg-elevated/60 px-4 py-6 text-center">
      <p className="font-display text-base text-ink">{title}</p>
      <p className="font-subtitle mx-auto mt-1 max-w-xs text-sm text-ink-muted">
        {description}
      </p>
      <Link href={href} className="btn btn-secondary mt-4">
        <Plus size={14} /> {action}
      </Link>
    </div>
  );
}
