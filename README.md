<p align="center">
  <a href="https://tryterra.co">
    <img src="./assets/terra-icon.svg" height="96">
  </a>
  <h3 align="center">Terra Examples</h3>
</p>

Examples built by [Terra API](https://tryterra.co). One command to pull a full working app, deploy it to your own infrastructure, and build on top of it.

```bash
npm create tryterra-app@latest
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
npm create tryterra-app@latest -- --template unified-api-web-app
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

## Non-interactive

Pass a directory and an example to skip the prompts:

```bash
npx create-tryterra-app@latest my-app --template unified-api-web-app
```

Full CLI options live in [packages/cli](./packages/cli/README.md). Requires Node.js 20+.

## Contributing

Each example is mirrored from its own source repo. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for how examples are added and kept in sync.

## Useful links

- [Terra docs](https://docs.tryterra.co)
- [Terra dashboard](https://dashboard.tryterra.co)
