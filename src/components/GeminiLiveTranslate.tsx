"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Mic, MonitorUp, Square } from "lucide-react";
import {
  mergeTranscript,
  startGeminiLiveSession,
  type GeminiLiveSession,
  type LiveTargetLang,
} from "@/lib/gemini-live-client";

type InputMode = "mic" | "tab";

type Props = {
  targetLang: LiveTargetLang;
  targetLabel: string;
};

export function GeminiLiveTranslate({ targetLang, targetLabel }: Props) {
  const [status, setStatus] = useState<"idle" | "connecting" | "live">("idle");
  const [inputMode, setInputMode] = useState<InputMode>("mic");
  const [cameraOn, setCameraOn] = useState(false);
  const [heard, setHeard] = useState("");
  const [spoken, setSpoken] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<GeminiLiveSession | null>(null);

  const live = status === "live";
  const busy = status === "connecting";

  useEffect(() => {
    return () => stopLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup
  }, []);

  function attachPreview(stream: MediaStream) {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream.getVideoTracks().length ? stream : null;
    if (video.srcObject) void video.play().catch(() => undefined);
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function stopLive() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    stopTracks();
    setStatus("idle");
  }

  async function startCapture() {
    if (inputMode === "tab") {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (!display.getAudioTracks().length) {
        display.getTracks().forEach((track) => track.stop());
        throw new Error("no_tab_audio");
      }
      return display;
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
      video: cameraOn,
    });
  }

  async function startLive() {
    setError("");
    setHeard("");
    setSpoken("");
    setStatus("connecting");
    try {
      const stream = await startCapture();
      streamRef.current = stream;
      attachPreview(stream);

      const res = await fetch("/api/translate/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang }),
      });
      const data = (await res.json()) as {
        token?: string;
        model?: string;
        error?: string;
      };
      if (!res.ok || !data.token || !data.model) {
        throw new Error(data.error || "live_token_failed");
      }

      const session = await startGeminiLiveSession({
        token: data.token,
        model: data.model,
        targetLang,
        stream,
        callbacks: {
          onReady: () => setStatus("live"),
          onInputText: (text) =>
            setHeard((prev) => mergeTranscript(prev, text)),
          onOutputText: (text) =>
            setSpoken((prev) => mergeTranscript(prev, text)),
          onError: (message) => {
            setError(liveErrorMessage(message));
            stopLive();
          },
          onClose: () => {
            sessionRef.current = null;
            stopTracks();
            setStatus((current) => (current === "idle" ? current : "idle"));
          },
        },
      });
      sessionRef.current = session;
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          if (sessionRef.current === session) stopLive();
        });
      });
    } catch (cause) {
      stopTracks();
      setStatus("idle");
      const name = cause instanceof DOMException ? cause.name : "";
      const code = cause instanceof Error ? cause.message : "";
      if (name === "NotAllowedError" || name === "NotFoundError") {
        setError("Please allow microphone / camera access.");
      } else {
        setError(liveErrorMessage(code));
      }
    }
  }

  return (
    <div className="youtube-live">
      <div className="youtube-live-pipeline" aria-hidden>
        <span>Mic / Camera</span>
        <em>{"->"}</em>
        <span>App</span>
        <em>WSS</em>
        <span>Gemini Live</span>
        <em>{"<-"}</em>
        <span>24kHz / Text</span>
      </div>

      <div className="youtube-live-toolbar">
        <div
          className="youtube-live-modes"
          role="tablist"
          aria-label="Audio source"
        >
          <button
            type="button"
            className="youtube-lang-tab"
            role="tab"
            aria-selected={inputMode === "mic"}
            data-active={inputMode === "mic"}
            disabled={busy || live}
            onClick={() => setInputMode("mic")}
          >
            <Mic size={14} />
            Mic
          </button>
          <button
            type="button"
            className="youtube-lang-tab"
            role="tab"
            aria-selected={inputMode === "tab"}
            data-active={inputMode === "tab"}
            disabled={busy || live}
            onClick={() => {
              setInputMode("tab");
              setCameraOn(false);
            }}
          >
            <MonitorUp size={14} />
            Tab audio
          </button>
        </div>

        <label className="youtube-live-camera">
          <input
            type="checkbox"
            checked={cameraOn}
            disabled={busy || live || inputMode === "tab"}
            onChange={(e) => setCameraOn(e.target.checked)}
          />
          <Camera size={14} />
          Camera
        </label>
      </div>

      <div className="youtube-live-stage">
        <video
          ref={videoRef}
          className="youtube-live-preview"
          muted
          playsInline
          autoPlay
          data-active={Boolean(cameraOn || inputMode === "tab")}
        />
        <div className="youtube-live-actions">
          {live || busy ? (
            <button
              type="button"
              className="btn btn-primary youtube-live-toggle is-stop"
              onClick={stopLive}
            >
              <Square size={15} />
              {busy ? "Connecting..." : "Stop Live"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary youtube-live-toggle"
              onClick={() => void startLive()}
            >
              <Mic size={15} />
              Start Live {"->"} {targetLabel}
            </button>
          )}
          <p className="youtube-live-hint">
            {inputMode === "tab"
              ? "Share the YouTube tab and include tab audio."
              : "Play the video, then speak or let the mic listen."}
          </p>
        </div>
      </div>

      <div className="youtube-live-captions">
        <div className="youtube-field">
          <span>Heard</span>
          <div className="youtube-result-box" aria-live="polite">
            {heard ? (
              <p>{heard}</p>
            ) : (
              <p className="is-placeholder">Source speech appears here</p>
            )}
          </div>
        </div>
        <div className="youtube-field is-result">
          <span>Translated ({targetLabel})</span>
          <div className="youtube-result-box" aria-live="polite">
            {spoken ? (
              <p>{spoken}</p>
            ) : (
              <p className="is-placeholder">
                24kHz audio and text appear here
              </p>
            )}
          </div>
        </div>
      </div>

      {error ? <p className="youtube-error">{error}</p> : null}
    </div>
  );
}

function liveErrorMessage(code: string) {
  if (code === "missing_gemini_key") {
    return "GEMINI_API_KEY is missing in .env.local";
  }
  if (code === "unauthorized") return "Please sign in first.";
  if (code === "no_tab_audio") return "Share the tab with audio enabled.";
  if (code === "live_socket_failed" || code === "live_socket_closed") {
    return "Could not open Gemini Live.";
  }
  if (code === "setup_timeout") return "Gemini Live setup timed out.";
  if (/prepayment credits are depleted/i.test(code)) {
    return "Gemini Live credits are empty. Add billing in AI Studio.";
  }
  if (code && !code.includes(" ")) return `Gemini Live: ${code}`;
  return code || "Could not start Gemini Live.";
}
