# Penny

Notes-first expense tracker. Type it like a note ("coffee 6.50, uber to airport 32"), Penny turns it into structured expenses.

- `mobile/` - Expo (React Native) app, Android first. Local-first storage (expo-sqlite + Drizzle).
- `server/` - expense parser: schema-validated structured output via the Vercel AI SDK (`generateObject` + zod). Model is swappable through `PENNY_MODEL`. Ships as a single Lambda; also runnable locally.

## Server quick start

```bash
pnpm install
cd server
pnpm try "coffee 6.50, uber to airport 32 yesterday"
```

Model selection via `PENNY_MODEL` (`<provider>:<model-id>`):

| Value | Needs |
|---|---|
| `bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0` (default) | AWS credentials + Anthropic model access in Bedrock |
| `bedrock:us.amazon.nova-lite-v1:0` | AWS credentials + Nova model access in Bedrock |
| `vertex:gemini-2.5-flash` | `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string) or ADC + `GOOGLE_VERTEX_PROJECT` |
| `openai:<model-id>` | `OPENAI_BASE_URL` + `OPENAI_API_KEY` (any OpenAI-compatible endpoint, e.g. Bedrock's `/v1` with a Bedrock API key) |

Bedrock model IDs: check Bedrock console → Model catalog → the model's "API request" sample for the exact inference-profile ID in your region. AWS credentials come from the default chain (`aws configure` locally, execution role on Lambda). `AWS_REGION` defaults to `us-east-1`.

## Dev loop (phone + laptop on the same Wi-Fi)

Terminal A - parser server (pick any supported model via `PENNY_MODEL`; Vertex example):

```bash
cd server
GOOGLE_SERVICE_ACCOUNT_KEY="$(cat /path/to/service-account.json)" \
PENNY_MODEL=vertex:gemini-2.5-flash pnpm dev
```

(For Vertex, the service account needs the "Vertex AI User" role; project comes from the key, location from `GOOGLE_VERTEX_LOCATION`, default us-central1. With no `PENNY_MODEL` set, the default is Claude Haiku 4.5 on Bedrock using the standard AWS credential chain.)

Terminal B - the app:

```bash
cd mobile
cp .env.example .env   # set EXPO_PUBLIC_PARSE_URL to http://<your-mac-ip>:8787/parse
npx expo start
```

Scan the QR with Expo Go on Android. With no `EXPO_PUBLIC_PARSE_URL` set, the app falls back to a built-in offline stub parser so it works with zero setup.

## Lambda

```bash
cd server
pnpm zip   # builds dist/penny-parser.zip for upload
```

Handler: `index.handler`. Env vars: `APP_SECRET` (required), `AWS_REGION` (from Lambda), optional `PENNY_MODEL`, `DEFAULT_CURRENCY`.
