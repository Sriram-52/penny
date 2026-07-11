import { parseExpenses, type ParseOptions } from "../src/parser/parse.js";
import type { ParseResult } from "../src/parser/schema.js";

// Deterministic "today" so relative-date checks are stable.
const TODAY = "2026-07-11";

interface Case {
  name: string;
  text: string;
  options?: Omit<ParseOptions, "today">;
  // Returns null on pass, or a human-readable failure reason.
  check: (result: ParseResult) => string | null;
}

const amounts = (r: ParseResult) => r.expenses.map((e) => e.amount).sort((a, b) => a - b);

const CASES: Case[] = [
  {
    name: "multi-item split",
    text: "chai 20, auto 150",
    check: (r) =>
      amounts(r).join(",") === "20,150" ? null : `amounts ${amounts(r).join(",")}`,
  },
  {
    name: "tally with decimals",
    text: "snacks 12.5+30+7.25",
    check: (r) =>
      r.expenses.length === 1 && r.expenses[0]?.amount === 49.75
        ? null
        : `got ${JSON.stringify(amounts(r))}, want [49.75]`,
  },
  {
    name: "long tally",
    text: "shopping 199+249+1299+49+899",
    check: (r) =>
      r.expenses.length === 1 && r.expenses[0]?.amount === 2695
        ? null
        : `got ${JSON.stringify(amounts(r))}, want [2695]`,
  },
  {
    name: "relative date: yesterday",
    text: "coffee 100 yesterday",
    check: (r) =>
      r.expenses[0]?.date === "2026-07-10" ? null : `date ${r.expenses[0]?.date}`,
  },
  {
    name: "chatter ignored, expense kept",
    text: "call mom tomorrow, milk 35, pick up laundry",
    check: (r) =>
      r.expenses.length === 1 && r.expenses[0]?.amount === 35
        ? null
        : `got ${r.expenses.length} items ${JSON.stringify(amounts(r))}`,
  },
  {
    name: "pure chatter → empty",
    text: "remember to call amma about the weekend",
    check: (r) => (r.expenses.length === 0 ? null : `got ${r.expenses.length} items`),
  },
  {
    name: "taught rule applied",
    text: "chai 20",
    options: { rules: [{ pattern: "chai", category: "transport" }] },
    check: (r) =>
      r.expenses[0]?.category === "transport" ? null : `category ${r.expenses[0]?.category}`,
  },
  {
    name: "custom category used",
    text: "mehendi 1500",
    options: { categories: ["wedding", "dining", "other"] },
    check: (r) =>
      r.expenses[0]?.category === "wedding" ? null : `category ${r.expenses[0]?.category}`,
  },
  {
    name: "received mode, terse",
    text: "20000 from ravi",
    options: { received: true, currency: "INR" },
    check: (r) =>
      r.expenses.length === 1 && r.expenses[0]?.amount === 20000
        ? null
        : `got ${JSON.stringify(amounts(r))}`,
  },
  {
    name: "description preserved",
    text: "auto to airport 350",
    check: (r) =>
      (r.expenses[0]?.description ?? "").toLowerCase().includes("airport")
        ? null
        : `description "${r.expenses[0]?.description}"`,
  },
  {
    name: "newline-separated items",
    text: "chai 20\nauto 150\nmovie 300",
    check: (r) =>
      amounts(r).join(",") === "20,150,300" ? null : `amounts ${amounts(r).join(",")}`,
  },
  {
    name: "mixed spend + receive in one note",
    text: "chai 20, auto 150, got 500 back from ravi",
    check: (r) =>
      r.expenses.length === 3 ? null : `got ${r.expenses.length} items (want 3)`,
  },
];

let passed = 0;
let totalMs = 0;

for (const testCase of CASES) {
  const started = Date.now();
  try {
    const result = await parseExpenses(testCase.text, { ...testCase.options, today: TODAY });
    const ms = Date.now() - started;
    totalMs += ms;
    const failure = testCase.check(result);
    if (failure === null) {
      passed += 1;
      console.log(`PASS  ${testCase.name} (${ms}ms)`);
    } else {
      console.log(`FAIL  ${testCase.name} (${ms}ms): ${failure}`);
    }
  } catch (err) {
    const ms = Date.now() - started;
    totalMs += ms;
    console.log(`ERROR ${testCase.name} (${ms}ms): ${err instanceof Error ? err.name : String(err)}`);
  }
}

console.log(`\n${passed}/${CASES.length} passed · avg ${Math.round(totalMs / CASES.length)}ms · model ${process.env.PENNY_MODEL ?? "(default)"}`);
