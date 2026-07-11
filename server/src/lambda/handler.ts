import { timingSafeEqual } from "node:crypto";

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

import { parseExpenses, sanitizeCategories, sanitizeCurrency, sanitizeRules } from "../parser/parse.js";

const MAX_TEXT_LENGTH = 8000;

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (!authorized(event.headers["x-app-secret"])) {
    return json(401, { error: "unauthorized" });
  }
  if (event.requestContext.http.method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  let body: {
    text?: unknown;
    today?: unknown;
    rules?: unknown;
    categories?: unknown;
    currency?: unknown;
    received?: unknown;
  };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "invalid JSON body" });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return json(400, { error: "missing text" });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return json(400, { error: `text too long (max ${MAX_TEXT_LENGTH} chars)` });
  }
  const today = typeof body.today === "string" ? body.today : undefined;
  const rules = sanitizeRules(body.rules);
  const userCategories = sanitizeCategories(body.categories);
  const currency = sanitizeCurrency(body.currency);

  try {
    const result = await parseExpenses(text, {
      today,
      rules,
      categories: userCategories,
      currency,
      received: body.received === true,
    });
    return json(200, result);
  } catch (err) {
    console.error("parse failed:", err);
    return json(502, { error: "parse failed" });
  }
}

function authorized(secret: string | undefined): boolean {
  const expected = process.env.APP_SECRET;
  if (!expected || !secret) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(statusCode: number, payload: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}
