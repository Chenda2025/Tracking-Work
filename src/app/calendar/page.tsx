"use client";

import {
  FormEvent,
  MouseEvent,
  ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format, parseISO } from "date-fns";
import { km } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  MoreVertical,
  Pencil,
  Plus,
  Repeat,
  Settings2,
  Trash2,
} from "lucide-react";
import { DatePickerField } from "@/components/DatePicker";
import { DoneExportModal } from "@/components/DoneExportModal";
import { EmptyState } from "@/components/EmptyState";
import { HydrationGate } from "@/components/HydrationGate";
import { Modal } from "@/components/Modal";
import { TelegramConfigModal } from "@/components/TelegramConfigModal";
import { useTrackingStore } from "@/lib/store";
import type {
  ActivityRepeat,
  CalendarEvent,
  EventAlert,
  EventEndRepeat,
  EventRepeatFrequency,
  FolderColor,
  FolderPriority,
  Reminder,
} from "@/lib/types";
import {
  ACTIVITY_REPEATS,
  EVENT_ALERTS,
  EVENT_REPEAT_FREQUENCIES,
  FOLDER_COLORS,
  FOLDER_PRIORITIES,
  WEEKDAY_HEADERS_KM,
  buildMonthGrid,
  calendarMarksForMonth,
  eventsForDate,
  folderColorMeta,
  formatClock,
  formatShortDate,
  getChildFolders,
  getFolderPath,
  joinClock,
  labelActivityRepeat,
  labelEventAlert,
  labelEventEndRepeat,
  labelEventRepeatFrequency,
  labelFolderPriority,
  nextISOForWeekday,
  nowClockTime,
  remindersForDate,
  shiftMonth,
  splitClock,
  todayISO,
  weekdayFromISO,
  type ClockPeriod,
} from "@/lib/utils";

type CreateKind = "event" | "reminder" | null;
type ViewMode = "month" | "list" | "folders" | "done";

const VIEW_MODES: ViewMode[] = ["month", "list", "folders", "done"];

function defaultEventEndTime() {
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
}

function parseViewMode(value: string | null, hasFolder = false): ViewMode {
  if (VIEW_MODES.includes(value as ViewMode)) return value as ViewMode;
  return hasFolder ? "folders" : "month";
}

export default function CalendarPage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <CalendarContent />
      </Suspense>
    </HydrationGate>
  );
}

