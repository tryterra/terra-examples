# AGENTS.md

Guidance for AI coding agents working with this example. It is a **worked
reference for Terra's `clinical_record` data type**: Apple Health Records
delivered as raw FHIR (DSTU2 or R4), backfilled through the pull API, kept
fresh by webhooks, and rendered as readable cards.

Live API docs: https://docs.tryterra.co (append `.md` to any page for
markdown).

## Run it

```bash
npm install
npm run setup        # env check - names every key and where to get it (exit 0 always)
npm run dev          # ZERO credentials needed: demo mode on synthetic records
```

- **Demo mode** (no `.env` keys): on boot the server migrates
  `./data/app.db` and upserts the fixtures in `src/server/demo-fixtures.ts`.
  Syncing and adding users are blocked behind a visible banner.
- **Live**: `TERRA_DEV_ID` + `TERRA_API_KEY` in `.env`, and CLINICAL_RECORD
  enabled for the dev ID in the Terra dashboard (it is gated; otherwise 403).
- **Webhooks** (optional): `TERRA_WEBHOOK_SECRET` enables `POST /api/webhook`.

## Terra API facts this app relies on

- Pull: `GET /v2/clinicalRecord?user_id=&limit=(<=100)&cursor=` (also
  `resource_type`, `clinical_type`, `received_since`), headers `dev-id` and
  `x-api-key`. Response `{ type, user_id, data, next_cursor, has_more }`.
  `next_cursor` is always returned; keep the last one to resume. A cursor is
  bound to the filters it was issued with. Records received in the last
  60 seconds are held back.
- Webhook: `unified_api.clinical_record.updated`, payload
  `{ type: "clinical_record", user, data, version }`, only new or changed
  records. Signature header `terra-signature: t=<seconds>,v1=<hex>`,
  HMAC-SHA256 over `${t}.${rawBody}`.
- Record: `record_id`, `clinical_type` (open set), `display_name`,
  `source_name`, `received_at`, `fhir` metadata (`resource_type`, `release`
  DSTU2/R4/null, ...), `fhir_resource` (raw FHIR or null) and
  `fhir_resource_error` (null or `fhir_resource_unavailable`).

## Architecture in one pass

- `src/server/index.ts` - Hono route chain; `export type AppType` is the
  whole client contract (consumed via `hc<AppType>`, no codegen). Don't
  break the chain.
- `src/server/lib/clinical/` - liftable, framework-free pieces (lint
  enforces no DB, Hono, or env imports): `types.ts`, `fhir.ts` (DSTU2 + R4
  readers, fallback summary), `sync.ts` (cursor paging),
  `webhook-signature.ts`.
- `src/server/lib/store.ts` - SQLite read model: upserts keyed on
  `record_id` with a `received_at` guard, per-user cursor persistence.
- `src/server/routes/` - `users.ts` (list, add + backfill, records, sync)
  and `webhook.ts` (raw body, verify, parse, upsert).
- `src/client/` - React 19 + TanStack Router (file-based) / Query. Server
  types flow through `src/client/lib/queries.ts`.

## Conventions that matter

- Never drop a record: unknown resource or clinical types and records with
  `fhir_resource_unavailable` still render from `display_name` and a date.
- Parse FHIR structurally (DSTU2 and R4 field names side by side), never by
  trusting `fhir.release`.
- FHIR dates render at the precision given; never invent a day.
- No em dashes in user-visible text; plain hyphens.
- Demo data is synthetic. Never commit real patient data or a database
  containing it (`data/` is gitignored).

## Checks

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```
