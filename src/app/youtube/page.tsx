"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ExternalLink, Play, Languages } from "lucide-react";
import { GeminiLiveTranslate } from "@/components/GeminiLiveTranslate";
import { HydrationGate } from "@/components/HydrationGate";

const STORAGE_KEY = "theara-youtube-translate";

const TARGET_LANGS = [
  { value: "km", label: "ខ្មែរ" },
  { value: "en", label: "English" },
] as const;

type TargetLang = (typeof TARGET_LANGS)[number]["value"];

function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const fromQuery = url.searchParams.get("v");
      if (fromQuery && /^[\w-]{11}$/.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      const marked = parts.findIndex(
        (part) => part === "embed" || part === "shorts" || part === "live"
      );
      if (
        marked >= 0 &&
        parts[marked + 1] &&
        /^[\w-]{11}$/.test(parts[marked + 1])
      ) {
        return parts[marked + 1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

export default function YoutubePage() {
  return (
    <HydrationGate>
      <YoutubeTranslate />
    </HydrationGate>
  );
}

function YoutubeTranslate() {
  const [url, setUrl] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [translation, setTranslation] = useState("");
  const [targetLang, setTargetLang] = useState<TargetLang>("km");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        url?: string;
        sourceText?: string;
        targetLang?: string;
      };
      if (typeof saved.url === "string") {
        setUrl(saved.url);
        setActiveUrl(saved.url);
      }
      if (typeof saved.sourceText === "string") setSourceText(saved.sourceText);
      if (
        typeof saved.targetLang === "string" &&
        TARGET_LANGS.some((item) => item.value === saved.targetLang)
      ) {
        setTargetLang(saved.targetLang as TargetLang);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const videoId = useMemo(() => parseYouTubeId(activeUrl), [activeUrl]);
  const watchUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : "";
  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?rel=0`
    : "";
  const targetLabel =
    TARGET_LANGS.find((item) => item.value === targetLang)?.label ?? "ខ្មែរ";

  function persist(
    nextUrl: string,
    nextSource: string,
    nextLang: TargetLang = targetLang
  ) {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        url: nextUrl,
        sourceText: nextSource,
        targetLang: nextLang,
      })
    );
  }

  function openVideo(e: FormEvent) {
    e.preventDefault();
    const id = parseYouTubeId(url);
    if (!id) return;
    setActiveUrl(url.trim());
    persist(url.trim(), sourceText);
  }

  async function translateText(e: FormEvent) {
    e.preventDefault();
    const text = sourceText.trim();
    if (!text) {
      setError("បញ្ចូលអត្ថបទដើម្បីបកប្រែ");
      return;
    }
    setBusy(true);
    setError("");
    setTranslation("");
    persist(activeUrl || url, text, targetLang);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
      });
      const data = (await res.json()) as {
        translation?: string;
        error?: string;
      };
      if (!res.ok) {
        if (data.error === "missing_gemini_key") {
          setError("មិនទាន់មាន GEMINI_API_KEY ក្នុង .env.local");
        } else if (data.error === "unauthorized") {
          setError("សូមចូលគណនីមុន");
        } else {
          setError("មិនអាចបកប្រែបាន — ពិនិត្យ API key");
        }
        return;
      }
      setTranslation(data.translation ?? "");
    } catch {
      setError("មិនអាចភ្ជាប់ Gemini បាន");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page youtube-page">
      <section className="surface youtube-panel">
        <header className="youtube-panel-head">
          <div className="youtube-panel-brand">
            <span className="youtube-panel-mark" aria-hidden>
              <Play size={18} />
            </span>
            <div>
              <p className="youtube-panel-kicker">YouTube</p>
              <h2 className="youtube-panel-title">មើលវីដេអូ</h2>
            </div>
          </div>
          {videoId ? (
            <a
              className="youtube-panel-link"
              href={watchUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
              បើកក្នុង YouTube
            </a>
          ) : null}
        </header>

        <form className="youtube-url-row" onSubmit={openVideo}>
          <input
            className="youtube-url-input"
            type="url"
            inputMode="url"
            aria-label="តំណ YouTube"
            placeholder="បិទភ្ជាប់តំណ YouTube…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary youtube-url-submit"
            disabled={!parseYouTubeId(url)}
          >
            បើក
          </button>
        </form>

        {videoId ? (
          <div className="youtube-player">
            <iframe
              key={videoId}
              title="YouTube"
              src={embedSrc}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="youtube-player-empty">
            <Play size={28} />
            <p>បិទភ្ជាប់តំណវីដេអូ រួចចុច បើក</p>
          </div>
        )}
      </section>

      <section className="surface youtube-panel">
        <header className="youtube-panel-head">
          <div className="youtube-panel-brand">
            <span className="youtube-panel-mark is-gemini" aria-hidden>
              <Languages size={18} />
            </span>
            <div>
              <p className="youtube-panel-kicker">Gemini</p>
              <h2 className="youtube-panel-title">បកប្រែភាសា</h2>
            </div>
          </div>
        </header>

        <div className="youtube-lang-block">
          <p className="youtube-lang-label">ភាសាគោលដៅ</p>
          <div
            className="youtube-lang-tabs"
            role="tablist"
            aria-label="ភាសាគោលដៅ"
          >
            {TARGET_LANGS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                className="youtube-lang-tab"
                aria-selected={targetLang === item.value}
                data-active={targetLang === item.value}
                onClick={() => {
                  setTargetLang(item.value);
                  persist(activeUrl || url, sourceText, item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <GeminiLiveTranslate
          targetLang={targetLang}
          targetLabel={targetLabel}
        />

        <p className="youtube-or">ឬបិទភ្ជាប់អត្ថបទ</p>

        <form className="youtube-translate-grid" onSubmit={translateText}>
          <label className="youtube-field">
            <span>អត្ថបទដើម</span>
            <textarea
              rows={6}
              placeholder="Paste text / captions here…"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
            />
          </label>

          <div className="youtube-translate-mid">
            <button
              type="submit"
              className="btn btn-primary youtube-translate-btn"
              disabled={busy || !sourceText.trim()}
            >
              <ArrowRightLeft size={16} />
              {busy ? "កំពុងបកប្រែ…" : `បកប្រែ → ${targetLabel}`}
            </button>
          </div>

          <div className="youtube-field is-result">
            <span>លទ្ធផល ({targetLabel})</span>
            <div className="youtube-result-box" aria-live="polite">
              {translation ? (
                <p>{translation}</p>
              ) : (
                <p className="is-placeholder">
                  លទ្ធផលបកប្រែនឹងបង្ហាញទីនេះ
                </p>
              )}
            </div>
          </div>
        </form>

        {error ? <p className="youtube-error">{error}</p> : null}
      </section>
    </div>
  );
}
