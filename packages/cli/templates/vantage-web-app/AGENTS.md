# AGENTS.md

Guidance for AI coding agents working with this example. It is a **worked
reference for Terra's Vantage API** (diagnostics: order blood/DNA test kits,
track fulfilment, deliver FHIR results). The terra-vantage skill explains the
API; this app shows the wiring. Install the skills first:

```bash
npx skills add tryterra/agent-skills --skill terra-vantage
```

Live API docs: https://docs.tryterra.co/vantage-api-docs (append `.md` to any
page for markdown).

## Run it

```bash
npm install
npm run setup        # env check — names every key and where to get it (exit 0 always)
npm run dev          # ZERO credentials needed: demo mode with real captured fixtures
```

- **Demo mode** (no `.env` keys): the whole UI renders from captured sandbox
  fixtures, read-only. Mutating actions are disabled behind a visible banner.
- **Live sandbox**: put `TERRA_DEV_ID`, `TERRA_API_KEY` in `.env` (see
  `.env.example` for where each comes from). Reads/writes hit the real Vantage
  sandbox; order/result updates arrive by **polling** (10s).
- **Webhook upgrade**: add `TERRA_SIGNING_SECRET`, then `npm run webhook:tunnel`
  (needs the ngrok CLI, authed). The script starts the tunnel AND registers the
  URL with Vantage. The webhook inbox at `/ops/webhooks` goes live.

`npm run setup -- --json` emits a machine-readable status on stdout.

## Copy this, not that

The liftable Vantage integration lives in **`src/server/lib/vantage/`** — one
capability per file, importing only the client + node stdlib + zod + generated
types (ESLint-enforced). Lift the file for your goal:

| Goal                                   | Copy                   | Depends on            |
| -------------------------------------- | ---------------------- | --------------------- |
| Call Vantage at all                    | `client.ts`            | `api-error.ts`        |
| Classify/sanitize Vantage errors       | `api-error.ts`         | nothing               |
| Verify webhook signatures              | `webhook-signature.ts` | nothing (node:crypto) |
| Browse the catalog / curation          | `catalog.ts`           | client                |
| Place + track orders, labs, activation | `orders.ts`            | client                |
| Safe retry / missed-webhook recovery   | `reconcile.ts`         | client, orders        |
| Fetch + acknowledge results            | `results.ts`           | client                |
| Parse FHIR result bundles              | `fhir.ts`              | nothing               |
| Sandbox lifecycle simulation           | `simulate.ts`          | client                |
| Overview + delivery outcomes           | `monitoring.ts`        | client                |
| Register the webhook URL               | `webhook-config.ts`    | client                |

Do NOT copy as Vantage reference code: `src/server/lib/db.ts`,
`webhook-events.ts`, `fixtures.ts`, anything under `src/client` — that's this
app's plumbing, not the API integration.

The webhook ENDPOINT pattern worth copying is `src/server/routes/webhook.ts`:
raw body → verify → parse → dedup on `event_id` → fast 200. On serverless,
move post-response work into `waitUntil`/a queue.

## Principles this app demonstrates (keep them if you extend it)

- **Query Vantage, don't mirror it.** Vantage is the system of record; the
  local DB holds only webhook events, patients, and the patient↔order_item↔
  test_taker mapping (`db/schema.ts`). No local orders table, on purpose.
- **Track by `order_item_id`, not `order_id`** — real orders can hold multiple
  items; results/activation/acknowledgment are per item. (This demo UI places
  single-item orders for simplicity.)
- **All Vantage IDs are strings** (64-bit snowflakes). Never `Number()` them.
- **Retry-safe creation = the `Idempotency-Key` header** (one UUID per order
  attempt — see `orders.ts#createOrder`): same key + body replays the original
  result; without it creation is NOT deduplicated, and
  `reconcile.ts#findOrderByReference` is the fallback pattern.
- **Acknowledgment is a liability action.** The persona switch here is a DEMO
  device, not auth: in production the acknowledge call must be bound to an
  authenticated end user, triggered by their explicit action.
- Reconcile is a **manual action** (Sync buttons), never a cron.

## Repo layout

```
src/server/lib/vantage/   ← the liftable Vantage integration (see table)
src/server/lib/           ← app plumbing (db, webhook-events, env)
src/server/routes/        ← Hono routes: shop (storefront), ops (console), webhook
src/client/               ← React app; /shop and /ops personas over one lib
db/                       ← Drizzle SQLite schema (3 tables) + migrations
docs/                     ← why-documents for the key patterns
vendor/vantage-openapi.yaml ← vendored spec; `npm run gen:types` regenerates types
```

Checks: `npm run typecheck && npm run lint && npm test && npm run format:check`.
`gen:types` must leave no diff (CI-gated).
