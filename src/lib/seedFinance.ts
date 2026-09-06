import type { FinanceCategory, Transaction, TransactionType } from "./types";
import { format } from "date-fns";

const INCOME: FinanceCategory[] = [
  "salary",
  "freelance",
  "business",
  "gift",
  "other",
];

const EXPENSE: FinanceCategory[] = [
  "food",
  "transport",
  "housing",
  "utilities",
  "health",
  "education",
  "family",
  "entertainment",
  "savings",
  "other",
];

const NOTES_KM = [
  "អាហារពេលព្រឹក",
  "ទិញបន្លែ",
  "ប្រេងឥន្ធនៈ",
  "ទឹកភ្លើង",
  "ថ្នាំ",
  "សាលា",
  "អំណោយគ្រួសារ",
  "កាហ្វេ",
  "សន្សំប្រចាំខែ",
  "ការងារបន្ថែម",
  "ប្រាក់ខែ",
  "ជួសជុលផ្ទះ",
  "ទូរស័ព្ទ",
  "អ៊ីនធឺណិត",
  "",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Deterministic 100 demo finance rows for UI testing. */
export function buildDemoFinanceTransactions(
  count = 100,
  now = new Date()
): Transaction[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const items: Transaction[] = [];

  for (let i = 0; i < count; i++) {
    const dayOffset = i % 75;
    const d = new Date(year, month, now.getDate());
    d.setDate(d.getDate() - dayOffset);
    const date = format(d, "yyyy-MM-dd");

    const isIncome = i % 5 === 0;
    const type: TransactionType = isIncome ? "income" : "expense";
    const category = isIncome
      ? INCOME[i % INCOME.length]
      : EXPENSE[i % EXPENSE.length];
    const currency = i % 3 === 0 ? "USD" : "KHR";

    let amount: number;
    if (currency === "USD") {
      amount = isIncome
        ? [50, 100, 200, 350, 500, 800][i % 6]
        : [3, 5, 8, 12, 20, 35, 50, 75][i % 8];
    } else {
      amount = isIncome
        ? [200_000, 410_000, 820_000, 1_200_000, 2_000_000][i % 5]
        : [5_000, 10_000, 20_000, 35_000, 50_000, 80_000, 120_000, 200_000][
            i % 8
          ];
    }

    const hour = 8 + (i % 12);
    const minute = (i * 7) % 60;
    const createdAt = `${date}T${pad2(hour)}:${pad2(minute)}:00.000Z`;

    items.push({
      id: `demo-tx-${pad2(i + 1)}`,
      type,
      amount,
      currency,
      category,
      note: NOTES_KM[i % NOTES_KM.length],
      date,
      createdAt,
    });
  }

  return items;
}
