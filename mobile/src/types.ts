// Categories are user-defined tags; these are only the starter set seeded on
// first launch. `category` on an expense is whatever the user's list contains.
export type Category = string;

export interface CategoryDef {
  name: string;
  emoji: string;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: "groceries", emoji: "🛒" },
  { name: "dining", emoji: "🍜" },
  { name: "transport", emoji: "🚗" },
  { name: "shopping", emoji: "🛍️" },
  { name: "entertainment", emoji: "🎬" },
  { name: "health", emoji: "💊" },
  { name: "bills", emoji: "🧾" },
  { name: "travel", emoji: "✈️" },
  { name: "personal", emoji: "🌸" },
  { name: "other", emoji: "🪙" },
];

export type ExpenseKind = "debit" | "credit";

// Mirror of the server parser's output shape - keep the two in sync.
// kind is deliberately NOT part of it: whether money went out or came in is
// chosen explicitly in the UI, never inferred from wording.
export interface ParsedEntry {
  amount: number;
  currency: string;
  description: string;
  category: Category;
  date: string;
  confidence: "high" | "low";
}

export interface ParsedExpense extends ParsedEntry {
  kind: ExpenseKind;
}

export interface ParseResult {
  expenses: ParsedEntry[];
}
