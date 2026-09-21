# Terra Auth & Reconciliation

How users connect health providers, how connection state is managed, and how we stay in sync with Terra's API.

## Auth flow

1. User clicks a provider on the connectors page
2. Frontend calls `POST /api/terra/auth` with the provider name and redirect URLs
3. Backend calls `client.authentication.authenticateuser()` with `reference_id` set to the app user's UUID
4. Terra returns an OAuth URL, frontend opens it in a new tab
5. User completes provider auth
6. Terra redirects back to the app with `?auth=success&user_id=...&resource=...`
7. The page fires a sync to pick up the new connection (see Reconciliation below)
8. In parallel, Terra sends an `auth` webhook that upserts the connection with full details

The `reference_id` is the link between our user and Terra's user record. It's passed during auth and returned in webhooks.

> Key files: `src/server/routes/terra.ts` (auth endpoint), `src/client/hooks/useTerraMutations.ts` (`useTerraAuthenticate`)

## Auth webhook types

All auth events update the `terraConnection` table, keyed on the `terraUserId` unique constraint.

| Event               | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `auth`              | Upserts a connection with status `"active"`, sets provider and scopes |
| `deauth`            | Marks connection as `"revoked"`                                       |
| `access_revoked`    | Same as `deauth` (provider revoked access)                            |
| `user_reauth`       | Swaps `terraUserId` from old to new (Terra replaces the ID on reauth) |
| `connection_error`  | Marks connection as `"error"`                                         |
| `permission_change` | Updates the scopes field                                              |

> Key file: `src/server/lib/terra-events.ts` (auth handlers)

## Scopes

Terra sends scopes as a comma-separated string (e.g. `"fitness.activity.read,fitness.sleep.read"`). We parse this into a `string[]` via `parseScopes()` and store it as JSONB on `terraConnection.scopes`.

Scopes are set on `auth` events and updated on `permission_change` events.

> Key file: `src/server/lib/terra-sync.ts` (`parseScopes`)

## Reconciliation

Webhooks are the primary real-time channel, but they can be missed (network issues, dev environment without tunnelling, provider-side delivery failures). Reconciliation ensures our DB matches Terra's actual state.

### How it works

`syncTerraConnections()` does the following:

1. Calls `client.user.getinfoforuserid({ reference_id: userId })` to get verified connection data from Terra
2. For each Terra user returned: upserts into `terraConnection` (active or revoked based on Terra's `active` flag)
3. Any connections in our DB that Terra doesn't know about are marked `"revoked"`

All writes use `onConflictDoUpdate` on `terraUserId`. Running sync any number of times produces the same DB state. The webhook's `handleAuthEvent` and the sync function converge to the same state regardless of execution order.

### When it triggers

| Trigger              | Where                                    | Purpose                                                |
| -------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Page mount           | Connectors page, onboarding connect page | Catch-up on any missed events since last visit         |
| Auth redirect        | `?auth=success` detected in URL          | Immediate sync after provider OAuth completes          |
| Cron (every 6 hours) | Cloudflare Worker scheduled handler      | Background sweep for all users with active connections |

### Cron setup

The cron trigger is defined in `wrangler.jsonc`:

```jsonc
"triggers": { "crons": ["0 */6 * * *"] }
```

The worker's `scheduled` handler queries all distinct user IDs with active connections and syncs each one. Failures for individual users are caught and logged without affecting others.

> Key files: `src/server/lib/terra-sync.ts`, `src/server/index.ts` (scheduled handler), `wrangler.jsonc`

## Two Terra clients

| Client                         | Auth                   | Use case                                                              |
| ------------------------------ | ---------------------- | --------------------------------------------------------------------- |
| `createTerraClient(env)`       | `dev-id` + `x-api-key` | Authenticated calls: auth URL generation, deauth, user info, sync     |
| `createTerraPublicClient(env)` | `dev-id` only          | Public catalogue: fetching available integrations (no API key needed) |

The `detailedfetch` integrations endpoint returns dev-scoped results (only enabled providers) when `dev-id` is passed without an API key. With both headers, it returns empty.

> Key file: `src/server/lib/terra.ts`
