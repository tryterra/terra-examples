# Terra Basecamp

An example web app built using [Terra's Unified API](https://tryterra.co/products/api). It connects users' wearables and health data sources (Garmin, Fitbit, Oura, and more), and displays it on a health dashboard with an AI health assistant.

The stack is a React frontend and a Hono API running together on a single Cloudflare Worker, with Neon Postgres for storage and an LLM-powered assistant on Durable Objects. Setup provisions everything through the Cloudflare and Neon CLIs and deploys as one worker.

## What It Demonstrates

- **Terra device connection**: user authentication, device pairing, and connection management
- **Webhook ingestion**: receives Terra webhooks, stores raw payloads in R2, and processes them into the database
- **Multi-provider deduplication**: merges overlapping data from multiple devices by provider priority
- **Scheduled sync**: cron job reconciles connections every 6 hours, catching data missed by webhooks
- **Health dashboard**: unified daily view of steps, heart rate, HRV, sleep, and stress across all devices
- **AI health assistant**: LLM-powered chat with access to user health data via Terra MCP tools
- **One-command setup**: `npm run setup` signs in, provisions the database + Worker, runs migrations, and deploys the app
- **End-to-end type safety**: Hono RPC types flow from server to client with no codegen
- **Single-worker deployment**: one Cloudflare Worker serves the API, frontend, Durable Objects, and cron jobs

## Tech Stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | React 19, Vite 7, TanStack Router, TanStack Query, TanStack Store |
| UI           | React Aria Components, Tailwind CSS v4, tailwind-variants         |
| Backend      | Hono on Cloudflare Workers                                        |
| Database     | Neon Postgres, Drizzle ORM                                        |
| Auth         | BetterAuth (email OTP)                                            |
| AI           | LLM on Cloudflare Durable Objects (via Vercel AI SDK)             |
| Provisioning | wrangler + neonctl (Cloudflare & Neon CLIs)                       |

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Neon](https://neon.tech/) account — setup signs you in via your browser (`neonctl auth`)
- [Cloudflare](https://cloudflare.com/) account with [R2 enabled](https://dash.cloudflare.com/) (free) — setup signs you in via your browser (`wrangler login`)
- [Terra](https://dashboard.tryterra.co/) developer account: developer ID, API key, and webhook signing secret
- _(Optional)_ [Anthropic](https://console.anthropic.com/) API key — enables the AI assistant (chat + analysis). The assistant also needs the Cloudflare [Workers Paid plan](https://developers.cloudflare.com/workers/platform/pricing/); without it, the assistant is off and the app runs on the free plan
- _(Optional)_ [SendGrid](https://sendgrid.com/) account with an [API key](https://app.sendgrid.com/settings/api_keys) (Mail Send) and a [verified sender](https://app.sendgrid.com/settings/sender_auth): without it, OTP codes are logged to the console

## Quick Start

```bash
npm install
npm run setup   # interactive wizard: prompts for credentials, provisions everything
npm run dev
```

Setup asks what to name your app, signs you in to Cloudflare and Neon (browser OAuth — pick an account if you have more than one), prompts for your Terra credentials (saving them to `.env`), provisions the Neon database and Cloudflare Worker, runs migrations, and deploys the app. The AI assistant is optional (enabling it needs an Anthropic key + Workers Paid plan); SendGrid is optional too. Re-running `npm run setup` is idempotent, so it only asks for what's missing.

### Non-interactive / AI agents

Every script is flag-driven and self-documenting (`npm run setup -- --help`). To run without prompts, set the headless credentials in `.env` (`CLOUDFLARE_API_TOKEN` / `NEON_API_KEY`, plus your Terra keys — see `.env.example`), then:

```bash
npm run setup -- --yes --json    # provision + deploy, machine-readable result
npm run deploy -- --json         # redeploy
```

`--yes` never prompts (also implied by `--json`, a non-TTY pipe, or CI); `--json` prints one result object to stdout and sends all logs to stderr. The AI assistant is **off by default** — enable it explicitly with `--ai` (needs `ANTHROPIC_API_KEY` + the Workers Paid plan), or pass `--free-plan` to drop it automatically if the account isn't on the paid plan. Exit codes: `0` success, `1` usage/missing credentials, `2` execution failure. See [AGENTS.md](AGENTS.md) for the full agent workflow and JSON shapes.

## Development

```bash
npm run dev             # Start local dev server (uses dev DB branch)
npm run db:generate     # Generate Drizzle migration from schema changes
npm run db:migrate:dev  # Apply migrations to dev DB branch
npm run db:studio       # Open Drizzle Studio (web DB explorer)
```

## Deployment

Deploy from your machine:

```bash
npm run deploy
```

### How deployment works

`npm run deploy` reads the production connection string from Neon (`neonctl`), builds the app, applies migrations to the production branch, deploys the Worker with `wrangler deploy`, and pushes secrets with `wrangler secret bulk`. All Cloudflare settings — bindings, R2, cron trigger, observability — live in `wrangler.jsonc`.

## Project Structure

```
src/
  client/                 # React frontend
    routes/               # TanStack Router file-based routes
    lib/
      metrics/            # Unified health metric config, types, helpers
      dashboard/          # Dashboard-specific config (score display)
    components/
      shared/atoms/       # Design system primitives (Button, Select, ToggleButton, etc.)
      shared/molecules/   # Composed components (Navbar, Sidebar, DateNavigator)
      pages/              # Page-specific components (dashboard/, trends/, connectors/)
    hooks/                # TanStack Query hooks
  server/                 # Hono API (Cloudflare Worker)
    routes/terra/         # Terra API routes (dashboard, trends, webhooks, auth)
    middleware/           # Auth middleware
    lib/terra/            # Webhook handler, provider priority, backfill
db/
  auth-schema.ts          # BetterAuth tables (generated by `npm run db:auth-schema`)
  schema.ts               # App schema (re-exports auth schema)
  migrations/             # Drizzle SQL migrations
scripts/                  # setup / deploy / reset (wrangler + neonctl)
```

## Database

The app uses two Neon database branches:

| Branch         | Purpose           | Used by                                 |
| -------------- | ----------------- | --------------------------------------- |
| `dev`          | Local development | `npm run dev`, `npm run db:migrate:dev` |
| default branch | Production        | `npm run deploy`                        |

### Schema changes

```bash
# 1. Edit db/schema.ts (or regenerate auth schema)
npm run db:auth-schema   # Only if changing BetterAuth config

# 2. Generate and apply migration
npm run db:generate
npm run db:migrate:dev   # Dev branch
npm run db:migrate:prod  # Prod branch (or let deploy handle it)
```

## Scripts

| Script                    | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `npm run setup`           | Sign in, provision DB + Worker, run migrations, deploy |
| `npm run setup:reset`     | Tear down the Neon project, Worker, and R2 bucket      |
| `npm run dev`             | Local dev server                                       |
| `npm run deploy`          | Build + migrate + deploy to prod                       |
| `npm run build`           | Production build (Vite)                                |
| `npm run typecheck`       | TypeScript type checking                               |
| `npm run db:generate`     | Generate Drizzle migration                             |
| `npm run db:migrate:dev`  | Apply migrations to dev branch                         |
| `npm run db:migrate:prod` | Apply migrations to prod branch                        |
| `npm run db:auth-schema`  | Regenerate BetterAuth schema                           |
| `npm run db:studio`       | Drizzle Studio                                         |
| `npm run format`          | Format code with Prettier                              |
| `npm run format:check`    | Check code formatting                                  |

## Documentation

See [docs/](docs/) for architecture and integration details.

## Environment Variables

Everything lives in a single gitignored `.env` file, created and maintained by `npm run setup`, so you never need to edit it by hand.

Cloudflare and Neon are authenticated by browser sign-in during setup, so no keys are stored for them by default. Set the headless credentials below only for CI/automation.

| Variable                | Required | Source                                        | Description                                                                          |
| ----------------------- | -------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `TERRA_DEV_ID`          | Yes      | dashboard.tryterra.co → API Keys              | Terra developer ID                                                                   |
| `TERRA_API_KEY`         | Yes      | dashboard.tryterra.co → API Keys              | Terra API key                                                                        |
| `TERRA_WEBHOOK_SECRET`  | Yes      | dashboard.tryterra.co → Connections → Webhook | Terra webhook signing secret                                                         |
| `ANTHROPIC_API_KEY`     | No       | console.anthropic.com → API Keys              | Used by the AI assistant when enabled with `--ai` (also needs the Workers Paid plan) |
| `SENDGRID_API_KEY`      | No       | app.sendgrid.com/settings/api_keys            | SendGrid API key (OTP codes log to console if absent)                                |
| `SENDGRID_FROM_EMAIL`   | No       | SendGrid verified sender                      | Verified sender email                                                                |
| `BETTER_AUTH_SECRET`    | Auto     | Generated by `npm run setup`                  | Session signing key                                                                  |
| `DATABASE_URL`          | Auto     | Written by `npm run setup`                    | Neon Postgres connection string (dev branch, used by `npm run dev`)                  |
| `APP_NAME`              | Auto     | Chosen during `npm run setup`                 | Names the Worker + Neon project (also synced to `wrangler.jsonc`)                    |
| `NEON_PROJECT_ID`       | Auto     | Written by `npm run setup`                    | Neon project id (used by deploy + prod migrations)                                   |
| `CLOUDFLARE_ACCOUNT_ID` | Auto/CI  | Chosen during setup, or dashboard → Overview  | Set when you pick an account; set manually for headless CI                           |
| `SETUP_SKIP_*`          | Auto     | Set when you skip an optional integration     | Delete the line (or set `false`) to be offered that integration again                |
| `CLOUDFLARE_API_TOKEN`  | CI only  | dash.cloudflare.com/profile/api-tokens        | Skips `wrangler login` when running headless                                         |
| `NEON_API_KEY`          | CI only  | console.neon.tech → API Keys                  | Skips `neonctl auth` when running headless                                           |

The production `DATABASE_URL` (default branch) is not stored in any file; it's read from `neonctl connection-string` at deploy time and passed to migrations and wrangler secrets automatically.
