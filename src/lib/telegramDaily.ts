import { format } from "date-fns";
import { km } from "date-fns/locale";
import type { Activity, CalendarEvent, Reminder, TelegramSettings } from "./types";
import {
  eventsForDate,
  formatClock,
  isActivityForToday,
  isAtOrAfterTime,
  labelActivityCategory,
  labelActivityStatus,
  remindersForDate,
} from "./utils";

function eventWhen(item: CalendarEvent): string {
  if (item.allDay) return "ពេញថ្ងៃ";
  const start = item.startTime ? formatClock(item.startTime) : "";
  const end = item.endTime ? formatClock(item.endTime) : "";
  if (start && end) return start + " – " + end;
  return start || "—";
}

export function buildMorningDigest(input: {
  events: CalendarEvent[];
  reminders: Reminder[];
  activities: Activity[];
  now?: Date;
  period?: "morning" | "evening";
}): string {
  const now = input.now ?? new Date();
  const period = input.period ?? "morning";
  const iso = format(now, "yyyy-MM-dd");
  const heading = format(now, "EEEE d MMMM yyyy", { locale: km });
  const events = eventsForDate(input.events, iso);
  const reminders = remindersForDate(input.reminders, iso).filter((item) =>
    period === "evening" ? true : !item.completed
  );
  const activities = input.activities.filter((item) =>
    isActivityForToday(item, now)
  );
  const periodLabel = period === "evening" ? "ល្ងាច" : "ព្រឹក";


  const blocks: string[] = [
    "ថេរ — សកម្មភាពថ្ងៃនេះ · " + periodLabel,
    heading,
    "",
  ];

  if (events.length) {
    blocks.push("ព្រឹត្តិការណ៍");
    events.forEach((item, index) => {
      const extra = [item.location, item.completed ? "រួចរាល់" : ""]
        .filter(Boolean)
        .join(" · ");
      blocks.push(
        `${index + 1}. ${item.title} · ${eventWhen(item)}${extra ? " · " + extra : ""}`
      );
    });
    blocks.push("");
  }

  if (reminders.length) {
    blocks.push("ការរំលឹក");
    reminders.forEach((item, index) => {
      const when = item.dueTime ? formatClock(item.dueTime) : "—";
      blocks.push(`${index + 1}. ${item.title} · ${when}`);
    });
    blocks.push("");
  }

  if (activities.length) {
    blocks.push("សកម្មភាព");
    activities.forEach((item, index) => {
      const extra = [
        item.startTime ? formatClock(item.startTime) : "",
        labelActivityCategory(item.category),
        labelActivityStatus(item.status),
      ]
        .filter(Boolean)
        .join(" · ");
      blocks.push(`${index + 1}. ${item.title}${extra ? " · " + extra : ""}`);
    });
    blocks.push("");
  }

  if (!events.length && !reminders.length && !activities.length) {
    blocks.push("មិនមានសកម្មភាពថ្ងៃនេះ");
  }

  return blocks.join("\n").trim().slice(0, 4000);
}

export function buildEventReport(item: CalendarEvent): string {
  const lines = ["ថេរ — ព្រឹត្តិការណ៍", item.title, eventWhen(item)];
  if (item.location) lines.push(item.location);
  const notes = item.notes?.trim();
  if (notes) lines.push(notes);
  return lines.join("\n").slice(0, 4000);
}

export function sentEventIdsForToday(
  settings: TelegramSettings,
  now = new Date()
): string[] {
  const today = format(now, "yyyy-MM-dd");
  if ((settings.autoSentEventDate ?? "") !== today) return [];
  return settings.autoSentEventIds ?? [];
}

export function dueTodayEvents(
  events: CalendarEvent[],
  sentIds: string[],
  now = new Date()
): CalendarEvent[] {
  const sent = new Set(sentIds);
  const iso = format(now, "yyyy-MM-dd");
  return eventsForDate(events, iso).filter((item) => {
    if (item.completed || item.allDay || !item.startTime) return false;
    if (sent.has(item.id)) return false;
    return isAtOrAfterTime(item.startTime, now);
  });
}

export function msUntilNextEventReport(
  events: CalendarEvent[],
  sentIds: string[],
  now = new Date()
): number {
  const sent = new Set(sentIds);
  const iso = format(now, "yyyy-MM-dd");
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let wait = Number.POSITIVE_INFINITY;
  for (const item of eventsForDate(events, iso)) {
    if (item.completed || item.allDay || !item.startTime) continue;
    if (sent.has(item.id)) continue;
    const [hour, minute] = item.startTime.split(":").map(Number);
    const startMinutes = (hour || 0) * 60 + (minute || 0);
    if (startMinutes > nowMinutes) {
      wait = Math.min(wait, (startMinutes - nowMinutes) * 60_000);
    }
  }
  return Number.isFinite(wait) ? wait : 0;
}

export function canAutoSendSlot(
  settings: TelegramSettings,
  slot: "morning" | "evening",
  now = new Date()
): boolean {
  if (!settings.enabled) return false;
  if (!settings.botToken.trim() || !settings.chatId.trim()) return false;
  const today = format(now, "yyyy-MM-dd");
  if (slot === "morning") {
    if ((settings.lastAutoSentDate ?? "") === today) return false;
    return isAtOrAfterTime(settings.sendTime, now);
  }
  if ((settings.lastEveningSentDate ?? "") === today) return false;
  return isAtOrAfterTime(settings.eveningTime || "18:00", now);
}

export async function sendTelegramMessage(opts: {
  botToken: string;
  chatId: string;
  text: string;
}): Promise<void> {
  const token = opts.botToken.trim();
  const chatId = opts.chatId.trim();
  if (!token || !chatId) throw new Error("missing telegram config");

  const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: opts.text.slice(0, 4096),
      disable_web_page_preview: true,
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "telegram send failed");
  }
}
