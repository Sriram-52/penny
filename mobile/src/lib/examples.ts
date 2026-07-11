// Example snippets shown in placeholders and empty states. Amounts that read
// naturally differ wildly by currency ("coffee 6.50" means nothing in INR),
// so pick examples that match the user's money.
const BY_CURRENCY: Record<string, { entry: string; full: string }> = {
  INR: { entry: "chai 20, auto 150", full: "chai 20, movie tickets 500" },
  JPY: { entry: "coffee 500, taxi 2000", full: "coffee 500, movie 1800" },
  KRW: { entry: "coffee 4500, taxi 12000", full: "coffee 4500, movie 15000" },
  IDR: { entry: "kopi 25000, ojek 15000", full: "kopi 25000, movie 50000" },
  VND: { entry: "coffee 30000, taxi 80000", full: "coffee 30000, movie 100000" },
};

const DEFAULT = { entry: "coffee 6.50, uber 32", full: "coffee 6.50, movie tickets 24" };

export function entryExample(currency?: string | null): string {
  return (currency && BY_CURRENCY[currency]?.entry) || DEFAULT.entry;
}

export function fullExample(currency?: string | null): string {
  return (currency && BY_CURRENCY[currency]?.full) || DEFAULT.full;
}
