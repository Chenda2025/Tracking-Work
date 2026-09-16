"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { TelegramConfigModal } from "@/components/TelegramConfigModal";
import { useTrackingStore } from "@/lib/store";

export function SendTodayTelegramButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const settings = useTrackingStore((s) => s.telegramSettings);
  const [configOpen, setConfigOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function send() {
    if (busy) return;
    const token = settings.botToken.trim();
    const chatId = settings.chatId.trim();
    if (!token || !chatId) {
      setConfigOpen(true);
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/telegram/send-today", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        count?: number;
      } | null;
      if (!res.ok) {
        if (data?.error === "telegram_not_configured") {
          setConfigOpen(true);
          return;
        }
        setStatus("ផ្ញើមិនបាន");
        return;
      }
      setStatus(data?.count ? `ផ្ញើ ${data.count} ការងារ` : "ផ្ញើបាន");
    } catch {
      setStatus("ផ្ញើមិនបាន");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(null), 2500);
    }
  }

  return (
    <>
      <button
        type="button"
        className="toolbar-send"
        aria-label="ផ្ញើការងារថ្ងៃនេះទៅ Telegram"
        title={status || "ផ្ញើថ្ងៃនេះទៅ Telegram"}
        disabled={busy}
        onClick={() => void send()}
      >
        <Send size={15} />
        {compact ? null : "ផ្ញើ"}
      </button>
      <TelegramConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
      />
    </>
  );
}
