import { createServer } from "node:http";

import { handleParseRequest } from "../src/parser/request.js";
import type { ParseResult } from "../src/parser/schema.js";

const PORT = Number(process.env.PORT ?? 8787);

// LAN-only dev stand-in for the Lambda. Same request/response contract as the
// Function URL handler, minus auth. Do not expose beyond your network.
createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/parse") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  let raw = "";
  for await (const chunk of req) raw += chunk;

  const started = Date.now();
  const { status, body } = await handleParseRequest(raw);
  if (status === 200) {
    const count = (body as ParseResult).expenses.length;
    console.log(`parsed ${count} expense(s) in ${Date.now() - started}ms`);
  } else {
    console.log(`rejected (${status}): ${JSON.stringify(body)}`);
  }

  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}).listen(PORT, "0.0.0.0", () => {
  console.log(`penny parser dev server: POST http://<this-machine-ip>:${PORT}/parse`);
});
