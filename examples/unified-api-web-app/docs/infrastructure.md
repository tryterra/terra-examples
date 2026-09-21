# Infrastructure

Infrastructure is provisioned by the setup scripts using the **Neon** and
**Cloudflare (wrangler)** CLIs — there is no Terraform. `npm run setup` signs you
in, creates the database, and deploys the Worker in one pass.

## Authentication

Both providers use a browser OAuth login, with an env-var fallback for headless/CI:

| Provider   | Interactive      | Headless fallback (in `.env`)    |
| ---------- | ---------------- | -------------------------------- |
| Cloudflare | `wrangler login` | `CLOUDFLARE_API_TOKEN`           |
| Neon       | `neonctl auth`   | `NEON_API_KEY` (+ `NEON_ORG_ID`) |

See `scripts/lib/auth.ts`.

## Non-interactive & machine-readable output

Every script (`setup`, `deploy`, `setup:reset`, `db:migrate:prod`) is flag-driven
and self-documenting — run `-- --help` for the flags. `--yes` forces
non-interactive mode (also implied by `--json`, a non-TTY pipe, or CI); `--json`
emits one result object on stdout with all logs on stderr. Exit codes are `0`
success, `1` usage/missing credentials, `2` execution failure. The shared
plumbing lives in `scripts/lib/output.ts` (reporter + exit codes) and
`scripts/lib/args.ts` (flag parsing). See [AGENTS.md](../AGENTS.md) for the agent
workflow and JSON shapes.

## Resources

### Neon Postgres (`scripts/lib/neon.ts`)

- **Project** (named after `APP_NAME`, default `terra-basecamp`) – created in `aws-us-east-1` (override with `NEON_REGION`),
  autoscaling 0.25–1 CU. Its default branch is the production database.
- **`dev` branch** – used by `npm run dev`.

Provisioning is idempotent (find-or-create). The project id is saved to `.env` as
`NEON_PROJECT_ID`; connection strings are read on demand via `neonctl connection-string`.

### Cloudflare (`wrangler.jsonc`)

Everything Cloudflare-side is declared in `wrangler.jsonc` and applied by
`wrangler deploy`:

- **Worker** (named after `APP_NAME`, stored as `name` in `wrangler.jsonc`) on the `*.workers.dev` subdomain, with the SPA assets and
  `/api/*` worker-first routing.
- **`ChatAgent` Durable Object** + its SQLite migration.
- **R2 bucket `terra-webhooks`** – raw Terra webhook payloads (created by setup via
  `wrangler r2 bucket create`).
- **Cron trigger** `0 */6 * * *` – Terra data reconciliation.
- **Observability** – logs + invocation logs enabled.
- **`LOADER` binding** – sandboxed Worker execution for the `analyze` tool (codemode).

Secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`, Terra, SendGrid, Anthropic) are pushed
separately via `wrangler secret bulk`.

## Secrets flow

```
.env (Terra + optional keys, from the setup wizard)
neonctl  → DATABASE_URL (dev → .env, prod → worker secret)
wrangler → wrangler secret bulk → Worker (production)
Vite     → .dev.vars (local dev, from .env)
```

## CI

`.github/workflows/ci.yml` runs on every push to `main` and on PRs: it type-checks and
runs the test suite (`npm run typecheck`, `npm test`) — no secrets required. Deployment
is not automated; deploy from your machine with `npm run deploy`.

## Idempotency

- `npm run setup` is safe to re-run: the Neon project/branch are found-or-created, and
  `wrangler deploy` only ships what changed.
- `npm run setup:reset` fully tears down the Neon project, Worker, and R2 bucket.
