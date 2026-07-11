import { parseExpenses } from "../src/parser/parse.js";

const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error('usage: pnpm try "coffee 6.50, uber to airport 32 yesterday"');
  process.exit(1);
}

const started = Date.now();
const result = await parseExpenses(text);
console.log(JSON.stringify(result, null, 2));
console.error(`\n${result.expenses.length} expense(s) in ${Date.now() - started}ms`);
