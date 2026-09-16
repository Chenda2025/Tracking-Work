"use client";

import type { MoneyCurrency } from "@/lib/types";
import {
  describeKhmerRiel,
  describeKhmerRielCompact,
  normalizeMoneyCurrency,
} from "@/lib/utils";

export function KhmerAmountHint({
  amount,
  currency,
}: {
  amount: string | number;
  currency?: MoneyCurrency | string;
}) {
  if (normalizeMoneyCurrency(currency) !== "KHR") return null;
  const text = describeKhmerRielCompact(amount);
  if (!text) return null;
  return (
    <p
      className="finance-amount-scale"
      aria-live="polite"
      title={describeKhmerRiel(amount)}
    >
      {text}
    </p>
  );
}
