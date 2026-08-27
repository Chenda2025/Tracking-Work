"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { HydrationGate } from "@/components/HydrationGate";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { useTrackingStore } from "@/lib/store";
import type { FinanceCategory, TransactionType } from "@/lib/types";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  filterThisMonth,
  formatMoney,
  formatMonth,
  formatShortDate,
  labelFinanceCategory,
  labelTransactionType,
  sumExpense,
  sumIncome,
  todayISO,
} from "@/lib/utils";

export default function FinancePage() {
  return (
    <HydrationGate>
      <FinanceContent />
    </HydrationGate>
  );
}

function FinanceContent() {
  const transactions = useTrackingStore((s) => s.transactions);
  const addTransaction = useTrackingStore((s) => s.addTransaction);
  const deleteTransaction = useTrackingStore((s) => s.deleteTransaction);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<FinanceCategory>("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [view, setView] = useState<"month" | "all">("month");

  const monthTx = filterThisMonth(transactions);
  const visible = useMemo(() => {
    const list = view === "month" ? monthTx : transactions;
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [monthTx, transactions, view]);

  const income = sumIncome(monthTx);
  const expense = sumExpense(monthTx);
  const balance = income - expense;

  const categories =
    type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function resetForm() {
    setType("expense");
    setAmount("");
    setCategory("food");
    setNote("");
    setDate(todayISO());
  }

  function onTypeChange(next: TransactionType) {
    setType(next);
    setCategory(next === "income" ? "salary" : "food");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    addTransaction({ type, amount: value, category, note, date });
    resetForm();
    setOpen(false);
  }

  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthTx
      .filter((t) => t.type === "expense")
      .forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [monthTx]);

  return (
    <div className="page">
      <PageHeader
        title="ចំណូល និង ចំណាយ"
        subtitle="តាមដានលំហូរលុយផ្ទាល់ខ្លួនជាផ្នែកនៃប្រព័ន្ធការងាររបស់អ្នក។"
        action={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> បន្ថែមប្រតិបត្តិការ
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={`ចំណូល ${formatMonth()}`}
          value={formatMoney(income)}
          tone="success"
        />
        <StatCard
          label={`ចំណាយ ${formatMonth()}`}
          value={formatMoney(expense)}
          tone="accent"
        />
        <StatCard
          label="សមតុល្យសុទ្ធ"
          value={formatMoney(balance)}
          tone={balance >= 0 ? "brand" : "danger"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="surface p-4 md:p-5 lg:col-span-1">
          <h2 className="section-title mb-4">ចំណាយខ្ពស់បំផុត</h2>
          {spendByCategory.length === 0 ? (
            <EmptyState
              title="មិនទាន់មានចំណាយ"
              description="ចំណាយក្នុងខែនេះនឹងបង្ហាញតាមប្រភេទនៅទីនេះ។"
            />
          ) : (
            <ul className="list-stack">
              {spendByCategory.map((item) => (
                <li key={item.name} className="list-row items-center">
                  <span className="text-ink-muted">
                    {labelFinanceCategory(item.name)}
                  </span>
                  <span className="font-semibold">{formatMoney(item.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface p-4 md:p-5 lg:col-span-2">
          <div className="section-head">
            <h2 className="section-title">ប្រតិបត្តិការ</h2>
            <div className="chip-group">
              <button
                type="button"
                className="chip"
                data-active={view === "month"}
                onClick={() => setView("month")}
              >
                ខែនេះ
              </button>
              <button
                type="button"
                className="chip"
                data-active={view === "all"}
                onClick={() => setView("all")}
              >
                ទាំងអស់
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="មិនទាន់មានប្រតិបត្តិការ"
              description="បន្ថែមចំណូល ឬចំណាយដើម្បីចាប់ផ្តើមកំណត់ត្រាលុយ។"
            />
          ) : (
            <ul className="list-stack">
              {visible.map((item) => (
                <li key={item.id} className="list-row items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {labelTransactionType(item.type)} ·{" "}
                      {labelFinanceCategory(item.category)}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {formatShortDate(item.date)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p
                      className={`font-semibold ${
                        item.type === "income" ? "text-success" : "text-danger"
                      }`}
                    >
                      {item.type === "income" ? "+" : "-"}
                      {formatMoney(item.amount)}
                    </p>
                    <button
                      type="button"
                      className="btn btn-danger btn-icon"
                      onClick={() => deleteTransaction(item.id)}
                      aria-label="លុបប្រតិបត្តិការ"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal open={open} title="ប្រតិបត្តិការថ្មី" onClose={() => setOpen(false)}>
        <form className="space-y-3.5" onSubmit={onSubmit}>
          <div className="chip-group w-full">
            <button
              type="button"
              className="chip flex-1"
              data-active={type === "income"}
              onClick={() => onTypeChange("income")}
            >
              ចំណូល
            </button>
            <button
              type="button"
              className="chip flex-1"
              data-active={type === "expense"}
              onClick={() => onTypeChange("expense")}
            >
              ចំណាយ
            </button>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">ចំនួនទឹកប្រាក់</span>
            <input
              className="input"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50"
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">ប្រភេទ</span>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as FinanceCategory)}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">កាលបរិច្ឆេទ</span>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">កំណត់ចំណាំ</span>
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="កំណត់ចំណាំ (ស្រេចចិត្ត)"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              បោះបង់
            </button>
            <button type="submit" className="btn btn-primary">
              រក្សាទុកប្រតិបត្តិការ
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
