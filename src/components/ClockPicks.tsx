"use client";

import { useLayoutEffect, useRef } from "react";
import { joinClock, splitClock, type ClockPeriod } from "@/lib/utils";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function snapMinute(minute: number) {
  return MINUTES.reduce((best, item) =>
    Math.abs(item - minute) < Math.abs(best - minute) ? item : best
  );
}

function itemSize(scroller: HTMLElement) {
  const item = scroller.querySelector<HTMLElement>(".clock-wheel-item");
  return item?.offsetHeight || 40;
}

function ScrollColumn({
  options,
  value,
  onChange,
  format,
  label,
}: {
  options: number[];
  value: number;
  onChange: (next: number) => void;
  format?: (n: number) => string;
  label: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ignoreRef = useRef(false);
  const settleRef = useRef<number>(0);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const sync = () => {
      const idx = Math.max(0, options.indexOf(value));
      const top = idx * itemSize(el);
      if (Math.abs(el.scrollTop - top) < 1) return;
      ignoreRef.current = true;
      el.scrollTop = top;
      requestAnimationFrame(() => {
        ignoreRef.current = false;
      });
    };

    sync();
    const frame = requestAnimationFrame(sync);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleRef.current);
    };
  }, [value]);

  function commitFromScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.max(
      0,
      Math.min(options.length - 1, Math.round(el.scrollTop / itemSize(el)))
    );
    const next = options[idx];
    if (next !== value) onChange(next);
    else {
      ignoreRef.current = true;
      el.scrollTo({ top: idx * itemSize(el), behavior: "smooth" });
      window.setTimeout(() => {
        ignoreRef.current = false;
      }, 220);
    }
  }

  return (
    <div className="clock-wheel">
      <div className="clock-wheel-mark" aria-hidden />
      <div
        ref={scrollerRef}
        className="clock-wheel-scroller"
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onScroll={() => {
          if (ignoreRef.current) return;
          window.clearTimeout(settleRef.current);
          settleRef.current = window.setTimeout(commitFromScroll, 90);
        }}
        onKeyDown={(e) => {
          const idx = options.indexOf(value);
          if (e.key === "ArrowUp") {
            e.preventDefault();
            const next = options[Math.max(0, idx - 1)];
            if (next !== undefined) onChange(next);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = options[Math.min(options.length - 1, idx + 1)];
            if (next !== undefined) onChange(next);
          }
        }}
      >
        <div className="clock-wheel-pad" aria-hidden />
        {options.map((n) => (
          <button
            key={n}
            type="button"
            role="option"
            aria-selected={n === value}
            className="clock-wheel-item"
            data-active={n === value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(n)}
          >
            {format ? format(n) : n}
          </button>
        ))}
        <div className="clock-wheel-pad" aria-hidden />
      </div>
    </div>
  );
}

export function ClockPicks({
  value,
  onChange,
  hourLabel,
  minuteLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  hourLabel: string;
  minuteLabel: string;
}) {
  const clock = splitClock(value);
  const minute = snapMinute(clock.minute);

  function setPart(next: {
    hour12?: number;
    minute?: number;
    period?: ClockPeriod;
  }) {
    onChange(
      joinClock(
        next.hour12 ?? clock.hour12,
        next.minute ?? minute,
        next.period ?? clock.period
      )
    );
  }

  return (
    <div className="clock-picks">
      <ScrollColumn
        options={HOURS}
        value={clock.hour12}
        onChange={(hour12) => setPart({ hour12 })}
        label={hourLabel}
      />
      <span className="clock-colon" aria-hidden>
        :
      </span>
      <ScrollColumn
        options={MINUTES}
        value={minute}
        onChange={(nextMinute) => setPart({ minute: nextMinute })}
        format={(n) => String(n).padStart(2, "0")}
        label={minuteLabel}
      />
      <div
        className="event-period"
        role="group"
        aria-label="ព្រឹក ឬ ល្ងាច"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-active={clock.period === "am"}
          aria-pressed={clock.period === "am"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPart({ period: "am" })}
        >
          ព្រឹក
        </button>
        <button
          type="button"
          data-active={clock.period === "pm"}
          aria-pressed={clock.period === "pm"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPart({ period: "pm" })}
        >
          ល្ងាច
        </button>
      </div>
    </div>
  );
}
