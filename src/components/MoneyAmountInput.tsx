"use client";

import { formatMoneyGrouped, parseMoneyDigits } from "@/lib/utils";

export function MoneyAmountInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      className="event-row-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="done"
      required={required}
      placeholder={placeholder ? formatMoneyGrouped(placeholder) : undefined}
      value={formatMoneyGrouped(value)}
      onChange={(event) => onChange(parseMoneyDigits(event.target.value))}
    />
  );
}
