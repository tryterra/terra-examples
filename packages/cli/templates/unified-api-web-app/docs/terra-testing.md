# Terra Testing

Backend test suite for the Terra integration, using Vitest with mocked database and API layers.

## Running tests

```bash
npm run test          # single run
npm run test:watch    # watch mode
```

Tests live in `src/server/**/*.test.ts` and run in a Node environment (no Workers runtime needed).

## Test structure

| File                                  | What it covers                                                     |
| ------------------------------------- | ------------------------------------------------------------------ |
| `src/server/lib/terra.test.ts`        | Client factory: env var validation, correct client initialisation  |
| `src/server/lib/terra-events.test.ts` | Webhook event processor: all event types, data mapping, edge cases |
| `src/server/lib/terra-sync.test.ts`   | `parseScopes` utility, `syncTerraConnections` reconciliation logic |
| `src/server/routes/terra.test.ts`     | Route-level: webhook, auth, connections, sync, dashboard endpoints |
| `src/server/index.test.ts`            | Scheduled handler: cron-based sync across all users                |

## Mock strategy

All tests use unit-level mocks. No real database or Terra API calls.

**Database:** `src/server/lib/db.test-utils.ts` provides `createMockDb()`, which returns a mock Drizzle client with chainable query builders (`select → from → where → limit`, `insert → values → onConflictDoUpdate`, etc.). Each chain method is a `vi.fn()` that can be configured per test. Route tests use a simpler flat `mockDb` object for the same purpose.

**Terra API:** Module-level `vi.mock("terra-api")` stubs the SDK. `verifyTerraWebhookSignature`, `TerraClient`, and individual client methods are all `vi.fn()` mocks.

**Auth middleware:** `requireAuth` is mocked to inject a static user (`{ id: "user-abc" }`) without hitting BetterAuth.

**Execution context:** `waitUntil` is mocked to eagerly await the promise, so async webhook processing runs synchronously within the test.

## Key coverage areas

### Webhook processing (`terra-events.test.ts`)

- **Data events**: Activity, sleep, body, daily, nutrition, menstruation. Verifies correct table targeting, field mapping (Date conversion, `activityType` with `type=0` edge case), multi-item batch upserts, sleep `summary_id` filtering, `lastWebhookAt` updates
- **Auth events**: `auth` (UUID validation, user lookup, connection upsert), `deauth`/`access_revoked` (status revoked), `user_reauth` (ID swap), `connection_error` (status error), `permission_change` (scope update)
- **Informational events**: `healthcheck`, `processing`, `rate_limit_hit`, etc. Logged and marked processed
- **Edge cases**: Empty data arrays, missing `user_id`, unknown Terra user, unknown event types

### Routes (`terra.test.ts`)

- **Webhook endpoint**: Signature validation (missing, invalid), JSON parsing, deduplication via `terra-reference`, R2 archival, async error handling (`markEvent("failed")` on processing errors)
- **Auth endpoint**: Valid request returns auth URL, redirect URLs passed through, missing fields rejected
- **Connections**: List (populated and empty), sync (success and upstream failure), delete (success, not found, invalid UUID, deauth failure with status rollback)
- **Dashboard**: No active connections (`connected: false`), data present across multiple connections, empty data tables with active connections

### Sync (`terra-sync.test.ts`)

- `parseScopes`: null/empty/whitespace inputs, single and multiple scopes, whitespace trimming
- `syncTerraConnections`: Active and inactive users, empty API responses, missing `users` key, stale connection revocation, API error propagation

### Scheduled handler (`index.test.ts`)

- Iterates over all users with active connections
- Continues syncing when individual users fail
- Handles empty user list

> Key file: `vitest.config.ts` (test configuration, path aliases)
