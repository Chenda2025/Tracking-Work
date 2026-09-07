"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { format, isSameMonth, parseISO } from "date-fns";
import { km } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { HydrationGate } from "@/components/HydrationGate";
import { CategoryPicker } from "@/components/CategoryPicker";
import { DatePickerField } from "@/components/DatePicker";
import { Modal } from "@/components/Modal";
import { TelegramConfigModal } from "@/components/TelegramConfigModal";
import { useTrackingStore } from "@/lib/store";
import { buildFinanceReport, sendTelegramMessage } from "@/lib/telegramDaily";
import type {
  FinanceCategory,
  MoneyCurrency,
  Transaction,
  TransactionType,
} from "@/lib/types";
import {
  WEEKDAY_HEADERS_KM,
  REPORT_RANGES,
  buildMonthGrid,
  filterByDateRange,
  filterByMonth,
  financeMarksForMonth,
  formatMoneyPair,
  formatMonth,
  isSavingsTx,
  labelTransactionType,
  reportPeriod,
  resolveFinanceCategoryLabel,
  shiftMonth,
  shiftReportAnchor,
  sumExpense,
  sumIncome,
  todayISO,
  toUsd,
  type ReportRange,
} from "@/lib/utils";

type FinanceView = "month" | "list" | "income" | "expense";

const FINANCE_VIEWS: FinanceView[] = [
  "month",
  "list",
  "income",
  "expense",
];

function parseView(value: string | null): FinanceView {
  return FINANCE_VIEWS.includes(value as FinanceView)
    ? (value as FinanceView)
    : "month";
}

function parseMonthParam(value: string | null): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function monthKey(month: Date): string {
  return format(month, "yyyy-MM");
}

export default function FinancePage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <FinanceContent />
      </Suspense>
    </HydrationGate>
  );
}

function FinanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));
  const month = parseMonthParam(searchParams.get("month"));

  const transactions = useTrackingStore((s) => s.transactions);
  const incomeCategories = useTrackingStore((s) => s.incomeCategories);
  const expenseCategories = useTrackingStore((s) => s.expenseCategories);
  const saveCategories = useTrackingStore((s) => s.saveCategories);
  const addTransaction = useTrackingStore((s) => s.addTransaction);
  const updateTransaction = useTrackingStore((s) => s.updateTransaction);
  const deleteTransaction = useTrackingStore((s) => s.deleteTransaction);
  const telegramSettings = useTrackingStore((s) => s.telegramSettings);
  const ownerName = useTrackingStore((s) => s.profile?.name ?? "");

  const [selectedISO, setSelectedISO] = useState(todayISO);
  const [formOpen, setFormOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportRange, setReportRange] = useState<ReportRange>("month");
  const [reportAnchor, setReportAnchor] = useState(month);
  const [sendingReport, setSendingReport] = useState(false);
  const [sendStatus, setSendStatus] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<MoneyCurrency>("KHR");
  const [category, setCategory] = useState<FinanceCategory>("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const monthTx = useMemo(
    () => filterByMonth(transactions, month),
    [transactions, month]
  );
  const marks = useMemo(
    () => financeMarksForMonth(month, transactions),
    [month, transactions]
  );

  useEffect(() => {
    try {
      if (!isSameMonth(parseISO(selectedISO), month)) {
        const today = todayISO();
        setSelectedISO(
          isSameMonth(parseISO(today), month) ? today : format(month, "yyyy-MM-dd")
        );
      }
    } catch {
      setSelectedISO(format(month, "yyyy-MM-dd"));
    }
  }, [month, selectedISO]);

  const dayTx = useMemo(
    () =>
      monthTx
        .filter((item) => item.date === selectedISO)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [monthTx, selectedISO]
  );

  const income = sumIncome(monthTx);
  const expense = sumExpense(monthTx);
  const balance = income - expense;

  const listItems = useMemo(() => {
    const source =
      view === "income"
        ? monthTx.filter((item) => item.type === "income")
        : view === "expense"
          ? monthTx.filter(
              (item) => item.type === "expense" && !isSavingsTx(item)
            )
          : monthTx;
    return [...source].sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate) return byDate;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [monthTx, view]);

  const groupedList = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const item of listItems) {
      const group = map.get(item.date) ?? [];
      group.push(item);
      map.set(item.date, group);
    }
    return [...map.entries()];
  }, [listItems]);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    const source =
      view === "income"
        ? monthTx.filter((item) => item.type === "income")
        : monthTx.filter(
            (item) => item.type === "expense" && !isSavingsTx(item)
          );
    source.forEach((item) => {
      map.set(
        item.category,
        (map.get(item.category) ?? 0) + toUsd(item.amount, item.currency)
      );
    });
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [monthTx, view]);

  const selectedParts = useMemo(() => {
    try {
      const d = parseISO(selectedISO);
      return {
        weekday: format(d, "EEEE", { locale: km }),
        date: format(d, "d MMMM yyyy", { locale: km }),
      };
    } catch {
      return { weekday: "", date: selectedISO };
    }
  }, [selectedISO]);

  const categoryCatalog = useMemo(
    () => [...incomeCategories, ...expenseCategories, ...saveCategories],
    [incomeCategories, expenseCategories, saveCategories]
  );
  const categoryLabel = (id: string) =>
    resolveFinanceCategoryLabel(id, categoryCatalog);

  const reportBounds = useMemo(
    () => reportPeriod(reportRange, reportAnchor),
    [reportRange, reportAnchor]
  );
  const reportTx = useMemo(
    () => filterByDateRange(transactions, reportBounds.start, reportBounds.end),
    [transactions, reportBounds]
  );
  const reportPreview = useMemo(
    () =>
      buildFinanceReport({
        periodLabel: reportBounds.label,
        transactions: reportTx,
        view,
        ownerName,
        categoryLabel: (id) => resolveFinanceCategoryLabel(id, categoryCatalog),
      }),
    [reportBounds.label, reportTx, view, categoryCatalog, ownerName]
  );

  useEffect(() => {
    if (!sendStatus || reportOpen) return;
    const timer = window.setTimeout(() => setSendStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [sendStatus, reportOpen]);

  function openReportPreview() {
    try {
      const selected = parseISO(selectedISO);
      setReportAnchor(isSameMonth(selected, month) ? selected : month);
    } catch {
      setReportAnchor(month);
    }
    setReportRange("month");
    setSendStatus(null);
    setReportOpen(true);
  }

  function closeReportPreview() {
    setReportOpen(false);
    setSendingReport(false);
  }

  async function sendFinanceReport() {
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

  function setFinanceNav(next: { view?: FinanceView; month?: Date }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextView = next.view ?? view;
    if (nextView === "month") params.delete("view");
    else params.set("view", nextView);

    const nextMonth = next.month ?? month;
    const now = new Date();
    if (
      nextMonth.getFullYear() === now.getFullYear() &&
      nextMonth.getMonth() === now.getMonth()
    ) {
      params.delete("month");
    } else {
      params.set("month", monthKey(nextMonth));
    }

    const qs = params.toString();
    router.replace(qs ? `/finance?${qs}` : "/finance", { scroll: false });
  }

  function resetForm(nextType: TransactionType = "expense", nextDate = selectedISO) {
    setEditingId(null);
    setType(nextType);
    setAmount("");
    setCurrency("KHR");
    setCategory(nextType === "income" ? "salary" : "food");
    setNote("");
    setDate(nextDate);
  }

  function openCreate(nextType?: TransactionType, nextDate = selectedISO) {
    const kind = nextType ?? (view === "income" ? "income" : "expense");
    resetForm(kind, nextDate);
    setFormOpen(true);
  }

  function openEdit(item: Transaction) {
    setEditingId(item.id);
    const nextType = item.type === "income" ? "income" : "expense";
    setType(nextType);
    setAmount(String(item.amount));
    setCurrency(item.currency === "USD" ? "USD" : "KHR");
    setCategory(
      nextType === "expense" && item.category === "savings"
        ? "other"
        : item.category
    );
    setNote(item.note);
    setDate(item.date);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function onTypeChange(next: TransactionType) {
    setType(next);
    setCategory(next === "income" ? "salary" : "food");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    const nextType: TransactionType = type === "income" ? "income" : "expense";
    if (editingId) {
      updateTransaction(editingId, {
        type: nextType,
        amount: value,
        currency,
        category,
        note,
        date,
      });
    } else {
      addTransaction({
        type: nextType,
        amount: value,
        currency,
        category,
        note,
        date,
      });
    }
    closeForm();
  }

  function onDeleteCurrent() {
    if (!editingId) return;
    deleteTransaction(editingId);
    closeForm();
  }

  return (
    <div className="page">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-actions">
          <div
            className="tabs calendar-view-tabs finance-view-tabs"
            role="tablist"
            aria-label="ទិដ្ឋភាពលុយ"
          >
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "month"}
              data-active={view === "month"}
              onClick={() => setFinanceNav({ view: "month" })}
            >
              ខែ
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "list"}
              data-active={view === "list"}
              onClick={() => setFinanceNav({ view: "list" })}
            >
              បញ្ជី
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "income"}
              data-active={view === "income"}
              onClick={() => setFinanceNav({ view: "income" })}
            >
              ចំណូល
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "expense"}
              data-active={view === "expense"}
              onClick={() => setFinanceNav({ view: "expense" })}
            >
              ចំណាយ
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
            aria-label="បន្ថែម"
            onClick={() => openCreate()}
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
          <p className="calendar-kicker">{formatMonth(month)}</p>
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

      {view === "month" ? (
        <>
          <section className="surface calendar-month">
            <div className="calendar-month-head">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="ខែមុន"
                onClick={() => setFinanceNav({ month: shiftMonth(month, -1) })}
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="calendar-month-title">{formatMonth(month)}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="ខែបន្ទាប់"
                onClick={() => setFinanceNav({ month: shiftMonth(month, 1) })}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="calendar-weekdays" aria-hidden>
              {WEEKDAY_HEADERS_KM.map((d, i) => (
                <span key={`${d}-${i}`} className={i === 0 ? "is-sun" : ""}>
                  {d}
                </span>
              ))}
            </div>
            <div className="calendar-grid" role="grid" aria-label="ប្រតិទិនលុយ">
              {cells.map((cell) => {
                const mark = marks[cell.iso];
                const selected = cell.iso === selectedISO;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    role="gridcell"
                    className={`calendar-cell ${cell.inMonth ? "" : "is-outside"} ${
                      cell.isToday ? "is-today" : ""
                    } ${selected ? "is-selected" : ""}`}
                    aria-selected={selected}
                    onClick={() => {
                      setSelectedISO(cell.iso);
                      if (!cell.inMonth) {
                        setFinanceNav({ month: new Date(cell.date) });
                      }
                    }}
                  >
                    <span className="calendar-day-num">
                      {format(cell.date, "d")}
                    </span>
                    <span className="calendar-dots" aria-hidden>
                      {mark?.income ? <i className="dot-income" /> : null}
                      {mark?.expense ? <i className="dot-expense" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="surface calendar-day-panel">
            <div className="calendar-day-head">
              <div className="min-w-0">
                <p className="calendar-kicker">{selectedParts.weekday}</p>
                <h3 className="calendar-day-title">{selectedParts.date}</h3>
              </div>
              {dayTx.length ? (
                <span className="calendar-day-count">{dayTx.length}</span>
              ) : null}
            </div>
            {dayTx.length === 0 ? (
              <p className="calendar-day-empty">មិនទាន់មានប្រតិបត្តិការ</p>
            ) : (
              <ul className="calendar-item-list">
                {dayTx.map((item) => (
                  <TransactionItem
                    key={item.id}
                    item={item}
                    categoryLabel={categoryLabel}
                    onEdit={() => openEdit(item)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {view === "list" || view === "income" || view === "expense" ? (
        <>
          <section className="surface calendar-month">
            <div className="calendar-month-head">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="ខែមុន"
                onClick={() => setFinanceNav({ month: shiftMonth(month, -1) })}
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="calendar-month-title">{formatMonth(month)}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="ខែបន្ទាប់"
                onClick={() => setFinanceNav({ month: shiftMonth(month, 1) })}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </section>

          {view !== "list" ? (
            <section className="surface calendar-day-panel">
              <div className="calendar-day-head">
                <div className="min-w-0">
                  <p className="calendar-kicker">
                    {view === "income" ? "ចំណូល" : "ចំណាយ"}
                  </p>
                  <h3 className="calendar-day-title">ប្រភេទខ្ពស់បំផុត</h3>
                </div>
              </div>
              {categoryTotals.length === 0 ? (
                <p className="calendar-day-empty">មិនទាន់មានទិន្នន័យ</p>
              ) : (
                <ul className="calendar-item-list">
                  {categoryTotals.map((item) => (
                    <li key={item.name} className="calendar-item">
                      <div className="calendar-item-body">
                        <p className="calendar-item-title">
                          {categoryLabel(item.name)}
                        </p>
                      </div>
                      <p
                        className={`finance-amount ${
                          view === "income" ? "is-income" : "is-expense"
                        }`}
                      >
                        {formatMoneyPair(item.total).khr}
                        <span className="finance-amount-fx">
                          {formatMoneyPair(item.total).usd}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="surface calendar-day-panel calendar-list-panel">
            {groupedList.length === 0 ? (
              <EmptyState
                title="មិនទាន់មានប្រតិបត្តិការ"
                description="បន្ថែមចំណូល ឬចំណាយដើម្បីចាប់ផ្តើមកំណត់ត្រាលុយ។"
              />
            ) : (
              <div className="calendar-agenda">
                {groupedList.map(([iso, items]) => {
                  let weekday = "";
                  let day = iso;
                  let monthLabel = "";
                  try {
                    const d = parseISO(iso);
                    weekday = format(d, "EEEE", { locale: km });
                    day = format(d, "d");
                    monthLabel = format(d, "MMMM", { locale: km });
                  } catch {
                    weekday = iso;
                  }
                  return (
                    <section key={iso} className="calendar-list-group">
                      <div className="calendar-list-day-row">
                        <button
                          type="button"
                          className={`calendar-list-day ${
                            iso === todayISO() ? "is-today" : ""
                          }`}
                          onClick={() => {
                            setSelectedISO(iso);
                            setFinanceNav({ view: "month" });
                          }}
                        >
                          <span className="calendar-list-day-num">{day}</span>
                          <span className="calendar-list-day-copy">
                            <strong>{weekday}</strong>
                            <small>{monthLabel}</small>
                          </span>
                          <span className="calendar-day-count">{items.length}</span>
                        </button>
                      </div>
                      <ul className="calendar-item-list">
                        {items.map((item) => (
                          <TransactionItem
                            key={item.id}
                            item={item}
                            categoryLabel={categoryLabel}
                            onEdit={() => openEdit(item)}
                          />
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}

      <Modal
        open={formOpen}
        title={editingId ? "កែប្រតិបត្តិការ" : "ប្រតិបត្តិការថ្មី"}
        onClose={closeForm}
      >
        <form className="event-form finance-form" onSubmit={onSubmit}>
          <section className="event-card">
            <div className="event-row event-row-stack">
              <span className="event-row-label">ប្រភេទ</span>
              <div className="event-period is-kinds" role="group" aria-label="ប្រភេទ">
                <button
                  type="button"
                  data-active={type === "income"}
                  aria-pressed={type === "income"}
                  onClick={() => onTypeChange("income")}
                >
                  ចំណូល
                
                </button>
                <button
                  type="button"
                  data-active={type === "expense"}
                  aria-pressed={type === "expense"}
                  onClick={() => onTypeChange("expense")}
                >
                  ចំណាយ
                
                </button>
              </div>
            </div>
            <div className="event-row finance-amount-row">
              <span className="event-row-label">ចំនួន</span>
              <input
                className="event-row-input"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={currency === "KHR" ? "20000" : "50"}
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
            <CategoryPicker
              label="ប្រភេទលុយ"
              kind={type === "income" ? "income" : "expense"}
              value={category}
              onChange={setCategory}
            />
            <DatePickerField
              label="ថ្ងៃ"
              value={date}
              onChange={setDate}
              required
            />
            <label className="event-notes-field">
              <span className="event-row-label">កំណត់ចំណាំ</span>
              <textarea
                className="event-notes-input"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ព័ត៌មានបន្ថែម..."
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
              រក្សាទុក
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
              onClick={() => void sendFinanceReport()}
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

function TransactionItem({
  item,
  categoryLabel,
  onEdit,
}: {
  item: Transaction;
  categoryLabel: (id: string) => string;
  onEdit: () => void;
}) {
  const saved = isSavingsTx(item);
  const tone = item.type === "income" ? "income" : saved ? "save" : "expense";
  const sign = item.type === "income" || saved ? "+" : "-";
  const pair = formatMoneyPair(toUsd(item.amount, item.currency));
  const typeLabel = saved
    ? labelTransactionType("save")
    : labelTransactionType(item.type);

  return (
    <li>
      <button
        type="button"
        className={`calendar-item is-tap-edit finance-tx ${tone}`}
        onClick={onEdit}
      >
        <div className="calendar-item-body">
          <p className="calendar-item-title">{categoryLabel(item.category)}</p>
          <p className="calendar-item-meta">
            <span className={`finance-tx-kind is-${tone}`}>{typeLabel}</span>
            {item.note ? <span className="finance-tx-note">{item.note}</span> : null}
          </p>
        </div>
        <div className={`finance-tx-amount is-${tone}`}>
          <strong>
            {sign}
            {pair.khr}
          </strong>
          <span>
            {sign}
            {pair.usd}
          </span>
        </div>
      </button>
    </li>
  );
}
