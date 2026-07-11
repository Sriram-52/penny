import { createServer } from "node:http";

import { parseExpenses, sanitizeCategories, sanitizeCurrency, sanitizeRules } from "../src/parser/parse.js";

const PORT = Number(process.env.PORT ?? 8787);

// LAN-only dev stand-in for the Lambda. Same request/response shape as the
// Function URL handler, minus auth. Do not expose beyond your network.
createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/parse") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  let raw = "";
  for await (const chunk of req) raw += chunk;

  try {
    const body = JSON.parse(raw || "{}") as {
      text?: unknown;
      today?: unknown;
      rules?: unknown;
      categories?: unknown;
      currency?: unknown;
      received?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "missing text" }));
      return;
    }
    const today = typeof body.today === "string" ? body.today : undefined;
    const rules = sanitizeRules(body.rules);
    const userCategories = sanitizeCategories(body.categories);
    const currency = sanitizeCurrency(body.currency);

    const started = Date.now();
    const result = await parseExpenses(text, {
      today,
      rules,
      categories: userCategories,
      currency,
      received: body.received === true,
    });
    console.log(`parsed ${result.expenses.length} expense(s) in ${Date.now() - started}ms: ${text.slice(0, 60)}`);

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error("parse failed:", err);
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "parse failed" }));
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`penny parser dev server: POST http://<this-machine-ip>:${PORT}/parse`);
});
