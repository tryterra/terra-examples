# AGENTS.md

Guidance for AI coding agents working with this repo and its CLI,
`create-tryterra-app`. The CLI is fully non-interactive and self-documenting:
run `npx --yes create-tryterra-app@latest --help` for the authoritative flag list.

> The leading `npx --yes` accepts npx's own "install this package?" prompt. The
> CLI's own `--yes` (or `--json`) then makes the scaffolder non-interactive.

## Discover examples

```bash
npx --yes create-tryterra-app@latest --list --json
```

Returns `{ "templates": [{ "name", "description" }] }`. Use a `name` as the
`--template` value below.

## Scaffold non-interactively

```bash
npx --yes create-tryterra-app@latest my-app --template unified-api-web-app --yes --json
```

- `--json` — machine-readable result on **stdout**, all progress on **stderr**.
  Trust stdout only when the exit code is `0`.
- `--yes` — never prompt (also implied by `--json`, a non-TTY pipe, or CI).
- `--force` — scaffold into a non-empty directory.
- `--skip-install` — skip the dependency install.
- `--no-git` — don't initialize git.
- `--package-manager <npm|pnpm|yarn|bun>` — override the auto-detected manager.
- `--setup` — run the example's setup wizard after install (see below).

### JSON result (stdout)

```json
{
  "ok": true,
  "directory": "my-app",
  "path": "/abs/path/to/my-app",
  "template": "unified-api-web-app",
  "packageManager": "npm",
  "install": true,
  "git": true,
  "setup": false,
  "nextSteps": ["cd my-app", "npm run setup", "npm run dev"]
}
```

### Exit codes

- `0` — success (stdout JSON is trustworthy)
- `1` — usage / input error (bad flag, unknown template, non-empty dir without `--force`)
- `2` — execution failure (install or setup command failed)

## Deploy an example (`unified-api-web-app`)

Each example ships a `setup` script (`npm run setup`) that provisions cloud
services, runs migrations, and deploys. It is **already non-interactive**: with
no TTY it reads credentials from `.env`/env vars and fails fast, listing any
missing required keys. Drive it like this:

1. `cd my-app`
2. Populate `.env` (see `.env.example`). For headless/CI, set:
   - `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID` if multi-account) — else `wrangler` opens a browser login.
   - `NEON_API_KEY` (and `NEON_ORG_ID` if multi-org) — else `neonctl` opens a browser login.
   - `TERRA_DEV_ID`, `TERRA_API_KEY`, `TERRA_WEBHOOK_SECRET` — from dashboard.tryterra.co.
   - Optional: `ANTHROPIC_API_KEY` (AI assistant), `SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL` (OTP email).
3. `npm run setup` — provisions Neon + R2, builds, migrates, deploys the Worker, prints the live URL.
4. Point Terra at `${WORKER_URL}/api/terra/webhook` in the Terra dashboard.

You can also let the CLI run setup right after scaffolding with `--setup`, but
`.env` must already hold the required credentials, or setup will fail fast.

Not every template has a setup script. `streaming-mobile-app` (Terra Grip) is a
React Native (Expo) mobile app with nothing to provision or deploy; building
and running it needs Xcode or Android Studio and, for real pairing, a physical
phone. Follow the scaffolded project's own README instead of the steps above.

## Example prompt (for humans directing an agent)

> Scaffold the Terra Basecamp example into `./my-terra-app` and get it running.
> Run
> `npx --yes create-tryterra-app@latest my-terra-app --template unified-api-web-app --yes --json`,
> parse the JSON result, then follow `AGENTS.md` to populate `.env` and run
> `npm run setup`. Ask me for any credentials you don't have.

## Repo conventions

- npm workspaces; the only package is `packages/cli`.
- Examples live as plain files under `packages/cli/templates/<name>` and are
  mirrored from their own source repos — **do not hand-edit them here** (see
  `CONTRIBUTING.md`). Changes to an example, including its `scripts/setup.ts`,
  belong in that example's source repo.
- Node.js 20+ is required.
