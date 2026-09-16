"use client";

import { FormEvent, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { ClockPicks } from "@/components/ClockPicks";
import { Modal } from "@/components/Modal";
import { useTrackingStore } from "@/lib/store";
import { buildMorningDigest, sendTelegramMessage } from "@/lib/telegramDaily";
import { normalizeSendTime } from "@/lib/utils";

function SendTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="event-row event-row-clock">
      <span className="event-row-label">{label}</span>
      <ClockPicks
        value={value}
        onChange={onChange}
        hourLabel={`${label} ម៉ោង`}
        minuteLabel={`${label} នាទី`}
      />
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
          <p className="telegram-config-lead">
            ព្រឹក និងល្ងាចផ្ញើសង្ខេបប្រចាំថ្ងៃ។ ព្រឹត្តិការណ៍ និងការរំលឹកផ្ញើពេលដល់ម៉ោង
            ទោះមិនបើកកម្មវិធី។ បើដាក់ជូនដំណឹង ១០ ឬ ១៥ នាទីមុន នឹងផ្ញើមុនម៉ោងផង។
            ចុច ✅ ក្នុង Telegram ដើម្បីសម្គាល់រួចក្នុងប្រព័ន្ធ។
          </p>
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
