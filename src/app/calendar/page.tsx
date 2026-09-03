"use client";

import { FormEvent, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { km } from "date-fns/locale";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { HydrationGate } from "@/components/HydrationGate";
import { Modal } from "@/components/Modal";
import { useTrackingStore } from "@/lib/store";
import type { ActivityRepeat, CalendarEvent, Reminder } from "@/lib/types";
import {
  ACTIVITY_REPEATS,
  WEEKDAY_HEADERS_KM,
  buildMonthGrid,
  calendarMarksForMonth,
  eventsForDate,
  formatClock,
  joinClock,
  labelActivityRepeat,
  nowClockTime,
  remindersForDate,
  shiftMonth,
  splitClock,
  todayISO,
  type ClockPeriod,
} from "@/lib/utils";

type CreateKind = "event" | "reminder" | null;
type ViewMode = "month" | "list";

export default function CalendarPage() {
  return (
    <HydrationGate>
      <CalendarContent />
    </HydrationGate>
  );
}

function CalendarContent() {
  const events = useTrackingStore((s) => s.events);
  const reminders = useTrackingStore((s) => s.reminders);
  const addEvent = useTrackingStore((s) => s.addEvent);
  const deleteEvent = useTrackingStore((s) => s.deleteEvent);
  const addReminder = useTrackingStore((s) => s.addReminder);
  const toggleReminder = useTrackingStore((s) => s.toggleReminder);
  const deleteReminder = useTrackingStore((s) => s.deleteReminder);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedISO, setSelectedISO] = useState(todayISO);
  const [view, setView] = useState<ViewMode>("month");
  const [chooserOpen, setChooserOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind>(null);

  const [eventTitle, setEventTitle] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventDate, setEventDate] = useState(todayISO);
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventStart, setEventStart] = useState(nowClockTime);
  const [eventEnd, setEventEnd] = useState(() => {
    const { hour12, minute, period } = splitClock(nowClockTime());
    let h = hour12 === 12 ? 1 : hour12 + 1;
    let p = period;
    if (hour12 === 11 && period === "am") p = "pm";
    if (hour12 === 11 && period === "pm") {
      h = 12;
      p = "pm";
    }
    if (hour12 === 12 && period === "pm") h = 1;
    return joinClock(h, minute, p);
  });
  const [eventRepeat, setEventRepeat] = useState<ActivityRepeat[]>([]);

  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [reminderDate, setReminderDate] = useState(todayISO);
  const [reminderHasTime, setReminderHasTime] = useState(false);
  const [reminderTime, setReminderTime] = useState(nowClockTime);
  const [reminderRepeat, setReminderRepeat] = useState<ActivityRepeat[]>([]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const marks = useMemo(
    () => calendarMarksForMonth(month, events, reminders),
    [month, events, reminders]
  );

  const dayEvents = useMemo(
    () => eventsForDate(events, selectedISO),
    [events, selectedISO]
  );
  const dayReminders = useMemo(
    () => remindersForDate(reminders, selectedISO),
    [reminders, selectedISO]
  );

  const upcoming = useMemo(() => {
    const days: { iso: string; label: string; events: CalendarEvent[]; reminders: Reminder[] }[] =
      [];
    const start = parseISO(todayISO());
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = format(d, "yyyy-MM-dd");
      const e = eventsForDate(events, iso);
      const r = remindersForDate(reminders, iso);
      if (e.length === 0 && r.length === 0) continue;
      days.push({
        iso,
        label: format(d, "EEEE d MMMM", { locale: km }),
        events: e,
        reminders: r,
      });
    }
    return days;
  }, [events, reminders]);

  const selectedLabel = useMemo(() => {
    try {
      return format(parseISO(selectedISO), "EEEE d MMMM yyyy", { locale: km });
    } catch {
      return selectedISO;
    }
  }, [selectedISO]);

  function openCreateForDay(iso: string, date?: Date, inMonth = true) {
    setSelectedISO(iso);
    setEventDate(iso);
    setReminderDate(iso);
    if (date && !inMonth) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    setChooserOpen(true);
  }

  function openCreate(kind: "event" | "reminder") {
    setChooserOpen(false);
    setCreateKind(kind);
  }

  function resetEventForm() {
    setEventTitle("");
    setEventLocation("");
    setEventNotes("");
    setEventDate(selectedISO);
    setEventAllDay(false);
    setEventStart(nowClockTime());
    setEventEnd(nowClockTime());
    setEventRepeat([]);
  }

  function resetReminderForm() {
    setReminderTitle("");
    setReminderNotes("");
    setReminderDate(selectedISO);
    setReminderHasTime(false);
    setReminderTime(nowClockTime());
    setReminderRepeat([]);
  }

  function onSubmitEvent(e: FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    addEvent({
      title: eventTitle,
      location: eventLocation,
      notes: eventNotes,
      date: eventDate,
      allDay: eventAllDay,
      startTime: eventAllDay ? "" : eventStart,
      endTime: eventAllDay ? "" : eventEnd,
      repeat: eventRepeat,
    });
    resetEventForm();
    setCreateKind(null);
    setSelectedISO(eventDate);
    setMonth(new Date(parseISO(eventDate).getFullYear(), parseISO(eventDate).getMonth(), 1));
  }

  function onSubmitReminder(e: FormEvent) {
    e.preventDefault();
    if (!reminderTitle.trim()) return;
    addReminder({
      title: reminderTitle,
      notes: reminderNotes,
      dueDate: reminderDate,
      dueTime: reminderHasTime ? reminderTime : "",
      repeat: reminderRepeat,
    });
    resetReminderForm();
    setCreateKind(null);
    setSelectedISO(reminderDate);
    setMonth(
      new Date(parseISO(reminderDate).getFullYear(), parseISO(reminderDate).getMonth(), 1)
    );
  }

  function goToday() {
    const iso = todayISO();
    setSelectedISO(iso);
    const d = parseISO(iso);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  return (
    <div className="page">
      <div className="calendar-toolbar">
        <div className="min-w-0">
          <h1 className="page-header-title">ប្រតិទិន</h1>
          <p className="font-subtitle mt-1 text-sm text-ink-muted">
            ព្រឹត្តិការណ៍ និងការរំលឹក
          </p>
        </div>
        <div className="calendar-toolbar-actions">
          <div className="tabs calendar-view-tabs" role="tablist" aria-label="ទិដ្ឋភាពប្រតិទិន">
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "month"}
              data-active={view === "month"}
              onClick={() => setView("month")}
            >
              ខែ
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "list"}
              data-active={view === "list"}
              onClick={() => setView("list")}
            >
              បញ្ជី
            </button>
          </div>
          <button type="button" className="btn btn-secondary" onClick={goToday}>
            ថ្ងៃនេះ
          </button>
        </div>
      </div>

      {view === "month" ? (
        <>
          <section className="surface calendar-month">
            <div className="calendar-month-head">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="ខែមុន"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="calendar-month-title">
                {format(month, "MMMM yyyy", { locale: km })}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="ខែបន្ទាប់"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="calendar-weekdays" aria-hidden>
              {WEEKDAY_HEADERS_KM.map((d, i) => (
                <span key={`${d}-${i}`}>{d}</span>
              ))}
            </div>

            <div className="calendar-grid" role="grid" aria-label="ប្រតិទិនខែ">
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
                    aria-label={`${format(cell.date, "d MMMM yyyy", { locale: km })} — បន្ថែមព្រឹត្តិការណ៍ ឬការរំលឹក`}
                    title="ចុចដើម្បីបន្ថែមព្រឹត្តិការណ៍ ឬការរំលឹក"
                    onClick={() => openCreateForDay(cell.iso, cell.date, cell.inMonth)}
                  >
                    <span className="calendar-day-num">{format(cell.date, "d")}</span>
                    <span className="calendar-dots" aria-hidden>
                      {mark?.events ? <i className="dot-event" /> : null}
                      {mark?.reminders ? <i className="dot-reminder" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="surface calendar-day-panel">
            <div className="calendar-day-head">
              <div className="min-w-0">
                <p className="calendar-kicker">ថ្ងៃដែលបានជ្រើស</p>
                <h3 className="calendar-day-title">{selectedLabel}</h3>
              </div>
            </div>

            {dayEvents.length === 0 && dayReminders.length === 0 ? (
              <EmptyState
                title="មិនមានព្រឹត្តិការណ៍ ឬការរំលឹក"
                description="បង្កើតព្រឹត្តិការណ៍ ឬការរំលឹកសម្រាប់ថ្ងៃនេះ។"
              />
            ) : (
              <div className="calendar-agenda">
                {dayEvents.length > 0 ? (
                  <div>
                    <p className="calendar-section-label">ព្រឹត្តិការណ៍</p>
                    <ul className="calendar-item-list">
                      {dayEvents.map((item) => (
                        <li key={item.id} className="calendar-item event">
                          <div className="min-w-0 flex-1">
                            <p className="calendar-item-title">{item.title}</p>
                            <p className="calendar-item-meta">
                              {item.allDay
                                ? "ពេញថ្ងៃ"
                                : [
                                    item.startTime ? formatClock(item.startTime) : "",
                                    item.endTime ? formatClock(item.endTime) : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" – ")}
                              {item.location ? ` · ${item.location}` : ""}
                              {labelActivityRepeat(item.repeat)
                                ? ` · ${labelActivityRepeat(item.repeat)}`
                                : ""}
                            </p>
                            {item.notes ? (
                              <p className="calendar-item-notes">{item.notes}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-icon"
                            aria-label="លុបព្រឹត្តិការណ៍"
                            onClick={() => deleteEvent(item.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {dayReminders.length > 0 ? (
                  <div>
                    <p className="calendar-section-label">ការរំលឹក</p>
                    <ul className="calendar-item-list">
                      {dayReminders.map((item) => (
                        <li
                          key={item.id}
                          className={`calendar-item reminder ${
                            item.completed ? "is-done" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className={`calendar-check ${item.completed ? "is-on" : ""}`}
                            aria-label={item.completed ? "មិនទាន់រួច" : "សម្គាល់រួច"}
                            onClick={() => toggleReminder(item.id)}
                          >
                            {item.completed ? <Check size={14} /> : null}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="calendar-item-title">{item.title}</p>
                            <p className="calendar-item-meta">
                              {item.dueTime ? formatClock(item.dueTime) : "គ្មានម៉ោង"}
                              {labelActivityRepeat(item.repeat)
                                ? ` · ${labelActivityRepeat(item.repeat)}`
                                : ""}
                            </p>
                            {item.notes ? (
                              <p className="calendar-item-notes">{item.notes}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-icon"
                            aria-label="លុបការរំលឹក"
                            onClick={() => deleteReminder(item.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="surface calendar-day-panel">
          {upcoming.length === 0 ? (
            <EmptyState
              title="មិនមានព្រឹត្តិការណ៍ ឬការរំលឹកខាងមុខ"
              description="បន្ថែមព្រឹត្តិការណ៍ ឬការរំលឹក ដើម្បីមើលបញ្ជី ១៤ ថ្ងៃខាងមុខ។"
            />
          ) : (
            <div className="calendar-agenda">
              {upcoming.map((day) => (
                <div key={day.iso}>
                  <button
                    type="button"
                    className="calendar-list-day"
                    onClick={() => {
                      setSelectedISO(day.iso);
                      setView("month");
                      const d = parseISO(day.iso);
                      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                    }}
                  >
                    {day.label}
                  </button>
                  <ul className="calendar-item-list">
                    {day.events.map((item) => (
                      <li key={item.id} className="calendar-item event">
                        <div className="min-w-0 flex-1">
                          <p className="calendar-item-title">{item.title}</p>
                          <p className="calendar-item-meta">
                            ព្រឹត្តិការណ៍ ·{" "}
                            {item.allDay
                              ? "ពេញថ្ងៃ"
                              : item.startTime
                                ? formatClock(item.startTime)
                                : ""}
                            {item.location ? ` · ${item.location}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger btn-icon"
                          onClick={() => deleteEvent(item.id)}
                          aria-label="លុប"
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                    {day.reminders.map((item) => (
                      <li
                        key={item.id}
                        className={`calendar-item reminder ${
                          item.completed ? "is-done" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className={`calendar-check ${item.completed ? "is-on" : ""}`}
                          onClick={() => toggleReminder(item.id)}
                          aria-label="បិទ/បើក"
                        >
                          {item.completed ? <Check size={14} /> : null}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="calendar-item-title">{item.title}</p>
                          <p className="calendar-item-meta">
                            ការរំលឹក
                            {item.dueTime ? ` · ${formatClock(item.dueTime)}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger btn-icon"
                          onClick={() => deleteReminder(item.id)}
                          aria-label="លុប"
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal
        open={chooserOpen}
        title="បន្ថែមថ្មី"
        onClose={() => setChooserOpen(false)}
        size="sm"
      >
        <div className="calendar-chooser">
          <button type="button" className="calendar-chooser-item" onClick={() => openCreate("event")}>
            <span className="chooser-icon event">
              <CalendarDays size={20} />
            </span>
            <span>
              <strong className="font-display">ព្រឹត្តិការណ៍</strong>
              <small className="font-subtitle">ប្រជុំ ការណាត់ជួប ឬថ្ងៃពិសេស</small>
            </span>
          </button>
          <button
            type="button"
            className="calendar-chooser-item"
            onClick={() => openCreate("reminder")}
          >
            <span className="chooser-icon reminder">
              <Bell size={20} />
            </span>
            <span>
              <strong className="font-display">ការរំលឹក</strong>
              <small className="font-subtitle">ការងារត្រូវធ្វើ ឬការរំលឹក</small>
            </span>
          </button>
        </div>
      </Modal>

      <Modal
        open={createKind === "event"}
        title="ព្រឹត្តិការណ៍ថ្មី"
        onClose={() => {
          resetEventForm();
          setCreateKind(null);
        }}
      >
        <form className="form-activity" onSubmit={onSubmitEvent}>
          <div className="form-activity-body space-y-4">
            <label className="block">
              <span className="form-label">ចំណងជើង</span>
              <input
                className="input"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="ឧ. ប្រជុំក្រុម"
                required
              />
            </label>
            <label className="block">
              <span className="form-label">ទីតាំង</span>
              <input
                className="input"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="ឧ. ទីស្នាក់ការ / Zoom"
              />
            </label>
            <label className="block">
              <span className="form-label">ថ្ងៃ</span>
              <input
                type="date"
                className="input"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </label>
            <label className="calendar-switch">
              <input
                type="checkbox"
                checked={eventAllDay}
                onChange={(e) => setEventAllDay(e.target.checked)}
              />
              <span>ពេញថ្ងៃ</span>
            </label>
            {!eventAllDay ? (
              <div className="schedule-grid">
                <TimeField label="ចាប់ផ្តើម" value={eventStart} onChange={setEventStart} />
                <TimeField label="បញ្ចប់" value={eventEnd} onChange={setEventEnd} />
              </div>
            ) : null}
            <RepeatField value={eventRepeat} onChange={setEventRepeat} />
            <label className="block">
              <span className="form-label">កំណត់ចំណាំ</span>
              <textarea
                className="input form-notes"
                rows={3}
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                placeholder="ព័ត៌មានបន្ថែម…"
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                resetEventForm();
                setCreateKind(null);
              }}
            >
              បោះបង់
            </button>
            <button type="submit" className="btn btn-primary">
              រក្សាទុក
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={createKind === "reminder"}
        title="ការរំលឹកថ្មី"
        onClose={() => {
          resetReminderForm();
          setCreateKind(null);
        }}
      >
        <form className="form-activity" onSubmit={onSubmitReminder}>
          <div className="form-activity-body space-y-4">
            <label className="block">
              <span className="form-label">ចំណងជើង</span>
              <input
                className="input"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="ឧ. ហៅទូរស័ព្ទ / ទិញអីវ៉ាន់"
                required
              />
            </label>
            <label className="block">
              <span className="form-label">ថ្ងៃ</span>
              <input
                type="date"
                className="input"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                required
              />
            </label>
            <label className="calendar-switch">
              <input
                type="checkbox"
                checked={reminderHasTime}
                onChange={(e) => setReminderHasTime(e.target.checked)}
              />
              <span>មានម៉ោង</span>
            </label>
            {reminderHasTime ? (
              <TimeField label="ម៉ោង" value={reminderTime} onChange={setReminderTime} />
            ) : null}
            <RepeatField value={reminderRepeat} onChange={setReminderRepeat} />
            <label className="block">
              <span className="form-label">កំណត់ចំណាំ</span>
              <textarea
                className="input form-notes"
                rows={3}
                value={reminderNotes}
                onChange={(e) => setReminderNotes(e.target.value)}
                placeholder="ព័ត៌មានបន្ថែម…"
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                resetReminderForm();
                setCreateKind(null);
              }}
            >
              បោះបង់
            </button>
            <button type="submit" className="btn btn-primary">
              រក្សាទុក
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const clock = splitClock(value);
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  function setPart(next: { hour12?: number; minute?: number; period?: ClockPeriod }) {
    onChange(
      joinClock(
        next.hour12 ?? clock.hour12,
        next.minute ?? clock.minute,
        next.period ?? clock.period
      )
    );
  }

  return (
    <div>
      <span className="form-label">{label}</span>
      <div className="calendar-time-row">
        <select
          className="input"
          value={clock.hour12}
          onChange={(e) => setPart({ hour12: Number(e.target.value) })}
          aria-label={`${label} ម៉ោង`}
        >
          {hours.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="calendar-time-colon">:</span>
        <select
          className="input"
          value={clock.minute}
          onChange={(e) => setPart({ minute: Number(e.target.value) })}
          aria-label={`${label} នាទី`}
        >
          {minutes.map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
        <div className="duration-unit-toggle" role="group" aria-label="ព្រឹក ឬ ល្ងាច">
          <button
            type="button"
            data-active={clock.period === "am"}
            aria-pressed={clock.period === "am"}
            onClick={() => setPart({ period: "am" })}
          >
            ព្រឹក
          </button>
          <button
            type="button"
            data-active={clock.period === "pm"}
            aria-pressed={clock.period === "pm"}
            onClick={() => setPart({ period: "pm" })}
          >
            ល្ងាច
          </button>
        </div>
      </div>
    </div>
  );
}

function RepeatField({
  value,
  onChange,
}: {
  value: ActivityRepeat[];
  onChange: (next: ActivityRepeat[]) => void;
}) {
  return (
    <div>
      <span className="form-label">ធ្វើម្តងទៀត</span>
      <div className="day-chips" role="group" aria-label="ថ្ងៃធ្វើម្តងទៀត">
        {ACTIVITY_REPEATS.map((r) => {
          const checked = value.includes(r.value);
          return (
            <button
              key={r.value}
              type="button"
              className="day-chip"
              data-active={checked}
              aria-pressed={checked}
              title={r.label}
              aria-label={r.label}
              onClick={() =>
                onChange(
                  checked ? value.filter((day) => day !== r.value) : [...value, r.value]
                )
              }
            >
              {r.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
