"use client";

import type { MoneyCurrency } from "@/lib/types";
import { KhmerAmountHint } from "@/components/KhmerAmountHint";
import { MoneyAmountInput } from "@/components/MoneyAmountInput";

export function FinanceAmountRow({
  label,
  value,
  onChange,
  currency,
  onCurrencyChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (digits: string) => void;
  currency?: MoneyCurrency | string;
  onCurrencyChange?: (next: MoneyCurrency) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="event-row finance-amount-row">
      <span className="event-row-label">{label}</span>
      <div className="finance-amount-field">
        <MoneyAmountInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
        <KhmerAmountHint amount={value} currency={currency} />
      </div>
      {onCurrencyChange ? (
        <div className="event-period" role="group" aria-label="រូបិយប័ណ្ណ">
          <button
            type="button"
            data-active={currency === "KHR"}
            aria-pressed={currency === "KHR"}
            onClick={() => onCurrencyChange("KHR")}
          >
            រៀល
          </button>
          <button
            type="button"
            data-active={currency === "USD"}
            aria-pressed={currency === "USD"}
            onClick={() => onCurrencyChange("USD")}
          >
            ដុល្លារ
          </button>
        </div>
      ) : null}
    </div>
  );
}
