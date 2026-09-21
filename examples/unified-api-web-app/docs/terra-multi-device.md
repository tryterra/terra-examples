# Multi-Device Data Merging

The dashboard merges health data across all connected devices (e.g. Google Fit + Ultrahuman) using a **provider priority system** — each data category has an explicit ranking so the best source is chosen automatically, with fill-in from lower-priority providers for missing metrics.

## Provider priority

Priority config lives in `src/server/lib/terra/provider-priority.ts`.

### How resolution works

1. For a given data category (e.g. `sleep`), check the **category override list** first
2. If the provider isn't in the override, fall back to the **default list**
3. Override entries always outrank default-only entries for that category
4. Providers not in any list get lowest priority
5. Among equal-priority providers, the most recent data wins (DB ordering)

### Default priority order

Dedicated health wearables > multi-sport watches > phone/platform sources:

```
OURA → WHOOP → GARMIN → FITBIT → APPLE → POLAR → COROS → SUUNTO →
SAMSUNG → HEALTH_CONNECT → WITHINGS → ULTRAHUMAN → BIOSTRAP → HUAWEI →
GOOGLEFIT → GOOGLE → ZEPP → WAHOO → SOMNOFY → AKTIIA → STRAVA →
PELOTON → CONCEPT2 → ZWIFT → TRAININGPEAKS → MYFITNESSPAL → CRONOMETER
```

### Per-category overrides

| Category         | Top providers (in order)                                     | Rationale                                                |
| ---------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| **sleep**        | OURA, WHOOP, GARMIN, FITBIT, APPLE, POLAR, SOMNOFY           | Ring/band sensors excel at overnight temperature + HRV   |
| **activity**     | GARMIN, SUUNTO, POLAR, COROS, APPLE, WAHOO, STRAVA           | GPS sport watches have best workout/route data           |
| **daily**        | GARMIN, WHOOP, OURA, FITBIT, APPLE, POLAR, COROS             | 24/7 wrist monitors best for steps/HR/HRV                |
| **body**         | WITHINGS, OMRON, OMRONUS, INBODY, BODITRAX, GARMIN           | Smart scales and BP monitors are purpose-built           |
| **nutrition**    | MYFITNESSPAL, CRONOMETER, FATSECRET, NUTRACHECK, MACROSFIRST | Only food-logging apps produce meaningful nutrition data |
| **menstruation** | FLO, CLUE, APPLE, FITBIT, OURA, SAMSUNG                      | Dedicated cycle apps have best algorithms                |

## How each section uses priority

### Scores

Scores come from Terra's `data_enrichment` field, which is provider-agnostic (computed by Terra server-side for all providers). When multiple devices are connected, scores auto-select the highest-priority provider for the `daily` category. A `Select` dropdown lets the user override manually.

- API accepts `?scoreConnectionId=<uuid>` and `?date=YYYY-MM-DD` to filter
- When omitted, auto-selects based on provider priority and defaults to today
- The picker only renders when 2+ active connections exist

### Biomarkers

Biomarkers use a **priority + fill-in** strategy: daily records are sorted by provider priority for the `daily` category, then iterated — the first non-null value wins for each metric (steps, RHR, HRV, VO2 max, active hours). Sleep duration uses the `sleep` category priority.

If the highest-priority provider lacks a metric, it falls through to the next provider that has it.

Each biomarker includes a `provider` field so the UI can show its source.

### Activities

Activities and sleep records from all connections are merged into a single timeline sorted by start time.

**Deduplication**: if two records have the same `type` + `activityType` and >80% time overlap, the one from the higher-priority provider is kept (using `activity` or `sleep` category as appropriate).

Each activity includes a `provider` field for source attribution.

## Source attribution

Provider labels only appear in the UI when the user has 2+ active connections. Provider codes (e.g. `GOOGLE_FIT`) are resolved to display names via the Terra integrations endpoint.

## Key files

| Layer  | File                                                   |
| ------ | ------------------------------------------------------ |
| Config | `src/server/lib/terra/provider-priority.ts`            |
| API    | `src/server/routes/terra/dashboard.ts`                 |
| Query  | `src/client/hooks/useTerraQueries.ts`                  |
| Page   | `src/client/routes/_authenticated/dashboard/route.tsx` |
| UI     | `src/client/components/pages/dashboard/`               |
