import { z } from "zod";

import { parseExpenses } from "./parse.js";

// The one definition of what a parse request looks like. Both the Lambda
// handler and the dev server delegate here; they only own transport concerns
// (auth, routing).
export const parseRequestSchema = z.object({
  text: z.string().trim().min(1, "text is required").max(8000, "text too long (max 8000 chars)"),
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "today must be YYYY-MM-DD")
    .optional(),
  rules: z
    .array(
      z.object({
        pattern: z.string().max(80),
        category: z.string().max(30),
      }),
    )
    .max(100)
    .default([]),
  categories: z.array(z.string().trim().min(1).max(30)).max(50).default([]),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO code")
    .transform((c) => c.toUpperCase())
    .optional(),
  received: z.boolean().default(false),
});

export interface ParseResponse {
  status: number;
  body: unknown;
}

export async function handleParseRequest(rawBody: string | undefined): Promise<ParseResponse> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody || "{}");
  } catch {
    return { status: 400, body: { error: "invalid JSON body" } };
  }

  const request = parseRequestSchema.safeParse(json);
  if (!request.success) {
    const issue = request.error.issues[0];
    const path = issue?.path.join(".");
    return {
      status: 400,
      body: { error: path ? `${path}: ${issue?.message}` : (issue?.message ?? "invalid request") },
    };
  }

  const { text, today, rules, categories, currency, received } = request.data;
  try {
    const result = await parseExpenses(text, { today, rules, categories, currency, received });
    return { status: 200, body: result };
  } catch (err) {
    console.error("parse failed:", err);
    return { status: 502, body: { error: "parse failed" } };
  }
}
