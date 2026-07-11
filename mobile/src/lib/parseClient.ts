import type { ParseResult } from "../types";
import { localToday } from "./format";

const PARSE_URL = process.env.EXPO_PUBLIC_PARSE_URL;
const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET;

export interface ParseRule {
  pattern: string;
  category: string;
}

export async function parseNote(
  text: string,
  rules: ParseRule[],
  categories: string[],
  currency: string,
  received: boolean,
): Promise<ParseResult> {
  if (!PARSE_URL) return stubParse(text, rules, currency);

  const res = await fetch(PARSE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(APP_SECRET ? { "x-app-secret": APP_SECRET } : {}),
    },
    body: JSON.stringify({
      text,
      today: localToday(),
      rules: rules.slice(0, 50),
      categories: categories.slice(0, 50),
      currency,
      received,
    }),
  });
  if (!res.ok) throw new Error(`parser responded ${res.status}`);
  return (await res.json()) as ParseResult;
}

// Offline fallback when no parser URL is configured: naive split + amount
// grab so the app stays usable. Everything it produces is confidence "low".
const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/coffee|lunch|dinner|breakfast|pizza|restaurant|chai|tea|snack|food/i, "dining"],
  [/uber|lyft|cab|taxi|bus|train|metro|gas|fuel|parking/i, "transport"],
  [/grocer|costco|walmart|market|veggies|milk/i, "groceries"],
  [/movie|netflix|spotify|game|concert/i, "entertainment"],
  [/rent|electric|internet|wifi|phone bill|insurance/i, "bills"],
  [/doctor|pharmacy|medicine|gym/i, "health"],
  [/flight|hotel|airbnb/i, "travel"],
];

function stubParse(text: string, rules: ParseRule[], currency: string): ParseResult {
  const today = localToday();
  const segments = text
    .split(/[,\n;]| and /i)
    .map((s) => s.trim())
    .filter(Boolean);

  const expenses = segments.flatMap((segment) => {
    const amounts = segment.match(/-?\d+(?:\.\d{1,2})?/g);
    const last = amounts?.[amounts.length - 1];
    if (!last) return [];
    const amount = Number(last);
    if (!Number.isFinite(amount) || amount === 0) return [];
    const description = segment.replace(last, "").replace(/[$₹€£]/g, "").trim() || "Expense";
    const taught = rules.find((r) => segment.toLowerCase().includes(r.pattern))?.category;
    const category =
      taught ?? CATEGORY_HINTS.find(([re]) => re.test(segment))?.[1] ?? "other";
    return [
      {
        amount: Math.abs(amount),
        currency,
        description,
        category,
        date: today,
        confidence: "low" as const,
      },
    ];
  });

  return { expenses };
}
