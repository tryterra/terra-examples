# Database Design

Neon Postgres via Drizzle ORM. Schema defined in `db/schema.ts`.

## Design principles

- **Natural keys over surrogates**: Data tables use Terra's natural identifiers as primary keys (no UUID `id` columns). Only `terra_connection` and `terra_webhook_event` have surrogate UUIDs — they serve as internal FK anchors and event tracking respectively.
- **Columns over JSONB**: Displayed metrics (scores, biomarkers) are extracted into typed columns during webhook processing. Raw payloads are archived in R2, linked via `payload_key`. No JSONB blobs for health data — avoids the overwrite problem where a full-blob upsert would erase enrichment scores with nulls.
- **Date over timestamp for daily data**: Per [Terra docs](https://docs.tryterra.co/health-and-fitness-api/managing-user-health-data/receiving-data-updates), daily/body/nutrition/menstruation data should be keyed by date only ("only consider the date part of the field, and ignore the time"). This avoids timezone conversion issues.

## Table overview

### Core

| Table                 | PK                  | Purpose                             |
| --------------------- | ------------------- | ----------------------------------- |
| `user`                | `id` (uuid)         | BetterAuth user accounts            |
| `user_info`           | `user_id` (uuid FK) | Onboarding profile data             |
| `terra_connection`    | `id` (uuid)         | User ↔ Terra provider link          |
| `terra_webhook_event` | `id` (uuid)         | Webhook event log + dedup + R2 link |

### Summary-keyed (activity/sleep)

| Table            | PK           | Key fields                                                   |
| ---------------- | ------------ | ------------------------------------------------------------ |
| `terra_activity` | `summary_id` | `start_time`, `end_time`, `activity_type`, `distance_meters` |
| `terra_sleep`    | `summary_id` | `start_time`, `end_time`, sleep score columns                |

Keyed by `metadata.summary_id` from Terra. Store actual timestamps for time-range display.

### Date-keyed (daily/body/nutrition/menstruation)

| Table                | PK                            | Key fields                |
| -------------------- | ----------------------------- | ------------------------- |
| `terra_daily`        | `(terra_connection_id, date)` | Biomarker + score columns |
| `terra_body`         | `(terra_connection_id, date)` | `payload_key` only        |
| `terra_nutrition`    | `(terra_connection_id, date)` | `payload_key` only        |
| `terra_menstruation` | `(terra_connection_id, date)` | `payload_key` only        |

Keyed by connection + calendar date. One row per device per day. The `date` column is Postgres `date` type, extracted from `metadata.start_time` by slicing the ISO string before timezone conversion.

## terra_daily column layout

```
Biomarkers (standard overwrite):
  steps, resting_hr_bpm, avg_hrv_sdnn, vo2max,
  active_seconds, total_burned_calories

Scores (COALESCE upsert — nulls never overwrite):
  total_stress_score, total_stress_score_v2,
  strain_index, strain_traffic_light,
  resilience_score, cardiovascular_score,
  immune_index, respiratory_score,
  stress_contributors (jsonb), strain_contributors (jsonb)
```

The two upsert strategies reflect different Terra guarantees:

- **Biomarkers**: "the received data will always be a superset of any previous data received" → safe to overwrite
- **Scores**: `data_enrichment` values can arrive as null in webhooks that previously had values → COALESCE protects against regression

## R2 linkage

Every data row has a `payload_key` column containing the R2 object key (e.g. `webhooks/2026/05/01/{eventId}.json`). This links the extracted column data back to the full raw Terra payload for detail views or debugging. The payload key is set on each upsert to always point to the most recent webhook delivery.

## Migrations

Managed by Drizzle Kit. Migration files in `db/migrations/`. Generated with `npm run db:generate`, applied with `npm run db:migrate` (production) or `npm run db:migrate:dev` (dev).

> Key files: `db/schema.ts`, `drizzle.config.ts`
