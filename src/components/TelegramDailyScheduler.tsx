"use client";

import { useEffect } from "react";
import { useTrackingStore } from "@/lib/store";
import {
  buildEventReport,
  buildMorningDigest,
  canAutoSendSlot,
  dueTodayEvents,
  msUntilNextEventReport,
  sendTelegramMessage,
  sentEventIdsForToday,
} from "@/lib/telegramDaily";
import { normalizeSendTime, todayISO } from "@/lib/utils";

let inFlight: Promise<void> | null = null;

function msUntilSendTime(sendTime: string, fallback = "07:00"): number {
  const [hour, minute] = normalizeSendTime(sendTime, fallback)
    .split(":")
    .map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  return Math.max(0, target.getTime() - now.getTime());
}

async function sendDigestIfDue(slot: "morning" | "evening") {
  const state = useTrackingStore.getState();
  if (!canAutoSendSlot(state.telegramSettings, slot)) return;
  const { botToken, chatId } = state.telegramSettings;
  const sentDate = todayISO();
  await sendTelegramMessage({
    botToken,
    chatId,
    text: buildMorningDigest({
      events: state.events,
      reminders: state.reminders,
      activities: state.activities,
      period: slot,
      ownerName: state.profile?.name,
    }),
  });
  useTrackingStore.getState().setTelegramSettings(
    slot === "morning"
      ? { lastAutoSentDate: sentDate }
      : { lastEveningSentDate: sentDate }
  );
}

async function sendDueEventReports() {
  const state = useTrackingStore.getState();
  const settings = state.telegramSettings;
  if (!settings.enabled) return;
  const token = settings.botToken.trim();
  const chatId = settings.chatId.trim();
  if (!token || !chatId) return;

  const today = todayISO();
  let sentIds = sentEventIdsForToday(settings);
  const due = dueTodayEvents(state.events, sentIds);
  for (const item of due) {
    await sendTelegramMessage({
      botToken: token,
      chatId,
      text: buildEventReport(item, state.profile?.name),
    });
    sentIds = [...sentIds, item.id];
    useTrackingStore.getState().setTelegramSettings({
      autoSentEventDate: today,
      autoSentEventIds: sentIds,
    });
  }
}

async function tick() {
  const state = useTrackingStore.getState();
  if (!state.hydrated) return;
  if (inFlight) return;
  inFlight = (async () => {
    try {
      await sendDigestIfDue("morning");
      await sendDigestIfDue("evening");
      await sendDueEventReports();
    } catch {
      // retry on the next timer
    }
  })().finally(() => {
    inFlight = null;
  });
  await inFlight;
}

export function TelegramDailyScheduler() {
  const hydrated = useTrackingStore((s) => s.hydrated);
  const enabled = useTrackingStore((s) => s.telegramSettings.enabled);
  const botToken = useTrackingStore((s) => s.telegramSettings.botToken);
  const chatId = useTrackingStore((s) => s.telegramSettings.chatId);
  const sendTime = useTrackingStore((s) => s.telegramSettings.sendTime);
  const eveningTime = useTrackingStore((s) => s.telegramSettings.eveningTime);
  const lastAutoSentDate = useTrackingStore(
    (s) => s.telegramSettings.lastAutoSentDate
  );
  const lastEveningSentDate = useTrackingStore(
    (s) => s.telegramSettings.lastEveningSentDate
  );
  const autoSentEventDate = useTrackingStore(
    (s) => s.telegramSettings.autoSentEventDate
  );
  const autoSentEventIds = useTrackingStore(
    (s) => s.telegramSettings.autoSentEventIds
  );
  const eventStamp = useTrackingStore((s) =>
    s.events
      .map(
        (item) =>
          `${item.id}:${item.date}:${item.endDate}:${item.startTime}:${item.allDay}:${item.completed}:${item.repeatFrequency}`
      )
      .join("|")
  );

  useEffect(() => {
    if (!hydrated || !enabled || !botToken.trim() || !chatId.trim()) return;

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
      sentEventIdsForToday(state.telegramSettings)
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
    enabled,
    botToken,
    chatId,
    sendTime,
    eveningTime,
    lastAutoSentDate,
    lastEveningSentDate,
    autoSentEventDate,
    autoSentEventIds,
    eventStamp,
  ]);

  return null;
}
