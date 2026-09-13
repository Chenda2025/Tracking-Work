"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  open,
  title,
  onClose,
  children,
  size = "md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [backdropReady, setBackdropReady] = useState(false);
  const [risen, setRisen] = useState(false);

  useEffect(() => {
    if (!open) {
      setBackdropReady(false);
      setRisen(false);
      return;
    }
    setBackdropReady(false);
    const arm = window.setTimeout(() => setBackdropReady(true), 700);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(arm);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const syncKeyboard = () => {
      const viewport = window.visualViewport;
      if (!overlay || !viewport) return;
      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      overlay.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!panel?.contains(target)) return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }, 80);
    };
    syncKeyboard();
    window.visualViewport?.addEventListener("resize", syncKeyboard);
    window.visualViewport?.addEventListener("scroll", syncKeyboard);
    panel?.addEventListener("focusin", onFocusIn);
    return () => {
      overlay?.style.removeProperty("--keyboard-inset");
      window.visualViewport?.removeEventListener("resize", syncKeyboard);
      window.visualViewport?.removeEventListener("scroll", syncKeyboard);
      panel?.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const width = size === "sm" ? "max-w-sm" : "max-w-lg";

  return createPortal(
    <div className="modal-overlay" ref={overlayRef}>
      <div
        className="modal-backdrop"
        aria-hidden
        style={{ pointerEvents: backdropReady ? "auto" : "none" }}
        onPointerDown={(e) => {
          if (!backdropReady) return;
          if (e.target !== e.currentTarget) return;
          onCloseRef.current();
        }}
      />
      <div
        ref={panelRef}
        className={`surface-raised modal-panel relative z-10 w-full ${width}${risen ? "" : " animate-rise"}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setRisen(true);
        }}
      >
        <div className="modal-head">
          <h2 className="font-display text-lg text-ink sm:text-xl">{title}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="បិទ"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
