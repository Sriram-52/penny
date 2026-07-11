import type { CategoryRecord } from "../db";

export interface CategoryMeta {
  label: string;
  emoji: string;
  tint: string;
}

const TINTS = [
  "#6FA76F",
  "#D98243",
  "#5D8FC2",
  "#C271A8",
  "#8B78C9",
  "#4FA79B",
  "#A0893C",
  "#4C9FC0",
  "#C97B8E",
  "#9A8F83",
];

// Starter categories keep their curated colors; custom ones get a stable
// color derived from the name.
const PRESET_TINTS: Record<string, string> = {
  groceries: "#6FA76F",
  dining: "#D98243",
  transport: "#5D8FC2",
  shopping: "#C271A8",
  entertainment: "#8B78C9",
  health: "#4FA79B",
  bills: "#A0893C",
  travel: "#4C9FC0",
  personal: "#C97B8E",
  other: "#9A8F83",
};

export function categoryTint(name: string): string {
  const preset = PRESET_TINTS[name];
  if (preset) return preset;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length] ?? "#9A8F83";
}

export function getCategoryMeta(name: string, categories: CategoryRecord[]): CategoryMeta {
  const record = categories.find((c) => c.name === name);
  return {
    label: name.charAt(0).toUpperCase() + name.slice(1),
    emoji: record?.emoji ?? "🏷️",
    tint: categoryTint(name),
  };
}
