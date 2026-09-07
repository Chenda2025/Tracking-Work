"use client";

import { FormEvent, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useTrackingStore } from "@/lib/store";
import { buildMorningDigest, sendTelegramMessage } from "@/lib/telegramDaily";
import {
  joinClock,
  normalizeSendTime,
  splitClock,
  type ClockPeriod,
} from "@/lib/utils";

function SendTimeField({
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
  const minuteValue = minutes.reduce((best, item) =>
    Math.abs(item - clock.minute) < Math.abs(best - clock.minute) ? item : best
  );

  function setPart(next: {
    hour12?: number;
    minute?: number;
    period?: ClockPeriod;
  }) {
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
          aria-label={label}
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
          value={minuteValue}
          onChange={(e) => setPart({ minute: Number(e.target.value) })}
          aria-label={label}
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

export function TelegramConfigModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const settings = useTrackingStore((s) => s.telegramSettings);
  const setTelegramSettings = useTrackingStore((s) => s.setTelegramSettings);

  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [sendTime, setSendTime] = useState("07:00");
  const [eveningTime, setEveningTime] = useState("18:00");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setBotToken(settings.botToken);
    setChatId(settings.chatId);
    setEnabled(settings.enabled);
    setSendTime(normalizeSendTime(settings.sendTime));
    setEveningTime(normalizeSendTime(settings.eveningTime, "18:00"));
    setMessage(null);
    setBusy(false);
  }, [
    open,
    settings.botToken,
    settings.chatId,
    settings.enabled,
    settings.sendTime,
    settings.eveningTime,
  ]);

  function save(e: FormEvent) {
    e.preventDefault();
    setTelegramSettings({
      botToken,
      chatId,
      enabled,
      sendTime,
      eveningTime,
    });
    setMessage({ tone: "ok", text: "រក្សាទុកបាន" });
  }

  async function testSend() {
    if (busy) return;
    const token = botToken.trim();
    const chat = chatId.trim();
    if (!token || !chat) {
      setMessage({ tone: "err", text: "បញ្ចូល Bot Token និង Chat ID" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      setTelegramSettings({
        botToken: token,
        chatId: chat,
        enabled,
        sendTime,
        eveningTime,
      });
      const state = useTrackingStore.getState();
      await sendTelegramMessage({
        botToken: token,
        chatId: chat,
        text: buildMorningDigest({
          events: state.events,
          reminders: state.reminders,
          activities: state.activities,
          ownerName: state.profile?.name,
        }),
      });
      setMessage({ tone: "ok", text: "ផ្ញើសាកល្បងបាន" });
    } catch {
      setMessage({ tone: "err", text: "ផ្ញើមិនបាន — Token / Chat ID" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="ការកំណត់ Telegram" onClose={onClose} size="sm">
      <form className="telegram-config" onSubmit={save}>
        <section className="event-card">
          <label className="event-row event-row-switch">
            <span className="event-row-label">បើកការផ្ញើ</span>
            <input
              type="checkbox"
              className="event-toggle"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </label>
          <SendTimeField label="ព្រឹក" value={sendTime} onChange={setSendTime} />
          <SendTimeField
            label="ល្ងាច"
            value={eveningTime}
            onChange={setEveningTime}
          />
          <label className="event-row">
            <span className="event-row-label">Token</span>
            <input
              className="event-row-input telegram-config-field"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456:ABC..."
            />
          </label>
          <label className="event-row">
            <span className="event-row-label">Chat ID</span>
            <input
              className="event-row-input telegram-config-field"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-100... / 123..."
            />
          </label>
        </section>

        {message ? (
          <p
            className={`telegram-config-msg ${message.tone === "ok" ? "is-ok" : "is-err"}`}
          >
            {message.text}
          </p>
        ) : null}

        <div className="telegram-config-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={testSend}
          >
            <Send size={15} /> សាកល្បង
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            រក្សាទុក
          </button>
        </div>
      </form>
    </Modal>
  );
}
