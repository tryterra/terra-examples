<p align="center">
  <a href="https://tryterra.co">
    <img src="./src/client/assets/terra-logo-sidebar.svg" height="72" alt="Terra">
  </a>
  <h3 align="center">Terra Chart</h3>
  <p align="center">A clinical records dashboard built on Terra's <a href="https://docs.tryterra.co">clinical record data type</a> - Apple Health Records arrive as raw FHIR and render as readable lab results, vitals, conditions, medications, allergies, immunizations, and procedures.</p>
</p>

**Demonstrates:** backfilling a user's clinical records from the pull API
(`GET /v2/clinicalRecord`, cursor paging, resumable syncs), receiving
`unified_api.clinical_record.updated` webhooks with signature verification,
idempotent and order-safe storage keyed on `record_id`, and FHIR parsing that
handles both DSTU2 and R4 resources with a graceful fallback for anything
else.

|            |                                                                          |
| ---------- | ------------------------------------------------------------------------ |
| **Stack**  | React 19 · Hono · TanStack Router/Query · Drizzle (SQLite) · Tailwind v4 |
| **Runs**   | Locally - with no credentials it runs in demo mode on synthetic records  |
| **Deploy** | Anywhere Hono runs (the API is a plain Hono app)                         |

## Quick start

```bash
npm install
npm run dev
```

With no credentials the app runs in **demo mode** at http://localhost:5173:
two sample users, one with 22 synthetic Apple Health Records from two health
systems (DSTU2 and R4), one with none (the empty state). Syncing is disabled
behind a visible banner.

### Go live on the Terra API

1. Enable the **CLINICAL_RECORD** data type for your dev ID in the
   [Terra dashboard](https://dashboard.tryterra.co). It is gated: without it
   the API returns 403.
2. Copy `.env.example` to `.env` and fill `TERRA_DEV_ID` + `TERRA_API_KEY`.
   `npm run setup` checks what is set.
3. `npm run dev`, then **Add user** with the Terra user ID of an Apple Health
   user who has shared Health Records. The server backfills every record
   through the pull API; **Sync now** fetches only what arrived since.
4. **Webhooks (optional):** set `TERRA_WEBHOOK_SECRET`, expose port 8787
   (for example with ngrok) and point your Terra webhook destination at
   `https://<host>/api/webhook`. New and changed records then land on their
   own, and an `auth` success webhook registers the user and backfills them.

## What to look at

- **User dashboard** - a header naming the health systems once, then one
  section per clinical type with a single card of rows. Rows carry only what
  a clinician scans for; clicking one opens a drawer with every parsed field,
  the source health system, the FHIR resource type and release, and the raw
  FHIR. Open a record directly with `?record=<record_id>`.
- **Lab results and vitals** - value with a pretty-printed unit (`Cel` ->
  `°C`, `10*3/uL` -> `×10³/µL`), reference range, and a flag only when
  abnormal (or derived from the range when the health system sent none).
  Repeated tests collapse into one row with a trend, panels such as a CBC
  expand to their members, and blood pressure reads as systolic/diastolic.
- **Conditions, medications, allergies** - onset and clinical status;
  medication name and dosage across MedicationStatement, MedicationOrder
  (DSTU2), and MedicationRequest (R4); allergy substance, reaction, severity,
  and criticality.
- **Edge cases** - a record whose FHIR resource is unavailable
  (`fhir_resource_error: "fhir_resource_unavailable"`) renders from Terra's
  `display_name`, and unknown resource types or clinical types still show.

## How it's wired

- The browser never sees Terra credentials. The Hono server pages the pull
  API (`limit=100`) and stores each page plus its `next_cursor`, so an
  interrupted sync resumes where it stopped. Records received in the last
  60 seconds are held back by the API; the next sync picks them up.
- Backfills and webhooks share one upsert keyed on `record_id`. A row is only
  replaced by a receipt with an equal or later `received_at`, so redelivered
  or out-of-order webhooks are harmless.
- `src/server/lib/clinical/fhir.ts` turns each record into a summary on the
  server. It reads DSTU2 and R4 shapes structurally rather than trusting
  `fhir.release`, which can be null.

## Scripts

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | API on :8787 and the SPA on :5173                 |
| `npm run setup`     | Env check: which keys are set and the run mode    |
| `npm test`          | Unit tests (FHIR parsing, paging, webhooks)       |
| `npm run typecheck` | TypeScript project references                     |
| `npm run lint`      | ESLint                                            |
| `npm run build`     | Production SPA build; `npm run preview` serves it |

## Sample data

Everything in demo mode is synthetic and lives in
`src/server/demo-fixtures.ts`: fictional people, clinicians, and health
systems, shaped like Apple's DSTU2 sample records, with FHIR URLs on the
reserved `.example` domain. Never commit real patient data or a database
containing it (`data/` is gitignored for that reason).

## License

Apache-2.0.
