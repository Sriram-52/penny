import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createVertex } from "@ai-sdk/google-vertex";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { generateObject, type LanguageModel } from "ai";

import { buildSystemPrompt, buildUserMessage, type ParseRule } from "./prompt.js";
import { DEFAULT_CATEGORIES, parseResultSchema, type ParseResult } from "./schema.js";

export function sanitizeCategories(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    .slice(0, 50)
    .map((c) => c.trim().toLowerCase().slice(0, 30));
}

export function sanitizeRules(input: unknown): ParseRule[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (r): r is { pattern: unknown; category: unknown } =>
        typeof r === "object" && r !== null && "pattern" in r && "category" in r,
    )
    .filter((r) => typeof r.pattern === "string" && typeof r.category === "string")
    .slice(0, 100)
    .map((r) => ({
      pattern: String(r.pattern).slice(0, 80),
      category: String(r.category).slice(0, 30),
    }));
}

// Model spec: "<provider>:<model-id>", swappable via env without code changes.
//   bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0
//   bedrock:us.amazon.nova-lite-v1:0
//   vertex:gemini-2.5-flash
//   openai:openai.gpt-oss-120b  (chat-completions on any OpenAI-compatible endpoint via OPENAI_BASE_URL + OPENAI_API_KEY)
//   responses:openai.gpt-5.5    (Responses API on the same endpoint, for models that require it)
const MODEL_SPEC = process.env.PENNY_MODEL ?? "bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0";
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY ?? "USD";

// Reused across Lambda invocations of a warm container.
let model: LanguageModel | undefined;

function getModel(): LanguageModel {
  if (model) return model;

  const separator = MODEL_SPEC.indexOf(":");
  const provider = MODEL_SPEC.slice(0, separator);
  const modelId = MODEL_SPEC.slice(separator + 1);

  switch (provider) {
    case "bedrock": {
      const bedrock = createAmazonBedrock({
        region: process.env.AWS_REGION ?? "us-east-1",
        // Bedrock API keys (AWS_BEARER_TOKEN_BEDROCK) take precedence when
        // present; otherwise fall back to SigV4 via the default credential
        // chain (~/.aws config locally, execution role on AWS).
        ...(process.env.AWS_BEARER_TOKEN_BEDROCK
          ? {}
          : { credentialProvider: fromNodeProviderChain() }),
      });
      model = bedrock(modelId);
      break;
    }
    case "openai": {
      const baseURL = process.env.OPENAI_BASE_URL;
      if (!baseURL) throw new Error("OPENAI_BASE_URL is required for openai: models");
      const compat = createOpenAICompatible({
        name: "openai-compatible",
        baseURL,
        apiKey: process.env.OPENAI_API_KEY,
        // Send response_format json_schema instead of prompt-injected JSON
        // instructions; reasoning models drift off-schema without it.
        supportsStructuredOutputs: true,
      });
      model = compat(modelId);
      break;
    }
    case "responses": {
      const baseURL = process.env.OPENAI_BASE_URL;
      if (!baseURL) throw new Error("OPENAI_BASE_URL is required for responses: models");
      const openai = createOpenAI({ baseURL, apiKey: process.env.OPENAI_API_KEY });
      model = openai.responses(modelId);
      break;
    }
    case "vertex": {
      // Auth: a service-account JSON string in GOOGLE_SERVICE_ACCOUNT_KEY
      // (project derived from it), or ADC + GOOGLE_VERTEX_PROJECT when unset.
      const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const sa = saJson
        ? (JSON.parse(saJson) as { project_id?: string; client_email?: string; private_key?: string })
        : undefined;
      const vertex = createVertex({
        project: process.env.GOOGLE_VERTEX_PROJECT ?? sa?.project_id,
        location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1",
        ...(sa ? { googleAuthOptions: { credentials: sa } } : {}),
      });
      model = vertex(modelId);
      break;
    }
    default:
      throw new Error(`unknown provider in PENNY_MODEL: ${MODEL_SPEC}`);
  }
  return model;
}

export interface ParseOptions {
  today?: string;
  rules?: ParseRule[];
  categories?: string[];
  currency?: string;
  received?: boolean;
}

export function sanitizeCurrency(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : undefined;
}

export async function parseExpenses(text: string, options: ParseOptions = {}): Promise<ParseResult> {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const categories =
    options.categories && options.categories.length > 0
      ? options.categories
      : [...DEFAULT_CATEGORIES];
  const currency = options.currency ?? DEFAULT_CURRENCY;

  const { object } = await generateObject({
    model: getModel(),
    schema: parseResultSchema,
    system: buildSystemPrompt(currency, categories),
    prompt: buildUserMessage(text, today, options.rules ?? [], options.received === true),
    maxOutputTokens: 4096,
    providerOptions: {
      // Reasoning models on OpenAI-compatible endpoints think out loud for
      // pages unless told otherwise; this parse task doesn't need it.
      openaiCompatible: { reasoningEffort: "low" },
    },
    // Some models wrap the object in a stray (sometimes unclosed) top-level
    // array or emit a bare expenses array; repair deterministically instead
    // of failing the parse.
    experimental_repairText: async ({ text }) => {
      const trimmed = text.trim();
      const candidates = [
        trimmed,
        trimmed.replace(/^\[\s*/, ""),
        `${trimmed}]`,
        trimmed.replace(/^\[\s*/, "").replace(/\]\s*$/, ""),
      ];
      for (const candidate of candidates) {
        try {
          const parsed: unknown = JSON.parse(candidate);
          if (Array.isArray(parsed)) {
            const first: unknown = parsed[0];
            if (first && typeof first === "object" && "expenses" in first) {
              return JSON.stringify(first);
            }
            return JSON.stringify({ expenses: parsed });
          }
          if (parsed && typeof parsed === "object") {
            return JSON.stringify(parsed);
          }
        } catch {
          // Try the next candidate.
        }
      }
      return null;
    },
  });

  return object;
}
