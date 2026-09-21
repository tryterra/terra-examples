# End-to-End Type Safety

Types flow from the Terra SDK through to the React client with no manual type definitions at the boundaries.

## The chain

```
Terra SDK types → Drizzle column types → Hono c.json() → InferResponseType → client
```

1. **Terra SDK → Webhook handler**: The handler receives `Terra.WebhookEventType` from the SDK. Data enrichment fields are cast to the v6 override types (`TerraV6.Daily["data_enrichment"]`) for access to fields not yet in the SDK.

2. **Handler → Schema**: Each field is extracted into a typed Drizzle column — `real()` for scores, `integer()` for steps, `date()` for calendar dates. Contributor fields use `jsonb().$type<ScoreContributors>()` where `ScoreContributors` is defined in the override file to match the v6 proto (`map<string, float>` → `Record<string, number>`).

3. **Schema → API**: Hono route handlers access typed columns directly — `row.steps`, `row.totalStressScore`, etc. No JSONB digging or string key paths.

4. **API → Client**: The Hono RPC client (`hc<AppType>()`) infers response types from `c.json()`. The client uses `InferResponseType<typeof api.endpoint.$get, 200>` to derive types like `Activity` and `ScoreField` without duplicating them.

## SDK type extensions

The Terra SDK (`terra-api` npm package) aligns with v5 of the Terra API. Several fields from the v6 proto are not yet in the SDK:

- **Daily enrichment**: `resilience_score`, `strain_index`, `strain_traffic_light`, `total_stress_score_v2`, and their contributors
- **Sleep enrichment**: `readiness_score`, `sleep_score_v2`, `respiratory_score_v2`
- **Activity enrichment**: `efficiency_score`, `strain_score`, `rcrs_score`, `trimp_score`
- **Contributors**: The SDK types these as `DataContributor[]` (`{contributor_name, contributor_score}[]`) but the v6 proto uses `map<string, float>` (`Record<string, number>`)

These are corrected in `src/server/lib/terra/types-v6-override.ts`, which uses `Omit` to strip the stale base contributor types and redeclares them as `ScoreContributors`. The file re-exports the `Terra` namespace with augmented interfaces. When the SDK catches up, delete the override file and change imports back to `"terra-api"`.

## Key files

| Layer           | File                                        | Role                                             |
| --------------- | ------------------------------------------- | ------------------------------------------------ |
| Type extensions | `src/server/lib/terra/types-v6-override.ts` | Extends SDK types with v6 fields + correct types |
| Schema          | `db/schema.ts`                              | Typed columns for scores, biomarkers, dates      |
| Webhook handler | `src/server/lib/terra/webhook-handler.ts`   | Extracts typed fields from payloads              |
| API             | `src/server/routes/terra/dashboard.ts`      | Direct column access, typed responses            |
| Client types    | `src/client/lib/dashboard/types.ts`         | Derives types from Hono RPC                      |
| Client config   | `src/client/lib/dashboard/config.ts`        | Score display labels keyed by `ScoreField`       |
| Client logic    | `src/client/lib/dashboard/scores.ts`        | V2 variant deduplication                         |
