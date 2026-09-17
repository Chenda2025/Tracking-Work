"use client";

import { useMemo } from "react";
import { useTrackingStore } from "@/lib/store";
import { todayISO, workProgressForDate } from "@/lib/utils";

export function WorkProgressChart({
  done,
  remaining,
  title = "ការងារ",
  variant = "card",
}: {
  done: number;
  remaining: number;
  title?: string;
  variant?: "card" | "header";
}) {
  const total = done + remaining;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const size = variant === "header" ? 40 : 96;
  const stroke = variant === "header" ? 5 : 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const isHeader = variant === "header";

  return (
    <section
      className={isHeader ? "work-progress is-header" : "surface work-progress"}
      aria-label={title}
    >
      {isHeader ? null : <p className="work-progress-title">{title}</p>}
      <div className="work-progress-body">
        <div className="work-progress-ring">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={
              total === 0
                ? "មិនទាន់មានការងារ"
                : `នៅសល់ ${remaining} ក្នុង ${total}`
            }
          >
            <circle
              className="work-progress-track"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
            />
            <circle
              className="work-progress-fill"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>
          <div className="work-progress-center">
            <strong>{remaining}</strong>
            {isHeader ? null : <span>នៅសល់</span>}
          </div>
        </div>
        {isHeader ? (
          <div className="work-progress-header-copy">
            <span>{total === 0 ? "មិនទាន់មានការងារ" : "នៅសល់"}</span>
          </div>
        ) : total === 0 ? (
          <p className="work-progress-empty">មិនទាន់មានការងារ</p>
        ) : (
          <div className="work-progress-metrics">
            <ul className="work-progress-stats">
              <li className="is-done">
                <strong>{done}</strong>
                <span>រួចហើយ</span>
              </li>
              <li className="is-total">
                <strong>{total}</strong>
                <span>សរុប</span>
              </li>
              <li className="is-pct">
                <strong>{pct}%</strong>
                <span>បានបញ្ចប់</span>
              </li>
            </ul>
            <div
              className="work-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={`បានបញ្ចប់ ${pct}%`}
            >
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function TodayWorkProgress({
  variant = "card",
  title = "ការងារថ្ងៃនេះ",
}: {
  variant?: "card" | "header";
  title?: string;
}) {
  const events = useTrackingStore((s) => s.events);
  const reminders = useTrackingStore((s) => s.reminders);
  const progress = useMemo(
    () => workProgressForDate(events, reminders, todayISO()),
    [events, reminders]
  );

  return (
    <WorkProgressChart
      variant={variant}
      title={title}
      done={progress.done}
      remaining={progress.remaining}
    />
  );
}
