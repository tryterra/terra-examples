## Apple Health: permissions & release notes

Apple Health (like Samsung Health / Health Connect) **cannot connect through the web widget** - HealthKit data never leaves the phone except through an app, so it requires the Terra mobile SDK inside your own iOS app. What that app needs:

**Xcode capabilities**

- HealthKit → **HealthKit Background Delivery**
- Background Modes → **Background processing** and **Background fetch**

**Info.plist keys** (all four required)

| Key | Value |
|---|---|
| `NSHealthShareUsageDescription` (Privacy - Health Share Usage Description) | Why you read Health data (min. 3 words, be specific) |
| `NSHealthRecordsUsageDescription` (Privacy - Health Records Usage Description) | Same |
| `NSHealthUpdateUsageDescription` (Privacy - Health Update Usage Description) | Same |
| `BGTaskSchedulerPermittedIdentifiers` (Permitted background task scheduler) | `co.tryterra.data.post.request` |

**Permission / connection flow**

1. `Terra.instance(devId:, referenceId:, requestPermissions: true)` - the `referenceId` here is the same string this dashboard uses to join labs and wearables. Pass `requestPermissions: false` + call `terra.requestHealthKitPermissions()` later to defer the HealthKit popup to an explicit opt-in moment.
2. Server mints a single-use token: `POST /v2/auth/generateAuthToken` (with `dev-id` + `x-api-key`) - never ship the API key in the app.
3. `terra.initConnection(type: .APPLE_HEALTH, token:, customReadTypes: [], schedulerOn: true)`
4. `Terra.setUpBackgroundDelivery()` in `AppDelegate.didFinishLaunchingWithOptions` so data keeps syncing in the background.

**App Store release checklist** (Apple review guideline 5.1.3 - Health & Health Research)

- App ID / provisioning profile must include the HealthKit capability.
- A privacy policy URL is mandatory on the App Store listing, and the usage-description strings must say concretely what the data is used for - vague strings ("we use your health data") are a common rejection.
- Health data may not be used for advertising or data mining, and may not be written to iCloud.
- Declare Health & Fitness data in App Store Connect's privacy "nutrition label", including third-party sharing (Terra counts as a processor).
- Reviewers test on devices without Health data - make sure the app degrades gracefully when permissions are denied or empty.

## Architecture notes

- **Stack**: React 19 + Vite + TanStack Router/Query, react-aria atoms, Tailwind v4, Recharts; Hono on Node, SQLite (libSQL + Drizzle, auto-migrates on boot). Typed end-to-end via `hc<AppType>` - no codegen.
- **Terra client** (`src/server/lib/terra/client.ts`): raw fetch wrapper (`dev-id`/`x-api-key`), incl. multipart upload. The `terra-api` npm SDK doesn't cover lab reports.
- **Caching**: terminal lab sessions are immutable → cached in SQLite forever; wearable days are cached per (user, resource, day) with a 10-min TTL for today; presigned file URLs are never cached.
- **Upload polling**: one upload can fan out to N sessions and the `reference_id` list is eventually consistent - progress polls `GET /lab-reports?upload_id=` only.
- **Analysis** (`src/server/lib/analysis/`): pure and deterministic. `domains.ts` declares the inputs (biomarker keys + wearable metric bands) - it is also the single place to pin exact biomarker slugs against a real standardized session.
