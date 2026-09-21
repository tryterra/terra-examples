# AGENTS.md

Guidance for AI coding agents working on **Terra Basecamp** — a React + Hono app
on Cloudflare Workers with Neon Postgres. The provisioning/deploy scripts are
non-interactive and self-documenting: run any with `--help` for the exact flags.

```bash
npm run setup   -- --help
npm run deploy  -- --help
```

## Install the Terra skills first

```bash
npx skills add tryterra/agent-skills
```

These give you Terra-specific context (Unified API, webhooks, auth) while you work.

## Provision + deploy non-interactively

Setup provisions Neon + Cloudflare, runs migrations, and deploys the Worker. It
reads everything from the environment / `.env` and never prompts when run with
`--yes` (or `--json`, or in CI). Populate credentials, then:

```bash
npm run setup -- --yes --json
```

- `--json` — one result object on **stdout**, all logs on **stderr**. Trust
  stdout only when the exit code is `0`.
- `--yes` — non-interactive (also implied by `--json` / non-TTY / CI).
- `--app-name <name>` — name the Worker + Neon project (or set `APP_NAME`).
- `--ai` — enable the AI assistant. **Off by default**: it needs
  `ANTHROPIC_API_KEY` _and_ the Cloudflare Workers Paid plan ($5/mo). Don't pass
  it unless the user asked for AI.
- `--free-plan` — if the deploy hits the paid-plan wall, drop AI and redeploy on
  the free plan instead of failing (or set `SETUP_FREE_PLAN=1`).

### Required environment

Set these in `.env` (see `.env.example`) or the environment before setup:

| Variable                                                            | Needed for                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN` (+ `CLOUDFLARE_ACCOUNT_ID` if multi-account) | Headless Cloudflare — else setup opens a browser login |
| `NEON_API_KEY` (+ `NEON_ORG_ID` if multi-org)                       | Headless Neon — else setup opens a browser login       |
| `TERRA_DEV_ID`, `TERRA_API_KEY`, `TERRA_WEBHOOK_SECRET`             | Required — from dashboard.tryterra.co                  |
| `ANTHROPIC_API_KEY`                                                 | Only if enabling AI (`--ai`)                           |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`                           | Optional — OTP email (else codes log to console)       |

### JSON result shapes (stdout)

```jsonc
// npm run setup -- --json  (no connection strings — the DB URL lives in .env)
{ "ok": true, "appName": "my-app", "workerUrl": "https://…workers.dev",
  "webhookUrl": "https://…/api/terra/webhook", "neonProjectId": "…",
  "neonOrgId": "…", "ai": false }

// npm run deploy -- --json
{ "ok": true, "workerUrl": "https://…workers.dev" }

// npm run setup:reset -- --dry-run --json
{ "ok": true, "dryRun": true, "deleted": { "neonProject": "…", "worker": "my-app", "r2Bucket": "terra-webhooks" } }
```

### Exit codes (every script)

- `0` — success (stdout JSON is trustworthy)
- `1` — usage / missing credentials (bad flag, absent required env, refused reset)
- `2` — execution failure (build / migrate / deploy / secrets)

## Final manual step: point Terra at the webhook

Setup can't do this for you. After a successful deploy, set the destination
(webhook) URL at <https://dashboard.tryterra.co/dashboard/connections> to the
`webhookUrl` from the result. Until then, Terra can't deliver data to the app.

## Redeploy, migrate, tear down

```bash
npm run deploy -- --json            # rebuild + migrate prod + deploy
npm run db:migrate:prod -- --json   # migrations only
npm run setup:reset -- --dry-run    # preview teardown (deletes nothing)
npm run setup:reset -- --yes        # tear down Neon project, Worker, R2 bucket
```

## Example prompt (for humans directing an agent)

> Provision and deploy Terra Basecamp. First `npx skills add tryterra/agent-skills`.
> Put my Cloudflare, Neon, and Terra credentials in `.env` (ask me for any you
> don't have), then run `npm run setup -- --yes --json`, parse the JSON result,
> and give me the `webhookUrl` so I can set it in the Terra dashboard. Leave the
> AI assistant off.

## Repo conventions

- TypeScript ESM (`"type": "module"`); scripts run via `tsx`, extensionless
  local imports.
- Keep it strictly typed, simple, and idiomatic; single-line JSDoc.
- Node.js 20+.
- `npm run typecheck` and `npm test` must pass before a PR.
- This repo mirrors to `tryterra/terra-examples` on **Release** — don't edit the
  mirror there; edit here and cut a release.
