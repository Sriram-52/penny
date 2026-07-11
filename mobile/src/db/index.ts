import { asc, desc, eq, ne } from "drizzle-orm";
import { drizzle, useLiveQuery } from "drizzle-orm/expo-sqlite";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import * as Crypto from "expo-crypto";
import { openDatabaseSync } from "expo-sqlite";

import { DEFAULT_CATEGORIES, type ParsedExpense } from "../types";

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(),
  confidence: text("confidence").notNull(),
  // debit = money spent, credit = money received
  kind: text("kind").notNull().default("debit"),
  createdAt: integer("created_at").notNull(),
  // null = the built-in Everyday pocket
  pocketId: text("pocket_id"),
});

export const pockets = sqliteTable("pockets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Optional occasion date (YYYY-MM-DD), e.g. when the trip starts.
  eventDate: text("event_date"),
  // Optional spending target for this pocket (single currency, bare number).
  target: real("target"),
  createdAt: integer("created_at").notNull(),
});

// What Penny has learned: descriptions matching `pattern` belong to `category`.
export const rules = sqliteTable("rules", {
  pattern: text("pattern").primaryKey(),
  category: text("category").notNull(),
  createdAt: integer("created_at").notNull(),
});

// User-owned category tags. Seeded with defaults; fully editable.
export const categories = sqliteTable("categories", {
  name: text("name").primaryKey(),
  emoji: text("emoji").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type ExpenseRecord = typeof expenses.$inferSelect;
export type PocketRecord = typeof pockets.$inferSelect;
export type RuleRecord = typeof rules.$inferSelect;
export type CategoryRecord = typeof categories.$inferSelect;

const sqlite = openDatabaseSync("penny.db", { enableChangeListener: true });
sqlite.execSync(`
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    confidence TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pockets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    event_date TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rules (
    pattern TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY NOT NULL,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

// Additive migrations for databases created on earlier schema versions.
const expenseColumns = sqlite.getAllSync("PRAGMA table_info(expenses)") as Array<{ name: string }>;
if (!expenseColumns.some((c) => c.name === "pocket_id")) {
  sqlite.execSync("ALTER TABLE expenses ADD COLUMN pocket_id TEXT");
}
const pocketColumns = sqlite.getAllSync("PRAGMA table_info(pockets)") as Array<{ name: string }>;
if (!pocketColumns.some((c) => c.name === "event_date")) {
  sqlite.execSync("ALTER TABLE pockets ADD COLUMN event_date TEXT");
}
if (!pocketColumns.some((c) => c.name === "target")) {
  sqlite.execSync("ALTER TABLE pockets ADD COLUMN target REAL");
}
if (!expenseColumns.some((c) => c.name === "kind")) {
  sqlite.execSync("ALTER TABLE expenses ADD COLUMN kind TEXT NOT NULL DEFAULT 'debit'");
}

// Seed the starter categories once; after this the list belongs to the user.
const categoryCount = sqlite.getFirstSync("SELECT COUNT(*) AS c FROM categories") as { c: number };
if (categoryCount.c === 0) {
  const now = Date.now();
  for (const [i, def] of DEFAULT_CATEGORIES.entries()) {
    sqlite.runSync("INSERT OR IGNORE INTO categories (name, emoji, created_at) VALUES (?, ?, ?)", [
      def.name,
      def.emoji,
      now + i,
    ]);
  }
}

export const db = drizzle(sqlite);

export function useExpenses() {
  return useLiveQuery(
    db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.createdAt)),
  );
}

export function usePockets() {
  return useLiveQuery(db.select().from(pockets).orderBy(asc(pockets.createdAt)));
}

export async function saveExpenses(
  items: Array<ParsedExpense & { pocketId: string | null }>,
): Promise<void> {
  if (items.length === 0) return;
  const now = Date.now();
  await db.insert(expenses).values(
    items.map((item) => ({ id: Crypto.randomUUID(), ...item, createdAt: now })),
  );
}

export async function removeExpense(id: string): Promise<void> {
  await db.delete(expenses).where(eq(expenses.id, id));
}

export async function updateExpense(
  id: string,
  patch: {
    amount: number;
    description: string;
    category: string;
    date: string;
    kind: string;
    pocketId: string | null;
  },
): Promise<void> {
  await db.update(expenses).set(patch).where(eq(expenses.id, id));
}

export async function createPocket(
  name: string,
  eventDate: string | null,
  target: number | null,
): Promise<string> {
  const id = Crypto.randomUUID();
  await db.insert(pockets).values({ id, name, eventDate, target, createdAt: Date.now() });
  return id;
}

export async function updatePocket(
  id: string,
  patch: { name: string; eventDate: string | null; target: number | null },
): Promise<void> {
  await db.update(pockets).set(patch).where(eq(pockets.id, id));
}

// Deleting a pocket keeps its expenses; they move to Everyday.
export async function deletePocket(id: string): Promise<void> {
  await db.update(expenses).set({ pocketId: null }).where(eq(expenses.pocketId, id));
  await db.delete(pockets).where(eq(pockets.id, id));
}

export function useRules() {
  return useLiveQuery(db.select().from(rules).orderBy(desc(rules.createdAt)));
}

export function useCategories() {
  return useLiveQuery(db.select().from(categories).orderBy(asc(categories.createdAt)));
}

export async function addCategory(name: string, emoji: string): Promise<void> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return;
  await db
    .insert(categories)
    .values({ name: normalized, emoji: emoji.trim() || "🏷️", createdAt: Date.now() })
    .onConflictDoUpdate({
      target: categories.name,
      set: { emoji: emoji.trim() || "🏷️" },
    });
}

export async function deleteCategory(name: string): Promise<void> {
  await db.delete(categories).where(eq(categories.name, name));
}

export async function addRule(pattern: string, category: string): Promise<void> {
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return;
  await db
    .insert(rules)
    .values({ pattern: normalized, category, createdAt: Date.now() })
    .onConflictDoUpdate({
      target: rules.pattern,
      set: { category, createdAt: Date.now() },
    });
}

export async function deleteRule(pattern: string): Promise<void> {
  await db.delete(rules).where(eq(rules.pattern, pattern));
}

// Penny is single-currency: when the user picks (or changes) the app
// currency, every stored expense follows. Amounts are not converted.
export async function alignExpenseCurrency(code: string): Promise<void> {
  await db.update(expenses).set({ currency: code }).where(ne(expenses.currency, code));
}

// The single place the app-wide currency (and its fallback) lives.
export function getCurrency(): string {
  return getSetting("currency") ?? "USD";
}

// The single app-wide monthly spending target, or null if unset.
export function getMonthlyBudget(): number | null {
  const raw = getSetting("monthlyBudget");
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getSetting(key: string): string | null {
  const row = sqlite.getFirstSync("SELECT value FROM settings WHERE key = ?", [key]) as
    | { value: string }
    | null;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  if (value === null) {
    sqlite.runSync("DELETE FROM settings WHERE key = ?", [key]);
  } else {
    sqlite.runSync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  }
}
