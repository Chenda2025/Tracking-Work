"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const width = size === "sm" ? "max-w-sm" : "max-w-lg";

  return createPortal(
    <div className="modal-overlay">
      <button
        type="button"
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        aria-label="បិទប្រអប់"
        onClick={onClose}
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
