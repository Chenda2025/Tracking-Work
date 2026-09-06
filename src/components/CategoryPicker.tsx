"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useTrackingStore } from "@/lib/store";
import type { FinanceCatalogKind } from "@/lib/types";
import { resolveFinanceCategoryLabel } from "@/lib/utils";

export function CategoryPicker({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: FinanceCatalogKind;
  value: string;
  onChange: (id: string) => void;
}) {
  const incomeCategories = useTrackingStore((s) => s.incomeCategories);
  const expenseCategories = useTrackingStore((s) => s.expenseCategories);
  const saveCategories = useTrackingStore((s) => s.saveCategories);
  const addFinanceCategory = useTrackingStore((s) => s.addFinanceCategory);
  const updateFinanceCategory = useTrackingStore((s) => s.updateFinanceCategory);
  const deleteFinanceCategory = useTrackingStore((s) => s.deleteFinanceCategory);

  const items = useMemo(() => {
    const source =
      kind === "income"
        ? incomeCategories
        : kind === "save"
          ? saveCategories
          : expenseCategories;
    return source.filter((item) => item.id !== "savings");
  }, [kind, incomeCategories, expenseCategories, saveCategories]);

  const currentLabel =     resolveFinanceCategoryLabel(value, [
    ...incomeCategories,
    ...expenseCategories,
    ...saveCategories,
  ]);

  const [open, setOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    if (!open) {
      setDraftId(null);
      setDraftName("");
    }
  }, [open]);

  useEffect(() => {
    if (items.length && !items.some((item) => item.id === value)) {
      onChange(items[0].id);
    }
  }, [items, onChange, value]);

  function startAdd() {
    setDraftId("new");
    setDraftName("");
  }

  function startEdit(id: string, name: string) {
    setDraftId(id);
    setDraftName(name);
  }

  function saveDraft(e?: FormEvent) {
    e?.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    if (draftId === "new") {
      const id = addFinanceCategory(kind, name);
      if (id) onChange(id);
    } else if (draftId) {
      updateFinanceCategory(kind, draftId, name);
    }
    setDraftId(null);
    setDraftName("");
  }

  function removeItem(id: string) {
    const ok = deleteFinanceCategory(kind, id);
    if (ok && value === id) {
      const next = items.filter((item) => item.id !== id);
      if (next[0]) onChange(next[0].id);
    }
  }

  return (
    <>
      <button
        type="button"
        className="event-row finance-date-trigger"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <span className="event-row-label">{label}</span>
        <span className="event-row-input finance-date-value">{currentLabel}</span>
        <ChevronDown className="finance-date-icon" size={16} aria-hidden />
      </button>
      {open
        ? createPortal(
            <div className="modal-overlay category-picker-overlay">
              <button
                type="button"
                className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
                aria-label="បោះបង់"
                onClick={() => setOpen(false)}
              />
              <div
                className="surface-raised category-picker-panel relative z-10 animate-rise"
                role="dialog"
                aria-modal="true"
                aria-label={label}
              >
                <div className="category-picker-head">
                  <h2>{label}</h2>
                  <button
                    type="button"
                    className="category-picker-add"
                    onClick={startAdd}
                  >
                    <Plus size={15} /> បន្ថែម
                  </button>
                </div>

                {draftId ? (
                  <form className="category-picker-editor" onSubmit={saveDraft}>
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="ឈ្មោះ"
                      autoFocus
                    />
                    <div className="category-picker-editor-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setDraftId(null);
                          setDraftName("");
                        }}
                      >
                        បោះបង់
                      </button>
                      <button type="submit" className="btn btn-primary">
                        រក្សាទុក
                      </button>
                    </div>
                  </form>
                ) : null}

                <ul className="category-picker-list">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="category-picker-item"
                        data-active={item.id === value}
                        onClick={() => {
                          onChange(item.id);
                          setOpen(false);
                        }}
                      >
                        <span>{item.label}</span>
                        {item.id === value ? <Check size={15} /> : null}
                      </button>
                      <div className="category-picker-item-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          aria-label="កែប្រភេទលុយ"
                          onClick={() => startEdit(item.id, item.label)}
                        >
                          <Pencil size={14} />
                        </button>
                        {item.id !== "other" ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            aria-label="លុប"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
