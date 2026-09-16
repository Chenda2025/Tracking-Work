"use client";

import { useEffect } from "react";
import { apiLoadWorkspace } from "@/lib/api-client";
import { useTrackingStore } from "@/lib/store";
import { msUntilNextEventReport, sentEventIdsForToday } from "@/lib/telegramDaily";
import { normalizeSendTime, todayISO } from "@/lib/utils";
import type { Activity, CalendarEvent, Reminder } from "@/lib/types";

function msUntilSendTime(sendTime: string, fallback = "07:00"): number {
  const [hour, minute] = normalizeSendTime(sendTime, fallback)
    .split(":")
    .map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  return Math.max(0, target.getTime() - now.getTime());
}

async function tick() {
  const state = useTrackingStore.getState();
  if (!state.hydrated || !state.signedIn) return;
  try {
    await fetch("/api/telegram/inbox", { method: "POST" });
    await fetch("/api/telegram/dispatch", { method: "POST" });
    const remote = await apiLoadWorkspace();
    if (remote) {
      useTrackingStore.getState().applyRemoteCompletions({
        events: remote.events as CalendarEvent[] | undefined,
        reminders: remote.reminders as Reminder[] | undefined,
        activities: remote.activities as Activity[] | undefined,
      });
    }
  } catch {
    // retry on the next timer
  }
}

async function listenForTelegramTaps() {
  const state = useTrackingStore.getState();
  if (!state.hydrated || !state.signedIn) return;
  if (!state.telegramSettings.botToken.trim() || !state.telegramSettings.chatId.trim()) {
    return;
  }
  try {
    await fetch("/api/telegram/inbox", { method: "POST" });
    const remote = await apiLoadWorkspace();
    if (remote) {
      useTrackingStore.getState().applyRemoteCompletions({
        events: remote.events as CalendarEvent[] | undefined,
        reminders: remote.reminders as Reminder[] | undefined,
        activities: remote.activities as Activity[] | undefined,
      });
    }
  } catch {
    // retry on the next timer
  }
}

export function TelegramDailyScheduler() {
  const hydrated = useTrackingStore((s) => s.hydrated);
  const signedIn = useTrackingStore((s) => s.signedIn);
  const enabled = useTrackingStore((s) => s.telegramSettings.enabled);
  const botToken = useTrackingStore((s) => s.telegramSettings.botToken);
  const chatId = useTrackingStore((s) => s.telegramSettings.chatId);
  const sendTime = useTrackingStore((s) => s.telegramSettings.sendTime);
  const eveningTime = useTrackingStore((s) => s.telegramSettings.eveningTime);
  const eventStamp = useTrackingStore((s) =>
    [
      ...s.events.map(
        (item) =>
          `${item.id}:${item.date}:${item.endDate}:${item.startTime}:${item.allDay}:${item.completed}:${item.alert}:${item.repeatFrequency}`
      ),
      ...s.reminders.map(
        (item) =>
          `${item.id}:${item.dueDate}:${item.dueTime}:${item.completed}:${item.alert}`
      ),
    ].join("|")
  );

  useEffect(() => {
    if (!hydrated || !signedIn) return;
    void listenForTelegramTaps();
    const listen = window.setInterval(() => void listenForTelegramTaps(), 4_000);
    return () => window.clearInterval(listen);
  }, [hydrated, signedIn, botToken, chatId]);

  useEffect(() => {
    if (!hydrated || !signedIn || !enabled || !botToken.trim() || !chatId.trim()) {
      return;
    }

    void tick();

    const state = useTrackingStore.getState();
    const today = todayISO();
    const waits: number[] = [];
    if (state.telegramSettings.lastAutoSentDate !== today) {
      waits.push(msUntilSendTime(sendTime) + 400);
    }
    if (state.telegramSettings.lastEveningSentDate !== today) {
      waits.push(msUntilSendTime(eveningTime, "18:00") + 400);
    }
    const nextEventWait = msUntilNextEventReport(
      state.events,
      sentEventIdsForToday(state.telegramSettings),
      new Date(),
      state.reminders
    );
    if (nextEventWait > 0) waits.push(nextEventWait + 400);

    const timers = waits.map((ms) => window.setTimeout(() => void tick(), ms));
    const poll = window.setInterval(() => void tick(), 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    hydrated,
    signedIn,
    enabled,
    botToken,
    chatId,
    sendTime,
    eveningTime,
    eventStamp,
  ]);

  return null;
}
