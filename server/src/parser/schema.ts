import { z } from "zod";

// Fallback category set, used when the client doesn't send the user's own list.
export const DEFAULT_CATEGORIES = [
  "groceries",
  "dining",
  "transport",
  "shopping",
  "entertainment",
  "health",
  "bills",
  "travel",
  "personal",
  "other",
] as const;

export const parsedExpenseSchema = z.object({
  amount: z.number().describe("The amount, always positive."),
  currency: z
    .string()
    .describe("ISO 4217 code, e.g. USD. Use the default currency when the note doesn't specify one."),
  description: z
    .string()
    .describe("Short label for the expense, e.g. 'Coffee' or 'Uber to airport'. Keep the user's wording."),
  category: z
    .string()
    .describe("One of the user's category names, exactly as given. Use 'other' when none fits."),
  date: z.string().describe("Date of the expense as YYYY-MM-DD, resolved against today's date."),
  confidence: z
    .enum(["high", "low"])
    .describe("low when the amount, date, or meaning required guessing."),
});

export const parseResultSchema = z.object({
  expenses: z.array(parsedExpenseSchema),
});

export type ParsedExpense = z.infer<typeof parsedExpenseSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;
