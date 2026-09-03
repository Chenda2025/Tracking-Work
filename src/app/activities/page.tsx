"use client";

import { FormEvent, KeyboardEvent, Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronRight, Folder, FolderPlus, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { HydrationGate } from "@/components/HydrationGate";
import { Modal } from "@/components/Modal";
import { StatCard } from "@/components/StatCard";
import { useTrackingStore } from "@/lib/store";
import type {
  ActivityRepeat,
  ActivityStatus,
  FolderColor,
  FolderPriority,
} from "@/lib/types";
import {
  ACTIVITY_REPEATS,
  ACTIVITY_STATUSES,
  activityStats,
  FOLDER_COLORS,
  FOLDER_PRIORITIES,
  folderColorMeta,
  getChildFolders,
  getFolderPath,
  isActivityForToday,
  joinClock,
  labelActivityRepeat,
  labelFolderPriority,
  nowClockTime,
  splitClock,
  formatClock,
  formatShortDate,
  todayISO,
} from "@/lib/utils";

type ActivitiesTab = "today" | "folders";

export default function ActivitiesPage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <ActivitiesContent />
      </Suspense>
    </HydrationGate>
  );
}

function ActivitiesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folder");
  const tabParam = searchParams.get("tab");
  const activeTab: ActivitiesTab =
    tabParam === "folders" ? "folders" : "today";

  const activities = useTrackingStore((s) => s.activities);
  const folders = useTrackingStore((s) => s.activityFolders);
  const addActivity = useTrackingStore((s) => s.addActivity);
  const updateActivity = useTrackingStore((s) => s.updateActivity);
  const deleteActivity = useTrackingStore((s) => s.deleteActivity);
  const addActivityFolder = useTrackingStore((s) => s.addActivityFolder);

  const currentFolder = folders.find((f) => f.id === folderId) ?? null;
  const isSubfolder = Boolean(currentFolder && currentFolder.parentId);
  const folderPath = folderId ? getFolderPath(folders, folderId) : [];
  const mainFolders = useMemo(() => getChildFolders(folders, null), [folders]);
  const displayedFolders = useMemo(() => {
    if (isSubfolder && currentFolder) {
      return getChildFolders(folders, currentFolder.parentId);
    }
    return getChildFolders(folders, folderId ?? null);
  }, [folders, folderId, isSubfolder, currentFolder]);

  const folderNameById = useMemo(
    () => Object.fromEntries(folders.map((f) => [f.id, f.name])),
    [folders]
  );

  const [folderOpen, setFolderOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState<FolderColor>("teal");
  const [folderPriority, setFolderPriority] =
    useState<FolderPriority>("medium");
  const [folderError, setFolderError] = useState("");

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ActivityStatus>("planned");
  const [startTime, setStartTime] = useState(nowClockTime);
  const [activityDate, setActivityDate] = useState(todayISO);
  const [timeUnit, setTimeUnit] = useState<"hours" | "minutes">("hours");
  const [repeat, setRepeat] = useState<ActivityRepeat[]>([]);
  const [activityFolderId, setActivityFolderId] = useState("");
  const timeFaceRef = useRef<HTMLDivElement>(null);

  const todayActivities = useMemo(() => {
    const list = activities.filter((a) => isActivityForToday(a));
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activities]);

  const scoped = useMemo(() => {
    if (!folderId) return todayActivities;
    return todayActivities.filter((a) => a.folderId === folderId);
  }, [todayActivities, folderId]);

  const visible = scoped;
  const stats = activityStats(folderId ? visible : todayActivities);

  function setTab(tab: ActivitiesTab) {
    router.push(tab === "folders" ? "/activities?tab=folders" : "/activities");
  }

  function resetActivityForm() {
    setTitle("");
    setLocation("");
    setNotes("");
    setStatus("planned");
    setStartTime(nowClockTime());
    setActivityDate(todayISO());
    setTimeUnit("hours");
    setRepeat([]);
    setActivityFolderId(folderId ?? "");
  }

  const clock = splitClock(startTime);

  function focusTimeFace() {
    timeFaceRef.current?.focus();
  }

  function stepClock(direction: 1 | -1) {
    const { hour12, minute, period } = splitClock(startTime);
    if (timeUnit === "hours") {
      let next = hour12 + direction;
      if (next > 12) next = 1;
      if (next < 1) next = 12;
      setStartTime(joinClock(next, minute, period));
      return;
    }
    let nextMinute = minute + direction;
    if (nextMinute > 59) nextMinute = 0;
    if (nextMinute < 0) nextMinute = 59;
    setStartTime(joinClock(hour12, nextMinute, period));
  }

  function setPeriod(period: "am" | "pm") {
    setStartTime((prev) => {
      const { hour12, minute } = splitClock(prev);
      return joinClock(hour12, minute, period);
    });
  }

  function onTimeKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      stepClock(1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      stepClock(-1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setTimeUnit("hours");
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setTimeUnit("minutes");
    }
  }

  function openFolderModal() {
    setFolderName("");
    setFolderColor("teal");
    setFolderPriority("medium");
    setFolderError("");
    setFolderOpen(true);
  }

  function openActivityModal() {
    resetActivityForm();
    setActivityFolderId(folderId ?? "");
    setActivityOpen(true);
  }

  function handleAddActivity() {
    if (folders.length === 0) {
      setTab("folders");
      openFolderModal();
      return;
    }
    openActivityModal();
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
    setFolderName("");
    setFolderColor("teal");
    setFolderPriority("medium");
    setFolderOpen(false);
    if (!parentId) {
      router.push(`/activities?folder=${id}`);
    }
  }

  function onCreateActivity(e: FormEvent) {
    e.preventDefault();
    const targetFolder = folderId ?? activityFolderId;
    if (!title.trim() || !targetFolder) return;
    addActivity({
      title,
      location,
      notes,
      category: "work",
      status,
      date: activityDate || todayISO(),
      startTime,
      folderId: targetFolder,
      repeat,
    });
    resetActivityForm();
    setActivityOpen(false);
  }

  function renderActivityList(
    items: typeof visible,
    emptyTitle: string,
    emptyDescription: string,
    emptyAction?: React.ReactNode
  ) {
    if (items.length === 0) {
      return (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      );
    }

    return (
      <ul className="list-stack">
        {items.map((item) => (
          <li key={item.id} className="list-row items-center">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title}</p>
              {item.location ? (
                <p className="mt-0.5 text-sm text-ink-muted">{item.location}</p>
              ) : null}
              <p className="mt-0.5 text-sm text-ink-muted">
                {item.folderId && folderNameById[item.folderId]
                  ? `${folderNameById[item.folderId]} · `
                  : ""}
                {formatShortDate(item.date)}
                {item.startTime ? ` · ${formatClock(item.startTime)}` : ""}
                {item.repeat && item.repeat.length > 0
                  ? ` · ${labelActivityRepeat(item.repeat)}`
                  : ""}
              </p>
              {item.notes ? (
                <p className="mt-1 text-sm text-ink-soft">{item.notes}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <select
                className="input w-auto py-2"
                value={item.status}
                onChange={(e) =>
                  updateActivity(item.id, {
                    status: e.target.value as ActivityStatus,
                  })
                }
              >
                {ACTIVITY_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-danger btn-icon"
                onClick={() => deleteActivity(item.id)}
                aria-label="លុបសកម្មភាព"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  function renderFolderGrid(
    list: typeof displayedFolders,
    emptyTitle: string,
    emptyDescription: string
  ) {
    if (list.length === 0) {
      return <EmptyState title={emptyTitle} description={emptyDescription} />;
    }

    return (
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((folder) => {
          const isActive = folder.id === folderId;
          const color = folderColorMeta(folder.color);
          return (
            <li key={folder.id}>
              <Link
                href={`/activities?folder=${folder.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                  isActive
                    ? "shadow-sm"
                    : "border-line bg-bg-elevated text-ink-muted hover:border-line-strong hover:text-ink"
                }`}
                style={
                  isActive
                    ? {
                        borderColor: color.swatch,
                        backgroundColor: color.soft,
                        color: color.text,
                        boxShadow: `0 0 0 1px ${color.swatch}33`,
                      }
                    : undefined
                }
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: color.swatch }}
                >
                  <Folder size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate ${
                      isActive ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {folder.name}
                  </span>
                  <span className="mt-0.5 block text-xs opacity-70">
                    អាទិភាព៖ {labelFolderPriority(folder.priority)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  const atRoot = !currentFolder;

  return (
    <div className="page">
      <div className="activities-toolbar">
        <div className="min-w-0">
          <h1 className="page-header-title">
            {currentFolder ? currentFolder.name : "សកម្មភាព"}
          </h1>
          {atRoot ? (
            <p className="font-subtitle mt-1 text-sm text-ink-muted">
              {activeTab === "today"
                ? "កត់ត្រា និងតាមដានការងារថ្ងៃនេះ"
                : "រៀបចំថតសម្រាប់សកម្មភាព"}
            </p>
          ) : null}
        </div>

        <div className="activities-toolbar-actions">
          {atRoot ? (
            <div className="tabs" role="tablist" aria-label="ផ្ទាំងសកម្មភាព">
              <button
                type="button"
                role="tab"
                className="tab"
                data-active={activeTab === "today"}
                aria-selected={activeTab === "today"}
                onClick={() => setTab("today")}
              >
                <span className="tab-icon" aria-hidden>
                  <CalendarDays
                    size={16}
                    strokeWidth={activeTab === "today" ? 2.25 : 1.75}
                  />
                </span>
                ថ្ងៃនេះ
              </button>
              <button
                type="button"
                role="tab"
                className="tab"
                data-active={activeTab === "folders"}
                aria-selected={activeTab === "folders"}
                onClick={() => setTab("folders")}
              >
                <span className="tab-icon" aria-hidden>
                  <Folder
                    size={16}
                    strokeWidth={activeTab === "folders" ? 2.25 : 1.75}
                  />
                </span>
                ថត
              </button>
            </div>
          ) : null}

          {atRoot && activeTab === "folders" ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openFolderModal}
            >
              <FolderPlus size={16} /> បន្ថែមថត
            </button>
          ) : null}
          {!isSubfolder && currentFolder ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openFolderModal}
            >
              <FolderPlus size={16} /> បន្ថែមថតរង
            </button>
          ) : null}
          {(atRoot && activeTab === "today") || currentFolder ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={currentFolder ? openActivityModal : handleAddActivity}
            >
              <Plus size={16} /> បន្ថែមសកម្មភាព
            </button>
          ) : null}
        </div>
      </div>

      {folderPath.length > 0 ? (
        <nav className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
          <Link href="/activities?tab=folders" className="hover:text-brand">
            សកម្មភាព
          </Link>
          {folderPath.map((folder) => {
            const isActive = folder.id === folderId;
            return (
              <span key={folder.id} className="inline-flex items-center gap-1">
                <ChevronRight size={14} className="text-ink-soft" />
                <Link
                  href={`/activities?folder=${folder.id}`}
                  className={
                    isActive
                      ? "rounded-md bg-brand-soft px-1.5 py-0.5 font-medium text-brand-deep"
                      : "hover:text-brand"
                  }
                >
                  {folder.name}
                </Link>
              </span>
            );
          })}
        </nav>
      ) : null}

      {atRoot && activeTab === "today" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="បានកត់ត្រាថ្ងៃនេះ"
              value={String(stats.total)}
              tone="brand"
            />
            <StatCard
              label="បានបញ្ចប់"
              value={String(stats.done)}
              tone="success"
            />
            <StatCard
              label="ពេលវេលាតាមដាន"
              value={`${stats.minutes} នាទី`}
            />
          </div>
          <section className="surface p-4 md:p-5" role="tabpanel">
            <div className="section-head">
              <h2 className="section-title">ការងារថ្ងៃនេះ</h2>
            </div>
            {renderActivityList(
              todayActivities,
              "មិនទាន់មានសកម្មភាពថ្ងៃនេះ",
              folders.length === 0
                ? "បង្កើតថតជាមុន រួចបន្ថែមសកម្មភាព។"
                : "ចុច បន្ថែមសកម្មភាព ដើម្បីកត់ត្រាការងារថ្ងៃនេះ។",
              folders.length === 0 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setTab("folders");
                    openFolderModal();
                  }}
                >
                  <FolderPlus size={16} /> បង្កើតថត
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddActivity}
                >
                  <Plus size={16} /> បន្ថែមសកម្មភាព
                </button>
              )
            )}
          </section>
        </>
      ) : null}

      {atRoot && activeTab === "folders" ? (
        <section className="surface p-4 md:p-5" role="tabpanel">
          {renderFolderGrid(
            mainFolders,
            "មិនទាន់មានថត",
            "ចុច បន្ថែមថត ដើម្បីបង្កើតថតថ្មី។"
          )}
        </section>
      ) : null}

      {currentFolder ? (
        <>
          {!isSubfolder || displayedFolders.length > 0 ? (
            <section className="surface p-4 md:p-5">
              {renderFolderGrid(
                displayedFolders,
                isSubfolder ? "មិនទាន់មានថតរង" : "មិនទាន់មានថតរង",
                "ចុច បន្ថែមថតរង ដើម្បីបង្កើតថតកូនក្នុងថតនេះ។"
              )}
            </section>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="បានកត់ត្រាថ្ងៃនេះ"
              value={String(stats.total)}
              tone="brand"
            />
            <StatCard
              label="បានបញ្ចប់"
              value={String(stats.done)}
              tone="success"
            />
            <StatCard
              label="ពេលវេលាតាមដាន"
              value={`${stats.minutes} នាទី`}
            />
          </div>

          <section className="surface p-4 md:p-5">
            <div className="section-head">
              <h2 className="section-title">សកម្មភាពថ្ងៃនេះ</h2>
            </div>
            {renderActivityList(
              visible,
              "មិនទាន់មានសកម្មភាពថ្ងៃនេះ",
              "ចុច បន្ថែមសកម្មភាព ដើម្បីបង្កើតក្នុងថតនេះ។",
              <button
                type="button"
                className="btn btn-primary"
                onClick={openActivityModal}
              >
                <Plus size={16} /> បន្ថែមសកម្មភាព
              </button>
            )}
          </section>
        </>
      ) : null}

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
            <span className="text-sm font-medium">ឈ្មោះថត</span>
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
            <legend className="text-sm font-medium">ពណ៌</legend>
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
            <span className="text-sm font-medium">អាទិភាព</span>
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

          {folderError ? (
            <p className="text-sm text-danger">{folderError}</p>
          ) : null}
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
        open={activityOpen}
        title="សកម្មភាពថ្មី"
        onClose={() => setActivityOpen(false)}
      >
        <form className="form-activity" onSubmit={onCreateActivity}>
          <div className="form-activity-body">
            {currentFolder ? (
              <p className="folder-chip">{currentFolder.name}</p>
            ) : (
              <label className="block">
                <span className="form-label">ថត</span>
                <select
                  className="input"
                  value={activityFolderId}
                  onChange={(e) => setActivityFolderId(e.target.value)}
                  required
                >
                  <option value="">ជ្រើសរើសថត</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.parentId
                        ? `${folderNameById[f.parentId] ?? ""} / ${f.name}`
                        : f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="form-label">ចំណងជើង</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ឧ. ប្រជុំក្រុម / ហាត់ប្រាណ"
                required
              />
            </label>

            <label className="block">
              <span className="form-label">ទីតាំង</span>
              <input
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ឧ. ទីស្នាក់ការ / នៅផ្ទះ / កន្លែងហាត់ប្រាណ"
              />
            </label>

            <label className="block">
              <span className="form-label">កំណត់ចំណាំ</span>
              <textarea
                className="input form-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ស្រេចចិត្ត"
                rows={2}
              />
            </label>

            <div className="form-section">
              <div className="schedule-grid">
                <label className="block">
                  <span className="form-label">ថ្ងៃ</span>
                  <input
                    className="input"
                    type="date"
                    value={activityDate}
                    onChange={(e) => setActivityDate(e.target.value)}
                    required
                  />
                </label>
                <div>
                  <span className="form-label">ម៉ោង</span>
                  <div className="duration-row">
                    <div
                      ref={timeFaceRef}
                      className="duration-face"
                      role="group"
                      tabIndex={0}
                      aria-label="ម៉ោងចាប់ផ្តើម។ ប្រើព្រួញឡើង និងចុះដើម្បីផ្លាស់ប្តូរ។"
                      onKeyDown={onTimeKeyDown}
                    >
                      <button
                        type="button"
                        className="duration-seg"
                        data-active={timeUnit === "hours"}
                        aria-pressed={timeUnit === "hours"}
                        aria-label="ម៉ោង"
                        onClick={() => {
                          setTimeUnit("hours");
                          focusTimeFace();
                        }}
                        onKeyDown={onTimeKeyDown}
                      >
                        {clock.hour12}
                      </button>
                      <span className="duration-colon" aria-hidden>
                        :
                      </span>
                      <button
                        type="button"
                        className="duration-seg"
                        data-active={timeUnit === "minutes"}
                        aria-pressed={timeUnit === "minutes"}
                        aria-label="នាទី"
                        onClick={() => {
                          setTimeUnit("minutes");
                          focusTimeFace();
                        }}
                        onKeyDown={onTimeKeyDown}
                      >
                        {String(clock.minute).padStart(2, "0")}
                      </button>
                    </div>
                    <div className="duration-unit-toggle" role="group" aria-label="ព្រឹក ឬ ល្ងាច">
                      <button
                        type="button"
                        data-active={clock.period === "am"}
                        aria-pressed={clock.period === "am"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPeriod("am");
                        }}
                      >
                        ព្រឹក
                      </button>
                      <button
                        type="button"
                        data-active={clock.period === "pm"}
                        aria-pressed={clock.period === "pm"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPeriod("pm");
                        }}
                      >
                        ល្ងាច
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <span className="form-label">ធ្វើម្តងទៀត</span>
                <div className="day-chips" role="group" aria-label="ថ្ងៃធ្វើម្តងទៀត">
                  {ACTIVITY_REPEATS.map((r) => {
                    const checked = repeat.includes(r.value);
                    return (
                      <button
                        key={r.value}
                        type="button"
                        className="day-chip"
                        data-active={checked}
                        aria-pressed={checked}
                        title={r.label}
                        aria-label={r.label}
                        onClick={() => {
                          setRepeat((prev) =>
                            prev.includes(r.value)
                              ? prev.filter((day) => day !== r.value)
                              : [...prev, r.value]
                          );
                        }}
                      >
                        {r.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <span className="form-label">ស្ថានភាព</span>
              <div className="status-pills" role="group" aria-label="ស្ថានភាព">
                {ACTIVITY_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    data-active={status === s.value}
                    aria-pressed={status === s.value}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setStatus(s.value);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setActivityOpen(false)}
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
