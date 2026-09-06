"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, parse, parseISO, isValid } from "date-fns";
import { km } from "date-fns/locale";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import {
  WEEKDAY_HEADERS_KM,
  buildMonthGrid,
  formatMonth,
  shiftMonth,
} from "@/lib/utils";

type DatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  required?: boolean;
  minDate?: string;
  variant?: "row" | "inline";
  ariaLabel?: string;
};

function clampToMin(iso: string, minDate?: string) {
  if (minDate && iso < minDate) return minDate;
  return iso;
}

function toDisplayHeader(iso: string): string {
  try {
    return format(parseISO(iso), "EEEE d MMMM", { locale: km });
  } catch {
    return iso;
  }
}

function toSlashDate(iso: string): string {
  try {
    const d = parseISO(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

function parseSlashDate(raw: string): string | null {
  const trimmed = raw.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = parse(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    "yyyy-MM-dd",
    new Date()
  );
  if (!isValid(parsed)) return null;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return format(parsed, "yyyy-MM-dd");
}

export function DatePickerField({
  value,
  onChange,
  label,
  required,
  minDate,
  variant = "row",
  ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const pickerLabel =
    ariaLabel ?? (label ? `${label} ថ្ងៃ` : "ជ្រើសរើសកាលបរិច្ឆេទ");

  return (
    <>
      {variant === "inline" ? (
        <button
          type="button"
          className="event-date-picker"
          aria-label={pickerLabel}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <span>{toDisplayHeader(value)}</span>
          <CalendarDays size={15} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          className="event-row finance-date-trigger"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {label ? <span className="event-row-label">{label}</span> : null}
          <span className="event-row-input finance-date-value">
            {toDisplayHeader(value)}
          </span>
          <CalendarDays className="finance-date-icon" size={16} aria-hidden />
        </button>
      )}
      {required ? (
        <input type="hidden" value={value} required readOnly />
      ) : null}
      <DatePickerModal
        open={open}
        value={value}
        minDate={minDate}
        onClose={() => setOpen(false)}
        onConfirm={(next) => {
          onChange(clampToMin(next, minDate));
          setOpen(false);
        }}
      />
    </>
  );
}

function DatePickerModal({
  open,
  value,
  minDate,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value: string;
  minDate?: string;
  onClose: () => void;
  onConfirm: (iso: string) => void;
}) {
  const ignoreBackdrop = useRef(true);
  const [draft, setDraft] = useState(value);
  const [viewMonth, setViewMonth] = useState(() => {
    try {
      return parseISO(value);
    } catch {
      return new Date();
    }
  });
  const [mode, setMode] = useState<"calendar" | "text">("calendar");
  const [textValue, setTextValue] = useState(() => toSlashDate(value));
  const [textError, setTextError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setTextValue(toSlashDate(value));
    setTextError(false);
    setMode("calendar");
    try {
      setViewMonth(parseISO(value));
    } catch {
      setViewMonth(new Date());
    }
    ignoreBackdrop.current = true;
    const arm = window.setTimeout(() => {
      ignoreBackdrop.current = false;
    }, 200);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(arm);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, value, onClose]);

  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  if (!open || typeof document === "undefined") return null;

  function confirmText() {
    const parsed = parseSlashDate(textValue);
    if (!parsed || (minDate && parsed < minDate)) {
      setTextError(true);
      return;
    }
    onConfirm(parsed);
  }

  return createPortal(
    <div className="modal-overlay date-picker-overlay">
      <button
        type="button"
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        aria-label="បោះបង់"
        onClick={() => {
          if (ignoreBackdrop.current) return;
          onClose();
        }}
      />
      <div
        className="surface-raised date-picker-panel relative z-10 animate-rise"
        role="dialog"
        aria-modal="true"
        aria-label="ជ្រើសរើសកាលបរិច្ឆេទ"
      >
        <div className="date-picker-head">
          <p className="date-picker-kicker">ជ្រើសរើសកាលបរិច្ឆេទ</p>
          <div className="date-picker-selected">
            <p className="date-picker-selected-text">{toDisplayHeader(draft)}</p>
            <button
              type="button"
              className="date-picker-mode-btn"
              aria-label="បញ្ចូលកាលបរិច្ឆេទ"
              onClick={() => {
                if (mode === "calendar") {
                  setTextValue(toSlashDate(draft));
                  setTextError(false);
                  setMode("text");
                } else {
                  setMode("calendar");
                  try {
                    setViewMonth(parseISO(draft));
                  } catch {
                    /* keep */
                  }
                }
              }}
            >
              {mode === "calendar" ? <Pencil size={18} /> : <CalendarDays size={18} />}
            </button>
          </div>
        </div>

        {mode === "calendar" ? (
          <div className="date-picker-body">
            <div className="date-picker-nav">
              <button type="button" className="date-picker-month-btn">
                <span>{formatMonth(viewMonth)}</span>
                <ChevronDown size={14} aria-hidden />
              </button>
              <div className="date-picker-arrows">
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label="ខែមុន"
                  onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label="ខែបន្ទាប់"
                  onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="date-picker-weekdays" aria-hidden>
              {WEEKDAY_HEADERS_KM.map((d, i) => (
                <span key={`${d}-${i}`}>{d}</span>
              ))}
            </div>

            <div className="date-picker-grid" role="grid">
              {cells.map((cell) => {
                const selected = cell.iso === draft;
                const disabled = Boolean(minDate && cell.iso < minDate);
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    role="gridcell"
                    className={`date-picker-day ${
                      cell.inMonth ? "" : "is-outside"
                    } ${cell.isToday ? "is-today" : ""} ${
                      selected ? "is-selected" : ""
                    } ${disabled ? "is-disabled" : ""}`}
                    aria-selected={selected}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setDraft(cell.iso);
                      if (!cell.inMonth) setViewMonth(cell.date);
                    }}
                  >
                    {format(cell.date, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="date-picker-body date-picker-text-body">
            <label className={`date-picker-field ${textError ? "is-error" : ""}`}>
              <span>បញ្ចូលកាលបរិច្ឆេទ</span>
              <input
                type="text"
                inputMode="numeric"
                value={textValue}
                onChange={(e) => {
                  setTextValue(e.target.value);
                  setTextError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmText();
                  }
                }}
                autoFocus
              />
            </label>
          </div>
        )}

        <div className="date-picker-actions">
          <button type="button" className="date-picker-action" onClick={onClose}>
            បោះបង់
          </button>
          <button
            type="button"
            className="date-picker-action is-primary"
            onClick={() => {
              if (mode === "text") confirmText();
              else onConfirm(draft);
            }}
          >
            យល់ព្រម
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
