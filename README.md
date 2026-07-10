<p align="center">
  <a href="https://tryterra.co">
    <img src="./assets/terra-icon.svg" height="96">
  </a>
  <h3 align="center">Terra Examples</h3>
</p>

Examples built by [Terra API](https://tryterra.co). One command to pull a full working app, deploy it to your own infrastructure, and build on top of it.

```bash
npm create tryterra-app
```

## Examples

| Example                           | Description                                                | Stack                                    |
| --------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| [Terra Basecamp](#terra-basecamp) | Wearable & health data on a dashboard with an AI assistant | React · Hono · Cloudflare Workers · Neon |

_More examples coming. Each is a standalone, runnable project with its own README._

### Terra Basecamp

`unified-api-web-app` — [browse the template »](./packages/cli/templates/unified-api-web-app)

An example web app built on Terra's [Unified API](https://tryterra.co/products/api). It
connects users' wearables and health data sources (Garmin, Fitbit, Oura, and more) and
displays them on a health dashboard with an AI health assistant.

**Demonstrates:** device connection, webhook ingestion, multi-provider deduplication,
scheduled sync, a unified health dashboard, an LLM assistant via Terra MCP tools,
one-command setup, and single-worker deployment.

**Stack:** React 19 · Hono on Cloudflare Workers · Neon Postgres (Drizzle) · BetterAuth · LLM on Durable Objects (Vercel AI SDK)

```bash
npm create tryterra-app -- --template unified-api-web-app
```

## Getting started

Run the command above, pick an example, and name a directory when prompted. Then:

```bash
cd my-app
npm run setup   # provision infra and configure (guided, where supported)
npm run dev     # start the dev server
```

Use any package manager — `npm`, `pnpm create tryterra-app`, `yarn create tryterra-app`,
or `bun create tryterra-app`. The CLI installs dependencies with whichever you invoke.

## Using with AI coding agents

The CLI is fully non-interactive and self-documenting, so a coding agent can drive
it end to end. Discover examples, then scaffold with machine-readable output:

```bash
# List examples as JSON
npx --yes create-tryterra-app@latest --list --json

# Scaffold non-interactively: JSON result on stdout, logs on stderr
npx --yes create-tryterra-app@latest my-app --template unified-api-web-app --yes --json
```

`--yes` skips every prompt, `--json` keeps stdout a clean JSON channel, and exit
codes (`0` ok · `1` usage · `2` execution) tell the agent what happened. The
leading `npx --yes` accepts npx's own install prompt. See [AGENTS.md](./AGENTS.md)
for the full workflow, JSON shape, and deploy steps.

**Example prompt to give an agent:**

> Scaffold the Terra Basecamp example into `./my-terra-app` and get it running.
> Run `npx --yes create-tryterra-app@latest my-terra-app --template unified-api-web-app --yes --json`,
> parse the JSON result, then follow `AGENTS.md` to populate `.env` and run `npm run setup`.

Full CLI options live in [packages/cli](./packages/cli/README.md). Requires Node.js 20+.

## Contributing

Each example is mirrored from its own source repo. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for how examples are added and kept in sync.

## Useful links

- [Terra docs](https://docs.tryterra.co)
- [Terra dashboard](https://dashboard.tryterra.co)
