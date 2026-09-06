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
  const [backdropReady, setBackdropReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setBackdropReady(false);
      return;
    }
    setBackdropReady(false);
    const arm = window.setTimeout(() => setBackdropReady(true), 700);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(arm);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const width = size === "sm" ? "max-w-sm" : "max-w-lg";

  return createPortal(
    <div className="modal-overlay">
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
        className={`surface-raised modal-panel relative z-10 w-full ${width} animate-rise`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
