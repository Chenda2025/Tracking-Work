import { format } from "date-fns";
import type { CalendarEvent } from "./types";

const DONE_TITLES = [
  "ពិនិត្យអ៊ីមែល",
  "ប្រជុំព្រឹក",
  "សរសេររបាយការណ៍",
  "ហៅទូរស័ព្ទអតិថិជន",
  "ធ្វើបច្ចុប្បន្នភាពគម្រោង",
  "ពិនិត្យកិច្ចការ",
  "រៀបចំឯកសារ",
  "ឆ្លើយសារ Telegram",
  "សង្ខេបកិច្ចប្រជុំ",
  "បញ្ចូលទិន្នន័យ",
];

const OPEN_TITLES = [
  "សរសេរផែនការថ្ងៃស្អែក",
  "ពិនិត្យថវិកា",
  "រៀបចំបទបង្ហាញ",
  "ជួបក្រុមគ្រួសារ",
  "ហាត់ប្រាណ",
  "អានឯកសារ",
  "ឆ្លើយអ៊ីមែលល្ងាច",
  "ធ្វើបច្ចុប្បន្នភាពគោលដៅ",
  "រៀបចំប្រតិទិន",
  "ពិនិត្យការងារនៅសល់",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function slot(hour: number, minute: number): { startTime: string; endTime: string } {
  const endHour = minute === 30 ? hour + 1 : hour;
  const endMinute = minute === 30 ? 0 : 30;
  return {
    startTime: `${pad2(hour)}:${pad2(minute)}`,
    endTime: `${pad2(endHour)}:${pad2(endMinute)}`,
  };
}

function makeEvent(
  id: string,
  title: string,
  date: string,
  time: { startTime: string; endTime: string },
  completed: boolean,
  createdAt: string
): CalendarEvent {
  return {
    id,
    title,
    location: "",
    notes: "ទិន្នន័យសាកល្បងសម្រាប់តារាងការងារ",
    date,
    endDate: date,
    startTime: time.startTime,
    endTime: time.endTime,
    allDay: false,
    folderId: null,
    repeat: [],
    travelTime: "none",
    repeatFrequency: "never",
    endRepeat: { type: "never" },
    alert: "none",
    completed,
    completedAt: completed ? createdAt : undefined,
    createdAt,
  };
}

/** 20 demo events for today: 10 done, 10 remaining. */
export function buildDemoWorkEvents(now = new Date()): CalendarEvent[] {
  const date = format(now, "yyyy-MM-dd");
  const createdAt = now.toISOString();
  const items: CalendarEvent[] = [];

  DONE_TITLES.forEach((title, i) => {
    const hour = 8 + Math.floor(i / 2);
    const minute = i % 2 === 0 ? 0 : 30;
    items.push(
      makeEvent(
        `demo-work-done-${pad2(i + 1)}`,
        title,
        date,
        slot(hour, minute),
        true,
        createdAt
      )
    );
  });

  OPEN_TITLES.forEach((title, i) => {
    const hour = 13 + Math.floor(i / 2);
    const minute = i % 2 === 0 ? 0 : 30;
    items.push(
      makeEvent(
        `demo-work-open-${pad2(i + 1)}`,
        title,
        date,
        slot(hour, minute),
        false,
        createdAt
      )
    );
  });

  return items;
}

export function mergeDemoWorkEvents(events: CalendarEvent[]): CalendarEvent[] {
  if (events.some((item) => String(item.id).startsWith("demo-work-"))) {
    return events;
  }
  return [...buildDemoWorkEvents(), ...events];
}
