"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Option<T extends string> = { value: T; label: string };

export function EventSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  variant = "inline",
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly Option<T>[] | Option<T>[];
  ariaLabel?: string;
  variant?: "inline" | "block";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    width: 220,
    maxHeight: 256,
  });
  const selected = options.find((option) => option.value === value);

  function place() {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(
      Math.max(rect.width, 12.5 * 16),
      window.innerWidth - 16
    );
    const left = Math.max(
      8,
      Math.min(rect.right - width, window.innerWidth - width - 8)
    );
    const estimated = Math.min(16 * 16, options.length * 42 + 16);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < estimated && spaceAbove > spaceBelow;
    const maxHeight = Math.max(8.5 * 16, Math.min(estimated, openUp ? spaceAbove : spaceBelow));
    setPos({
      top: openUp ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6,
      left,
      width,
      maxHeight,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (event.type === "scroll") setOpen(false);
      else place();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`event-select${variant === "block" ? " is-block" : ""}`}
    >
      <button
        type="button"
        className="event-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="event-select-value">{selected?.label ?? ""}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          aria-hidden
          className="event-select-caret"
          data-open={open}
        />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="event-select-menu"
              role="listbox"
              aria-label={ariaLabel}
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
              }}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className="event-select-option"
                  data-active={option.value === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === value ? <Check size={15} aria-hidden /> : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