function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const browseFolderId = searchParams.get("folder");
  const view = parseViewMode(searchParams.get("view"), Boolean(browseFolderId));

  const events = useTrackingStore((s) => s.events);
  const reminders = useTrackingStore((s) => s.reminders);
  const folders = useTrackingStore((s) => s.activityFolders);
  const addEvent = useTrackingStore((s) => s.addEvent);
  const updateEvent = useTrackingStore((s) => s.updateEvent);
  const setEventCompleted = useTrackingStore((s) => s.setEventCompleted);
  const deleteEvent = useTrackingStore((s) => s.deleteEvent);
  const addReminder = useTrackingStore((s) => s.addReminder);
  const toggleReminder = useTrackingStore((s) => s.toggleReminder);
  const addActivityFolder = useTrackingStore((s) => s.addActivityFolder);
  const deleteActivityFolder = useTrackingStore((s) => s.deleteActivityFolder);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedISO, setSelectedISO] = useState(todayISO);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState<FolderColor>("teal");
  const [folderPriority, setFolderPriority] = useState<FolderPriority>("medium");
  const [folderError, setFolderError] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteConfirmError, setDeleteConfirmError] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [repeatingEventId, setRepeatingEventId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [telegramConfigOpen, setTelegramConfigOpen] = useState(false);

  const [eventTitle, setEventTitle] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventFolderId, setEventFolderId] = useState("");
  const [eventDate, setEventDate] = useState(todayISO);
  const [eventEndDate, setEventEndDate] = useState(todayISO);
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventStart, setEventStart] = useState(nowClockTime);
  const [eventEnd, setEventEnd] = useState(defaultEventEndTime);
  const [eventRepeatFrequency, setEventRepeatFrequency] =
    useState<EventRepeatFrequency>("never");
  const [eventEndRepeatType, setEventEndRepeatType] = useState<
    EventEndRepeat["type"]
  >("never");
  const [eventEndRepeatDate, setEventEndRepeatDate] = useState(todayISO);
  const [eventEndRepeatCount, setEventEndRepeatCount] = useState("10");
  const [eventAlert, setEventAlert] = useState<EventAlert>("none");

  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [reminderDate, setReminderDate] = useState(todayISO);
  const [reminderHasTime, setReminderHasTime] = useState(false);
  const [reminderTime, setReminderTime] = useState(nowClockTime);
  const [reminderRepeat, setReminderRepeat] = useState<ActivityRepeat[]>([]);
  const [reminderAlert, setReminderAlert] = useState<EventAlert>("none");

  function setCalendarNav(next: {
    view?: ViewMode;
    folder?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextView = next.view ?? view;
    if (nextView === "month") params.delete("view");
    else params.set("view", nextView);

    const nextFolder =
      next.folder !== undefined ? next.folder : browseFolderId;
    if (nextView === "folders" && nextFolder) params.set("folder", nextFolder);
    else params.delete("folder");

    const qs = params.toString();
    router.replace(qs ? `/calendar?${qs}` : "/calendar", { scroll: false });
  }

  useEffect(() => {
    if (!browseFolderId) return;
    if (folders.some((folder) => folder.id === browseFolderId)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("folder");
    const qs = params.toString();
    router.replace(qs ? `/calendar?${qs}` : "/calendar", { scroll: false });
  }, [browseFolderId, folders, router, searchParams]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const activeEvents = useMemo(
    () => events.filter((item) => !item.completed),
    [events]
  );
  const doneEvents = useMemo(
    () =>
      events
        .filter((item) => item.completed)
        .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")),
    [events]
  );
  const marks = useMemo(
    () => calendarMarksForMonth(month, activeEvents, reminders),
    [month, activeEvents, reminders]
  );

  const dayEvents = useMemo(() => {
    return eventsForDate(events, selectedISO).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });
  }, [events, selectedISO]);
  const dayReminders = useMemo(
    () => remindersForDate(reminders, selectedISO),
    [reminders, selectedISO]
  );

  const folderNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of folders) map[f.id] = f.name;
    return map;
  }, [folders]);

  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => {
      const aRoot = a.parentId ? 1 : 0;
      const bRoot = b.parentId ? 1 : 0;
      if (aRoot !== bRoot) return aRoot - bRoot;
      const aLabel = a.parentId
        ? `${folderNameById[a.parentId] ?? ""} / ${a.name}`
        : a.name;
      const bLabel = b.parentId
        ? `${folderNameById[b.parentId] ?? ""} / ${b.name}`
        : b.name;
      return aLabel.localeCompare(bLabel, "km");
    });
  }, [folders, folderNameById]);

  const currentFolder = useMemo(
    () => folders.find((f) => f.id === browseFolderId) ?? null,
    [folders, browseFolderId]
  );
  const folderPath = useMemo(
    () => (browseFolderId ? getFolderPath(folders, browseFolderId) : []),
    [folders, browseFolderId]
  );
  const childFolders = useMemo(
    () => getChildFolders(folders, browseFolderId),
    [folders, browseFolderId]
  );
  const isSubfolder = Boolean(currentFolder?.parentId);
  const folderEvents = useMemo(() => {
    if (!browseFolderId) return [];
    return activeEvents
      .filter((e) => e.folderId === browseFolderId)
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate) return byDate;
        return (a.startTime || "").localeCompare(b.startTime || "");
      });
  }, [activeEvents, browseFolderId]);

  const upcoming = useMemo(() => {
    const days: {
      iso: string;
      weekday: string;
      day: string;
      month: string;
      isToday: boolean;
      events: CalendarEvent[];
      reminders: Reminder[];
    }[] = [];
    const start = parseISO(todayISO());
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = format(d, "yyyy-MM-dd");
      const e = eventsForDate(activeEvents, iso);
      const r = remindersForDate(reminders, iso).filter((item) => !item.completed);
      if (e.length === 0 && r.length === 0) continue;
      days.push({
        iso,
        weekday: format(d, "EEEE", { locale: km }),
        day: format(d, "d"),
        month: format(d, "MMMM", { locale: km }),
        isToday: i === 0,
        events: e,
        reminders: r,
      });
    }
    return days;
  }, [activeEvents, reminders]);

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

  function prepareCreateForDay(iso: string, date?: Date, inMonth = true) {
    setSelectedISO(iso);
    setEventDate(iso);
    setEventEndDate(iso);
    setReminderDate(iso);
    setEventEndRepeatDate(iso);
    if (view === "folders" && browseFolderId) {
      setEventFolderId(browseFolderId);
    }
    if (date && !inMonth) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }

  function openCreateForDay(iso: string, date?: Date, inMonth = true) {
    prepareCreateForDay(iso, date, inMonth);
    setChooserOpen(true);
  }

  function openCreate(kind: "event" | "reminder") {
    setChooserOpen(false);
    setEditingEventId(null);
    if (kind === "event") {
      setEventTitle("");
      setEventLocation("");
      setEventNotes("");
      setEventAllDay(false);
      setEventStart(nowClockTime());
      setEventEnd(defaultEventEndTime());
      setEventRepeatFrequency("never");
      setEventEndRepeatType("never");
      setEventEndRepeatCount("10");
      setEventAlert("none");
    } else {
      setReminderTitle("");
      setReminderNotes("");
      setReminderHasTime(false);
      setReminderTime(nowClockTime());
      setReminderRepeat([]);
      setReminderAlert("none");
    }
    setCreateKind(kind);
  }

  function openEventForDay(iso: string, date?: Date, inMonth = true) {
    setCreateKind("event");
    setChooserOpen(false);
    setEditingEventId(null);
    prepareCreateForDay(iso, date, inMonth);
    openCreate("event");
  }

  function openEditEvent(item: CalendarEvent) {
    setEditingEventId(item.id);
    setEventTitle(item.title);
    setEventLocation(item.location ?? "");
    setEventNotes(item.notes ?? "");
    setEventFolderId(item.folderId ?? "");
    setEventDate(item.date);
    setEventEndDate(item.endDate || item.date);
    setEventAllDay(item.allDay);
    setEventStart(item.startTime || nowClockTime());
    setEventEnd(item.endTime || nowClockTime());
    setEventRepeatFrequency(item.repeatFrequency ?? "never");
    setEventEndRepeatType(item.endRepeat?.type ?? "never");
    setEventEndRepeatDate(
      item.endRepeat?.type === "on_date" ? item.endRepeat.date : item.date
    );
    setEventEndRepeatCount(
      item.endRepeat?.type === "after" ? String(item.endRepeat.count) : "10"
    );
    setEventAlert(item.alert ?? "none");
    setSelectedISO(item.date);
    setCreateKind("event");
  }

  function openRepeatEvent(item: CalendarEvent) {
    setRepeatingEventId(item.id);
    setEventDate(item.date);
    setEventRepeatFrequency(item.repeatFrequency ?? "never");
    setEventEndRepeatType(item.endRepeat?.type ?? "never");
    setEventEndRepeatDate(
      item.endRepeat?.type === "on_date" ? item.endRepeat.date : item.date
    );
    setEventEndRepeatCount(
      item.endRepeat?.type === "after" ? String(item.endRepeat.count) : "10"
    );
  }

  function closeRepeatForm() {
    setRepeatingEventId(null);
    setEventRepeatFrequency("never");
    setEventEndRepeatType("never");
    setEventEndRepeatDate(selectedISO);
    setEventEndRepeatCount("10");
  }

  function onSubmitRepeat(e: FormEvent) {
    e.preventDefault();
    if (!repeatingEventId) return;
    updateEvent(repeatingEventId, {
      repeatFrequency: eventRepeatFrequency,
      endRepeat: buildEventEndRepeat(),
    });
    closeRepeatForm();
  }

  function closeEventForm() {
    resetEventForm();
    setEditingEventId(null);
    setCreateKind(null);
  }

  function buildEventEndRepeat(): EventEndRepeat {
    if (eventRepeatFrequency === "never") return { type: "never" };
    if (eventEndRepeatType === "on_date") {
      return { type: "on_date", date: eventEndRepeatDate || eventDate };
    }
    if (eventEndRepeatType === "after") {
      return {
        type: "after",
        count: Math.max(1, Number(eventEndRepeatCount) || 1),
      };
    }
    return { type: "never" };
  }

  function resetEventForm() {
    setEventTitle("");
    setEventLocation("");
    setEventNotes("");
    setEventFolderId("");
    setEventDate(selectedISO);
    setEventEndDate(selectedISO);
    setEventAllDay(false);
    setEventStart(nowClockTime());
    setEventEnd(nowClockTime());
    setEventRepeatFrequency("never");
    setEventEndRepeatType("never");
    setEventEndRepeatDate(selectedISO);
    setEventEndRepeatCount("10");
    setEventAlert("none");
  }

  function resetReminderForm() {
    setReminderTitle("");
    setReminderNotes("");
    setReminderDate(selectedISO);
    setReminderHasTime(false);
    setReminderTime(nowClockTime());
    setReminderRepeat([]);
    setReminderAlert("none");
  }

  function onSubmitEvent(e: FormEvent) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    const payload = {
      title: eventTitle,
      location: eventLocation,
      notes: eventNotes,
      date: eventDate,
      endDate: eventEndDate < eventDate ? eventDate : eventEndDate,
      allDay: eventAllDay,
      startTime: eventAllDay ? "" : eventStart,
      endTime: eventAllDay ? "" : eventEnd,
      folderId: eventFolderId || null,
      repeatFrequency: eventRepeatFrequency,
      endRepeat: buildEventEndRepeat(),
      alert: eventAlert,
    };
    if (editingEventId) {
      updateEvent(editingEventId, payload);
    } else {
      addEvent(payload);
    }
    closeEventForm();
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
      alert: reminderAlert,
    });
    resetReminderForm();
    setCreateKind(null);
    setSelectedISO(reminderDate);
    setMonth(
      new Date(parseISO(reminderDate).getFullYear(), parseISO(reminderDate).getMonth(), 1)
    );
  }


  function openFolderModal() {
    setFolderName("");
    setFolderColor("teal");
    setFolderPriority("medium");
    setFolderError("");
    setFolderOpen(true);
  }

  function onCreateFolder(e: FormEvent) {
    e.preventDefault();
    setFolderError("");
    const parentId = currentFolder?.id ?? null;
    const id = addActivityFolder(folderName, parentId, {
      color: folderColor,
      priority: folderPriority,
    });
    if (!id) {
      setFolderError(
        "មិនអាចបង្កើតបាន — ឈ្មោះទទេ ឬមានឈ្មោះដូចគ្នាក្នុងថតនេះរួចហើយ។"
      );
      return;
    }
    setFolderOpen(false);
    setFolderName("");
  }

  function makeDeleteConfirmCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 4; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }

  function openDeleteFolder(id: string) {
    setDeleteFolderId(id);
    setDeleteConfirmCode(makeDeleteConfirmCode());
    setDeleteConfirmInput("");
    setDeleteConfirmError("");
  }

  function closeDeleteFolder() {
    setDeleteFolderId(null);
    setDeleteConfirmCode("");
    setDeleteConfirmInput("");
    setDeleteConfirmError("");
  }

  function onDeleteFolder(e: FormEvent) {
    e.preventDefault();
    if (!deleteFolderId) return;
    if (deleteConfirmInput.trim().toUpperCase() !== deleteConfirmCode) {
      setDeleteConfirmError("លេខកូដមិនត្រូវ");
      return;
    }
    const id = deleteFolderId;
    deleteActivityFolder(id);
    if (browseFolderId === id) {
      const parent = folders.find((f) => f.id === id)?.parentId ?? null;
      setCalendarNav({ folder: parent });
    }
    closeDeleteFolder();
  }

  const deleteFolderTarget = deleteFolderId
    ? folders.find((f) => f.id === deleteFolderId) ?? null
    : null;

  return (
    <div className="page">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-actions">
          <div className="tabs calendar-view-tabs" role="tablist" aria-label="ទិដ្ឋភាពប្រតិទិន">
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "month"}
              data-active={view === "month"}
              onClick={() => setCalendarNav({ view: "month", folder: null })}
            >
              ខែ
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "list"}
              data-active={view === "list"}
              onClick={() => setCalendarNav({ view: "list", folder: null })}
            >
              បញ្ជី
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "folders"}
              data-active={view === "folders"}
              onClick={() => setCalendarNav({ view: "folders" })}
            >
              ថត
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={view === "done"}
              data-active={view === "done"}
              onClick={() => setCalendarNav({ view: "done", folder: null })}
            >
              ធ្វើរួចរាល់
            </button>
          </div>
          {view === "folders" ? (
            !isSubfolder ? (
              <button type="button" className="btn btn-primary" onClick={openFolderModal}>
                <FolderPlus size={16} />{" "}
                {currentFolder ? "បន្ថែមថតរង" : "បន្ថែមថត"}
              </button>
            ) : null
          ) : view === "done" ? (
            <div className="calendar-done-actions">
              <button
                type="button"
                className="btn btn-secondary btn-telegram-config"
                aria-label="ការកំណត់ Telegram"
                title="ការកំណត់ Telegram"
                onClick={() => setTelegramConfigOpen(true)}
              >
                <Settings2 size={16} />
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={doneEvents.length === 0}
                onClick={() => setExportOpen(true)}
              >
                នាំចេញ
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openCreateForDay(selectedISO)}
            >
              <Plus size={16} /> បន្ថែម
            </button>
          )}
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
                <span key={`${d}-${i}`} className={i === 0 ? "is-sun" : ""}>
                  {d}
                </span>
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
                    aria-label={format(cell.date, "d MMMM yyyy", { locale: km })}
                    onClick={() =>
                      prepareCreateForDay(cell.iso, cell.date, cell.inMonth)
                    }
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
                <p className="calendar-kicker">{selectedParts.weekday}</p>
                <h3 className="calendar-day-title">{selectedParts.date}</h3>
              </div>
              {dayEvents.length + dayReminders.length > 0 ? (
                <span className="calendar-day-count">
                  {dayEvents.length + dayReminders.length}
                </span>
              ) : null}
            </div>

            {dayEvents.length === 0 && dayReminders.length === 0 ? (
              <p className="calendar-day-empty">មិនមានព្រឹត្តិការណ៍ ឬការរំលឹក</p>
            ) : (
              <ul className="calendar-item-list">
                {dayEvents.map((item) => (
                  <EventAgendaItem
                    key={item.id}
                    item={item}
                    folderName={
                      item.folderId ? folderNameById[item.folderId] : undefined
                    }
                    showMenu={false}
                    onToggleComplete={() =>
                      setEventCompleted(item.id, !item.completed)
                    }
                    onEdit={() => openEditEvent(item)}
                    onRepeat={() => openRepeatEvent(item)}
                    onDelete={() => deleteEvent(item.id)}
                  />
                ))}
                {dayReminders.map((item) => (
                  <ReminderAgendaItem
                    key={item.id}
                    item={item}
                    onToggle={() => toggleReminder(item.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {view === "list" ? (
        <section className="surface calendar-day-panel calendar-list-panel">
          <div className="calendar-list-head">
            <div className="min-w-0">
              <p className="calendar-kicker">១៤ ថ្ងៃខាងមុខ</p>
              <h3 className="calendar-day-title">បញ្ជី</h3>
            </div>
            <OverflowMenu label="ម៉ឺនុយបញ្ជី">
              {(run) => (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="calendar-item-menu-btn is-edit"
                    aria-label="បន្ថែមព្រឹត្តិការណ៍"
                    onClick={(e) =>
                      run(e, () => {
                        prepareCreateForDay(todayISO());
                        openCreate("event");
                      })
                    }
                  >
                    <CalendarDays size={15} />
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="calendar-item-menu-btn is-repeat"
                    aria-label="បន្ថែមការរំលឹក"
                    onClick={(e) =>
                      run(e, () => {
                        prepareCreateForDay(todayISO());
                        openCreate("reminder");
                      })
                    }
                  >
                    <Bell size={15} />
                  </button>
                </>
              )}
            </OverflowMenu>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              title="មិនមានព្រឹត្តិការណ៍ ឬការរំលឹកខាងមុខ"
              description="បន្ថែមព្រឹត្តិការណ៍ ឬការរំលឹក ដើម្បីមើលបញ្ជី ១៤ ថ្ងៃខាងមុខ។"
            />
          ) : (
            <div className="calendar-agenda">
              {upcoming.map((day) => (
                <section key={day.iso} className="calendar-list-group">
                  <div className="calendar-list-day-row">
                    <button
                      type="button"
                      className={`calendar-list-day ${day.isToday ? "is-today" : ""}`}
                      onClick={() => {
                        setSelectedISO(day.iso);
                        setCalendarNav({ view: "month", folder: null });
                        const d = parseISO(day.iso);
                        setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                      }}
                    >
                      <span className="calendar-list-day-num">{day.day}</span>
                      <span className="calendar-list-day-copy">
                        <strong>{day.weekday}</strong>
                        <small>{day.month}</small>
                      </span>
                      <span className="calendar-day-count">
                        {day.events.length + day.reminders.length}
                      </span>
                    </button>
                    <OverflowMenu label="បន្ថែមថ្ងៃនេះ">
                      {(run) => (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            className="calendar-item-menu-btn is-edit"
                            aria-label="បន្ថែមព្រឹត្តិការណ៍"
                            onClick={(e) =>
                              run(e, () => {
                                prepareCreateForDay(day.iso, parseISO(day.iso));
                                openCreate("event");
                              })
                            }
                          >
                            <CalendarDays size={15} />
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="calendar-item-menu-btn is-repeat"
                            aria-label="បន្ថែមការរំលឹក"
                            onClick={(e) =>
                              run(e, () => {
                                prepareCreateForDay(day.iso, parseISO(day.iso));
                                openCreate("reminder");
                              })
                            }
                          >
                            <Bell size={15} />
                          </button>
                        </>
                      )}
                    </OverflowMenu>
                  </div>
                  <ul className="calendar-item-list">
                    {day.events.map((item) => (
                      <EventAgendaItem
                        key={item.id}
                        item={item}
                        compact
                        onEdit={() => openEditEvent(item)}
                        onRepeat={() => openRepeatEvent(item)}
                        onDelete={() => deleteEvent(item.id)}
                      />
                    ))}
                    {day.reminders.map((item) => (
                      <ReminderAgendaItem
                        key={item.id}
                        item={item}
                        compact
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {view === "folders" ? (
        <>
          {folderPath.length > 0 ? (
            <nav className="calendar-folder-crumb" aria-label="ផ្លូវថត">
              <button
                type="button"
                className="calendar-crumb-link"
                onClick={() => setCalendarNav({ folder: null })}
              >
                ថតទាំងអស់
              </button>
              {folderPath.map((folder) => {
                const active = folder.id === browseFolderId;
                return (
                  <span key={folder.id} className="inline-flex items-center gap-1">
                    <ChevronRight size={14} className="text-ink-soft" />
                    <button
                      type="button"
                      className={`calendar-crumb-link ${active ? "is-active" : ""}`}
                      onClick={() => setCalendarNav({ folder: folder.id })}
                    >
                      {folder.name}
                    </button>
                  </span>
                );
              })}
            </nav>
          ) : null}

          <section className="surface calendar-day-panel">
            {childFolders.length === 0 ? (
              <EmptyState
                title={browseFolderId ? "មិនទាន់មានថតរង" : "មិនទាន់មានថត"}
                description={
                  browseFolderId
                    ? "ចុច បន្ថែមថតរង ដើម្បីបង្កើតថតកូន។"
                    : "ចុច បន្ថែមថត ដើម្បីបង្កើតថតថ្មី។"
                }
                action={
                  !isSubfolder ? (
                    <button type="button" className="btn btn-primary" onClick={openFolderModal}>
                      <FolderPlus size={16} />{" "}
                      {browseFolderId ? "បន្ថែមថតរង" : "បន្ថែមថត"}
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="calendar-folder-grid">
                {childFolders.map((folder) => {
                  const color = folderColorMeta(folder.color);
                  const count = activeEvents.filter((e) => e.folderId === folder.id).length;
                  return (
                    <li key={folder.id} className="calendar-folder-card">
                      <button
                        type="button"
                        className="calendar-folder-open"
                        onClick={() => setCalendarNav({ folder: folder.id })}
                      >
                        <span
                          className="calendar-folder-icon"
                          style={{ backgroundColor: color.swatch }}
                        >
                          <Folder size={16} />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="calendar-item-title block truncate">
                            {folder.name}
                          </span>
                          <span className="calendar-item-meta">
                            អាទិភាព៖ {labelFolderPriority(folder.priority)}
                            {count ? ` · ${count} ព្រឹត្តិការណ៍` : ""}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-icon"
                        aria-label="លុបថត"
                        onClick={() => openDeleteFolder(folder.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {browseFolderId ? (
            <section className="surface calendar-day-panel">
              <div className="calendar-day-head">
                <div className="min-w-0">
                  <p className="calendar-kicker">ព្រឹត្តិការណ៍ក្នុងថត</p>
                  <h3 className="calendar-day-title">
                    {currentFolder?.name ?? "ថត"}
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => openCreateForDay(selectedISO)}
                >
                  បន្ថែមព្រឹត្តិការណ៍
                </button>
              </div>
              {folderEvents.length === 0 ? (
                <EmptyState
                  title="មិនទាន់មានព្រឹត្តិការណ៍ក្នុងថតនេះ"
                  description="បង្កើតព្រឹត្តិការណ៍ រួចជ្រើសថតនេះ។"
                />
              ) : (
                <ul className="calendar-item-list">
                  {folderEvents.map((item) => (
                    <EventAgendaItem
                      key={item.id}
                      item={item}
                      showDate
                      compact
                      onToggleComplete={() =>
                        setEventCompleted(item.id, !item.completed)
                      }
                      onEdit={() => openEditEvent(item)}
                      onRepeat={() => openRepeatEvent(item)}
                      onDelete={() => deleteEvent(item.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {view === "done" ? (
        <section className="surface calendar-day-panel">
          {doneEvents.length === 0 ? (
            <p className="calendar-day-empty">មិនទាន់មានព្រឹត្តិការណ៍រួចរាល់</p>
          ) : (
            <ul className="calendar-item-list">
              {doneEvents.map((item) => (
                <EventAgendaItem
                  key={item.id}
                  item={item}
                  folderName={
                    item.folderId ? folderNameById[item.folderId] : undefined
                  }
                  showDate
                  onToggleComplete={() =>
                    setEventCompleted(item.id, !item.completed)
                  }
                  onEdit={() => openEditEvent(item)}
                  onRepeat={() => openRepeatEvent(item)}
                  onDelete={() => deleteEvent(item.id)}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <DoneExportModal
        open={exportOpen}
        items={doneEvents}
        folderNameById={folderNameById}
        onClose={() => setExportOpen(false)}
      />

      <TelegramConfigModal
        open={telegramConfigOpen}
        onClose={() => setTelegramConfigOpen(false)}
      />

      <Modal
        open={Boolean(repeatingEventId)}
        title="ធ្វើម្តងទៀត"
        size="sm"
        onClose={closeRepeatForm}
      >
        <form className="event-form" onSubmit={onSubmitRepeat}>
          <section className="event-card">
            <label className="event-row">
              <span className="event-row-label">ធ្វើម្តងទៀត</span>
              <select
                className="event-row-input event-row-select"
                value={eventRepeatFrequency}
                onChange={(e) => {
                  const next = e.target.value as EventRepeatFrequency;
                  setEventRepeatFrequency(next);
                  if (next === "never") setEventEndRepeatType("never");
                }}
              >
                {EVENT_REPEAT_FREQUENCIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {eventRepeatFrequency !== "never" ? (
              <>
                <label className="event-row">
                  <span className="event-row-label">បញ្ចប់</span>
                  <select
                    className="event-row-input event-row-select"
                    value={eventEndRepeatType}
                    onChange={(e) =>
                      setEventEndRepeatType(e.target.value as EventEndRepeat["type"])
                    }
                  >
                    <option value="never">មិនដែល</option>
                    <option value="on_date">នៅថ្ងៃ</option>
                    <option value="after">បន្ទាប់ពីចំនួនដង</option>
                  </select>
                </label>
                {eventEndRepeatType === "on_date" ? (
                  <DatePickerField
                    label="ថ្ងៃបញ្ចប់"
                    value={eventEndRepeatDate}
                    minDate={eventDate}
                    onChange={(next) =>
                      setEventEndRepeatDate(next < eventDate ? eventDate : next)
                    }
                    required
                  />
                ) : null}
                {eventEndRepeatType === "after" ? (
                  <label className="event-row">
                    <span className="event-row-label">ចំនួនដង</span>
                    <input
                      type="number"
                      className="event-row-input event-row-date"
                      min={1}
                      max={999}
                      value={eventEndRepeatCount}
                      onChange={(e) => setEventEndRepeatCount(e.target.value)}
                      required
                    />
                  </label>
                ) : null}
              </>
            ) : null}
          </section>
          <div className="form-actions event-form-actions">
            <button type="button" className="btn btn-ghost" onClick={closeRepeatForm}>
              បោះបង់
            </button>
            <button type="submit" className="btn btn-primary">
              រក្សាទុក
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={folderOpen}
        title={currentFolder ? "បង្កើតថតរង" : "បង្កើតថតថ្មី"}
        onClose={() => {
          setFolderOpen(false);
          setFolderError("");
        }}
      >
        <form className="space-y-3.5" onSubmit={onCreateFolder}>
          {currentFolder ? (
            <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-deep">
              ថតមេ៖ {currentFolder.name}
            </p>
          ) : null}
          <label className="block space-y-1.5">
            <span className="form-label">ឈ្មោះថត</span>
            <input
              className="input"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setFolderError("");
              }}
              placeholder="ឧ. គម្រោង / ថ្នាក់ / កិច្ចការ"
              required
              autoFocus
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="form-label mb-0">ពណ៌</legend>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => {
                const selected = folderColor === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFolderColor(c.value)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                      selected
                        ? "scale-105 border-ink"
                        : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c.swatch }}
                    aria-label={c.label}
                    aria-pressed={selected}
                    title={c.label}
                  />
                );
              })}
            </div>
          </fieldset>
          <label className="block space-y-1.5">
            <span className="form-label">អាទិភាព</span>
            <select
              className="input"
              value={folderPriority}
              onChange={(e) =>
                setFolderPriority(e.target.value as FolderPriority)
              }
            >
              {FOLDER_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {folderError ? <p className="text-sm text-danger">{folderError}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setFolderOpen(false);
                setFolderError("");
              }}
            >
              បោះបង់
            </button>
            <button type="submit" className="btn btn-primary">
              បង្កើតថត
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteFolderId)}
        title="លុបថត"
        onClose={closeDeleteFolder}
        size="sm"
      >
        <form className="folder-delete-confirm" onSubmit={onDeleteFolder}>
          <p className="folder-delete-confirm-lead">
            លុបថត <strong>{deleteFolderTarget?.name ?? ""}</strong>
          </p>
          <p className="folder-delete-confirm-hint">
            វាយលេខកូដខាងក្រោមដើម្បីបញ្ជាក់
          </p>
          <p className="folder-delete-confirm-code" aria-live="polite">
            {deleteConfirmCode}
          </p>
          <label className="block space-y-1.5">
            <span className="form-label">លេខកូដ</span>
            <input
              className="input"
              value={deleteConfirmInput}
              onChange={(e) => {
                setDeleteConfirmInput(e.target.value);
                setDeleteConfirmError("");
              }}
              placeholder={deleteConfirmCode}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          {deleteConfirmError ? (
            <p className="text-sm text-danger">{deleteConfirmError}</p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeDeleteFolder}
            >
              បោះបង់
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={
                deleteConfirmInput.trim().toUpperCase() !== deleteConfirmCode
              }
            >
              លុបថត
            </button>
          </div>
        </form>
      </Modal>

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
        title={editingEventId ? "កែព្រឹត្តិការណ៍" : "ព្រឹត្តិការណ៍ថ្មី"}
        onClose={closeEventForm}
      >
        <form className="event-form" onSubmit={onSubmitEvent}>
          <section className="event-card">
            <label className="event-title-field">
              <span className="sr-only">ចំណងជើង</span>
              <input
                className="event-title-input"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="ចំណងជើង"
                required
              />
            </label>
            <label className="event-row">
              <span className="event-row-label">ទីតាំង</span>
              <input
                className="event-row-input"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="ឧ. ទីស្នាក់ការ"
              />
            </label>
            <label className="event-row">
              <span className="event-row-label">ថត</span>
              <select
                className="event-row-input event-row-select"
                value={eventFolderId}
                onChange={(e) => setEventFolderId(e.target.value)}
              >
                <option value="">គ្មានថត</option>
                {sortedFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.parentId
                      ? `${folderNameById[f.parentId] ?? ""} / ${f.name}`
                      : f.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="event-card">
            <label className="event-row event-row-switch">
              <span className="event-row-label">ពេញថ្ងៃ</span>
              <input
                type="checkbox"
                className="event-toggle"
                checked={eventAllDay}
                onChange={(e) => setEventAllDay(e.target.checked)}
              />
            </label>
            <DateTimeField
              label="ចាប់ផ្តើម"
              date={eventDate}
              time={eventStart}
              showTime={!eventAllDay}
              onDateChange={(next) => {
                setEventDate(next);
                if (eventEndDate < next) setEventEndDate(next);
              }}
              onTimeChange={setEventStart}
            />
            <DateTimeField
              label="បញ្ចប់"
              date={eventEndDate}
              time={eventEnd}
              showTime={!eventAllDay}
              minDate={eventDate}
              onDateChange={(next) => {
                setEventEndDate(next < eventDate ? eventDate : next);
              }}
              onTimeChange={setEventEnd}
            />
          </section>

          <section className="event-card">
            <label className="event-row">
              <span className="event-row-label">ធ្វើម្តងទៀត</span>
              <select
                className="event-row-input event-row-select"
                value={eventRepeatFrequency}
                onChange={(e) => {
                  const next = e.target.value as EventRepeatFrequency;
                  setEventRepeatFrequency(next);
                  if (next === "never") setEventEndRepeatType("never");
                }}
              >
                {EVENT_REPEAT_FREQUENCIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {eventRepeatFrequency !== "never" ? (
              <>
                <label className="event-row">
                  <span className="event-row-label">បញ្ចប់</span>
                  <select
                    className="event-row-input event-row-select"
                    value={eventEndRepeatType}
                    onChange={(e) =>
                      setEventEndRepeatType(e.target.value as EventEndRepeat["type"])
                    }
                  >
                    <option value="never">មិនដែល</option>
                    <option value="on_date">នៅថ្ងៃ</option>
                    <option value="after">បន្ទាប់ពីចំនួនដង</option>
                  </select>
                </label>
                {eventEndRepeatType === "on_date" ? (
                  <DatePickerField
                    label="ថ្ងៃបញ្ចប់"
                    value={eventEndRepeatDate}
                    minDate={eventDate}
                    onChange={(next) =>
                      setEventEndRepeatDate(next < eventDate ? eventDate : next)
                    }
                    required
                  />
                ) : null}
                {eventEndRepeatType === "after" ? (
                  <label className="event-row">
                    <span className="event-row-label">ចំនួនដង</span>
                    <input
                      type="number"
                      className="event-row-input event-row-date"
                      min={1}
                      max={999}
                      value={eventEndRepeatCount}
                      onChange={(e) => setEventEndRepeatCount(e.target.value)}
                      required
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            <label className="event-row">
              <span className="event-row-label">ការជូនដំណឹង</span>
              <select
                className="event-row-input event-row-select"
                value={eventAlert}
                onChange={(e) => setEventAlert(e.target.value as EventAlert)}
              >
                {EVENT_ALERTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="event-card">
            <label className="event-notes-field">
              <span className="event-row-label">កំណត់ចំណាំ</span>
              <textarea
                className="event-notes-input"
                rows={3}
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                placeholder="ព័ត៌មានបន្ថែម..."
              />
            </label>
          </section>

          <div className="form-actions event-form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeEventForm}
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
        <form className="event-form" onSubmit={onSubmitReminder}>
          <section className="event-card">
            <label className="event-title-field">
              <span className="sr-only">ចំណងជើង</span>
              <input
                className="event-title-input"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="ចំណងជើង"
                required
              />
            </label>
          </section>

          <section className="event-card">
            <DayField
              date={reminderDate}
              onChange={(next, day) => {
                setReminderDate(next);
                if (reminderRepeat.length === 1) setReminderRepeat([day]);
              }}
            />
            <RepeatField value={reminderRepeat} onChange={setReminderRepeat} />
            <label className="event-row">
              <span className="event-row-label">ជូនដំណឹងមុន</span>
              <select
                className="event-row-input event-row-select"
                value={reminderAlert}
                onChange={(e) => setReminderAlert(e.target.value as EventAlert)}
              >
                {EVENT_ALERTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="event-row event-row-switch">
              <span className="event-row-label">មានម៉ោង</span>
              <input
                type="checkbox"
                className="event-toggle"
                checked={reminderHasTime}
                onChange={(e) => setReminderHasTime(e.target.checked)}
              />
            </label>
            {reminderHasTime ? (
              <TimeField label="ម៉ោង" value={reminderTime} onChange={setReminderTime} />
            ) : null}
          </section>

          <section className="event-card">
            <label className="event-notes-field">
              <span className="event-row-label">កំណត់ចំណាំ</span>
              <textarea
                className="event-notes-input"
                rows={3}
                value={reminderNotes}
                onChange={(e) => setReminderNotes(e.target.value)}
                placeholder="ព័ត៌មានបន្ថែម..."
              />
            </label>
          </section>

          <div className="form-actions event-form-actions">
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

function OverflowMenu({
  label,
  children,
}: {
  label: string;
  children: (
    run: (e: MouseEvent, action?: () => void) => void
  ) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function run(e: MouseEvent, action?: () => void) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    window.setTimeout(() => action?.(), 0);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="calendar-item-menu" ref={ref}>
      <button
        type="button"
        className="calendar-item-menu-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} />
      </button>
      {open ? (
        <div
          className="calendar-item-menu-panel"
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children(run)}
        </div>
      ) : null}
    </div>
  );
}

function eventWhen(item: CalendarEvent): { start: string; end?: string } {
  if (item.allDay) return { start: "ពេញថ្ងៃ" };
  return {
    start: item.startTime ? formatClock(item.startTime) : "—",
    end: item.endTime ? formatClock(item.endTime) : undefined,
  };
}

function EventAgendaItem({
  item,
  folderName,
  showDate,
  compact,
  showMenu = true,
  onToggleComplete,
  onEdit,
  onRepeat,
  onDelete,
}: {
  item: CalendarEvent;
  folderName?: string;
  showDate?: boolean;
  compact?: boolean;
  showMenu?: boolean;
  onToggleComplete?: () => void;
  onEdit?: () => void;
  onRepeat?: () => void;
  onDelete?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const done = Boolean(item.completed);
  const when = eventWhen(item);
  const span =
    item.endDate && item.endDate !== item.date
      ? `${formatShortDate(item.date)} – ${formatShortDate(item.endDate)}`
      : "";
  const tags = compact
    ? [
        item.repeatFrequency && item.repeatFrequency !== "never"
          ? labelEventRepeatFrequency(item.repeatFrequency)
          : "",
      ].filter(Boolean)
    : [
        showDate && !span ? formatShortDate(item.date) : "",
        span,
        folderName ?? "",
        labelEventRepeatFrequency(item.repeatFrequency),
        labelEventEndRepeat(item.endRepeat),
        labelEventAlert(item.alert)
          ? `ជូនដំណឹង ${labelEventAlert(item.alert)}`
          : "",
      ].filter(Boolean);

  function runMenuAction(
    e: MouseEvent,
    action?: () => void
  ) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    window.setTimeout(() => action?.(), 0);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <li
      className={`calendar-item event ${done ? "is-done" : ""} ${
        !showMenu && onEdit ? "is-tap-edit" : ""
      }`}
      onClick={!showMenu && onEdit ? () => onEdit() : undefined}
    >
      <div className="calendar-item-when">
        <span className="calendar-item-start">{when.start}</span>
        {when.end ? <span className="calendar-item-end">{when.end}</span> : null}
      </div>
      <div className="calendar-item-body">
        <p className="calendar-item-title">{item.title}</p>
        {item.location ? (
          <p className="calendar-item-place">{item.location}</p>
        ) : null}
        {tags.length > 0 ? (
          <div className="calendar-item-tags">
            {tags.map((tag) => (
              <span key={tag} className="calendar-tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {!compact && item.notes ? (
          <p className="calendar-item-notes">{item.notes}</p>
        ) : null}
      </div>
      {onToggleComplete ? (
      <button
        type="button"
        className={`calendar-item-complete ${done ? "is-on" : ""}`}
        aria-label={done ? "ស្តារព្រឹត្តិការណ៍" : "សម្គាល់រួចរាល់"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete();
        }}
      >
        {done ? <Check size={13} /> : null}
      </button>
      ) : null}
      {showMenu ? (
      <div className="calendar-item-menu" ref={menuRef}>
        <button
          type="button"
          className="calendar-item-menu-trigger"
          aria-label="ម៉ឺនុយព្រឹត្តិការណ៍"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen ? (
          <div
            className="calendar-item-menu-panel"
            role="menu"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="calendar-item-menu-btn is-edit"
              aria-label="កែព្រឹត្តិការណ៍"
              onClick={(e) => runMenuAction(e, onEdit)}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              role="menuitem"
              className="calendar-item-menu-btn is-repeat"
              aria-label="ធ្វើម្តងទៀត"
              onClick={(e) => runMenuAction(e, onRepeat)}
            >
              <Repeat size={15} />
            </button>
            <button
              type="button"
              role="menuitem"
              className="calendar-item-menu-btn is-delete"
              aria-label="លុបព្រឹត្តិការណ៍"
              onClick={(e) => runMenuAction(e, onDelete)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : null}
      </div>
      ) : null}
    </li>
  );
}

function ReminderAgendaItem({
  item,
  compact,
  onToggle,
}: {
  item: Reminder;
  compact?: boolean;
  onToggle?: () => void;
}) {
  const repeat = labelActivityRepeat(item.repeat);
  const alert = labelEventAlert(item.alert);
  const tags = [
    repeat,
    alert ? `ជូនដំណឹង ${alert}` : "",
  ].filter(Boolean);
  return (
    <li className={`calendar-item reminder ${item.completed ? "is-done" : ""}`}>
      <div className="calendar-item-when">
        <span className="calendar-item-start">
          {item.dueTime ? formatClock(item.dueTime) : "—"}
        </span>
      </div>
      <div className="calendar-item-body">
        <p className="calendar-item-title">{item.title}</p>
        {!compact && tags.length > 0 ? (
          <div className="calendar-item-tags">
            {tags.map((tag) => (
              <span key={tag} className="calendar-tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {!compact && item.notes ? (
          <p className="calendar-item-notes">{item.notes}</p>
        ) : null}
      </div>
      {onToggle ? (
      <button
        type="button"
        className={`calendar-check ${item.completed ? "is-on" : ""}`}
        aria-label={item.completed ? "មិនទាន់រួច" : "សម្គាល់រួច"}
        onClick={onToggle}
      >
        {item.completed ? <Check size={13} /> : null}
      </button>
      ) : null}
    </li>
  );
}


function DateTimeField({
  label,
  date,
  time,
  showTime = true,
  minDate,
  onDateChange,
  onTimeChange,
}: {
  label: string;
  date: string;
  time: string;
  showTime?: boolean;
  minDate?: string;
  onDateChange: (next: string) => void;
  onTimeChange?: (next: string) => void;
}) {
  const clock = splitClock(time);
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  function setPart(next: { hour12?: number; minute?: number; period?: ClockPeriod }) {
    onTimeChange?.(
      joinClock(
        next.hour12 ?? clock.hour12,
        next.minute ?? clock.minute,
        next.period ?? clock.period
      )
    );
  }

  return (
    <div className="event-row event-row-time">
      <span className="event-row-label">{label}</span>
      <div className="event-time-controls">
        <DatePickerField
          variant="inline"
          value={date}
          minDate={minDate}
          onChange={onDateChange}
          ariaLabel={`${label} ថ្ងៃ`}
          required
        />
        {showTime ? (
          <div className="event-time-line">
            <select
              className="event-time-select"
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
            <span className="calendar-time-colon" aria-hidden>
              :
            </span>
            <select
              className="event-time-select"
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
            <div className="event-period" role="group" aria-label="ព្រឹក ឬ ល្ងាច">
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
        ) : null}
      </div>
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
    <div className="event-row event-row-clock">
      <span className="event-row-label">{label}</span>
      <div className="event-time-line">
        <select
          className="event-time-select"
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
          className="event-time-select"
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
        <div className="event-period" role="group" aria-label="ព្រឹក ឬ ល្ងាច">
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

function DayField({
  date,
  onChange,
}: {
  date: string;
  onChange: (next: string, day: ActivityRepeat) => void;
}) {
  const selected = weekdayFromISO(date);
  return (
    <div className="event-row event-row-time">
      <span className="event-row-label">ថ្ងៃ</span>
      <div className="event-time-controls">
        <div className="day-chips event-day-chips" role="group" aria-label="ថ្ងៃ">
          {ACTIVITY_REPEATS.map((r) => {
            const checked = selected === r.value;
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
                    weekdayFromISO(date) === r.value
                      ? date
                      : nextISOForWeekday(r.value, date),
                    r.value
                  )
                }
              >
                {r.short}
              </button>
            );
          })}
        </div>
        <span className="event-day-date">{formatShortDate(date)}</span>
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
    <div className="event-repeat-block">
      <span className="event-row-label">ធ្វើម្តងទៀត</span>
      <div className="day-chips event-day-chips" role="group" aria-label="ថ្ងៃធ្វើម្តងទៀត">
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
