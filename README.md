<p align="center">
  <a href="https://tryterra.co">
    <img src="./assets/terra-icon.svg" height="96">
  </a>
  <h3 align="center">Terra Examples</h3>
</p>

Runnable apps built with [Terra API](https://tryterra.co). Pick an example,
download it with the Terra CLI, and follow its setup guide to make it your own.

## Get started

### 1. Install the Terra CLI

**macOS with Homebrew:**

```sh
brew install tryterra/tap/terra
```

**macOS, Linux, or Windows with npm** (requires Node.js 18+):

```sh
npm install -g @tryterra/cli
```

### 2. Download an example

Browse the catalog:

```sh
terra examples list
```

Download an app into a new folder:

```sh
terra examples init unified-api-web-app my-app
cd my-app
```

Replace `unified-api-web-app` with an example name from the table below.
`my-app` must be a new folder inside an existing directory; omit it to use the
example's name as the folder name.

Downloading needs an internet connection, but no Terra login or Git.

### 3. Add Terra's agent skills

Before asking a coding agent to set up or modify the app, run this from the
downloaded app's directory:

```sh
terra agent setup
```

This installs [Terra's agent skills](https://docs.tryterra.co/developer-tools/agent-skills)
for the coding agents it detects. The skills give your agent Terra API guidance
for authentication, webhooks, streaming, and other integration tasks.

Start a new agent session after installation so it picks up the skills, or ask
your current agent to read the installed skill files before continuing.

### 4. Follow the app's setup guide

The CLI prints the next steps after downloading. Read the downloaded
`README.md` and `AGENTS.md` (if present) before installing dependencies or
configuring services. Each app has its own credentials and runtime requirements.

For a quick demo without credentials, choose **Terra Dispatch** or **Terra Panel**:

```sh
terra examples init vantage-web-app my-demo
cd my-demo
terra agent setup
npm install
npm run dev
```

## Choose an example

Each app name links to its setup guide. Use the **CLI name** with
`terra examples init`.

| App | What it does | CLI name |
| --- | --- | --- |
| [Terra Basecamp](./examples/unified-api-web-app/README.md) | Connect wearables and health data to a dashboard with an AI assistant. | `unified-api-web-app` |
| [Terra Grip](./examples/streaming-mobile-app/README.md) | Stream live sensor data from BLE devices, phones, and watches. | `streaming-mobile-app` |
| [Terra Pulse](./examples/streaming-consumer-web-app/README.md) | Display real-time wearable readings on a WebSocket dashboard. | `streaming-consumer-web-app` |
| [Terra Dispatch](./examples/vantage-web-app/README.md) | Order diagnostic test kits, track fulfilment, and deliver results. | `vantage-web-app` |
| [Terra Panel](./examples/lab-reports-web-app/README.md) | Explore lab biomarkers, wearable history, and AI insights in a clinical dashboard. | `lab-reports-web-app` |

### Setup requirements

- **Basecamp:** React, Hono, Cloudflare Workers, Neon Postgres, and BetterAuth.
  Configure credentials before running `npm run setup`, which provisions
  services and deploys to your infrastructure.
- **Grip:** React Native and Expo, with SwiftUI and Kotlin watch companions.
  Requires native build tools and a development build; Expo Go is not supported.
  Pairing needs a physical phone. The setup guide covers watch apps and demo mode.
- **Pulse:** React, Vite, Recharts, and Express. Requires a Terra Dev ID and API
  key in `.env`; the backend keeps the API key out of the browser.
- **Dispatch and Panel:** React, Hono, TanStack Router/Query, and SQLite.
  Both run in demo mode without credentials. Follow their setup guides to
  connect live Vantage or Lab Reports APIs.

## Use with an AI coding agent

Add `--format json` for machine-readable output:

```sh
terra examples list --format json
terra examples init unified-api-web-app my-app --format json
```

These commands run without prompts. JSON goes to stdout; progress goes to
stderr. On success, `init` returns the example, absolute download path, source,
and next steps with their working directories.

See [AGENTS.md](./AGENTS.md) for the output contract and agent workflow.
For command options, run `terra examples --help` or
`terra examples init --help`.

## Contributing

[examples.json](./examples.json) is the catalog. App folders are mirrored from
their source repositories, so make app code changes in the source repo.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for catalog changes and the sync process.

## Useful links

- [Terra CLI](https://github.com/tryterra/terra-cli)
- [Terra docs](https://docs.tryterra.co)
- [Terra dashboard](https://dashboard.tryterra.co)
