<p align="center">
  <a href="https://tryterra.co">
    <img src="./assets/terra-icon.svg" height="96">
  </a>
  <h3 align="center">Terra Examples</h3>
</p>

Standalone example apps built with [Terra API](https://tryterra.co). Download an
app with the Terra CLI, configure it, and build on top of it.

```sh
terra examples list
terra examples init unified-api-web-app my-app
```

The CLI fetches the current examples from this repository and prints the next
steps. The destination must be a new directory inside an existing parent. If you
omit the directory, it defaults to the example's name.

Downloading requires a network connection. Follow the app's README to install
dependencies, configure credentials, and run it.

## Examples

### Terra Basecamp

[`unified-api-web-app`](./examples/unified-api-web-app) connects wearables and
health data sources to a health dashboard with an AI assistant. It demonstrates
device connection, webhook ingestion, multi-provider deduplication, scheduled
sync, and deployment to a Cloudflare Worker.

**Stack:** React, Hono, Cloudflare Workers, Neon Postgres, and BetterAuth.

```sh
terra examples init unified-api-web-app my-app
cd my-app
npm install
```

Read the downloaded README and AGENTS.md to configure credentials, then run:

```sh
npm run setup
npm run dev
```

The setup script provisions services and deploys the app to your infrastructure.

### Terra Grip

[`streaming-mobile-app`](./examples/streaming-mobile-app) streams real-time
sensor data from BLE devices, a phone, or a companion watch app. It demonstrates
QR pairing, background streaming, Apple Watch and Wear OS companions, and a demo
mode with synthetic data.

**Stack:** React Native, Expo, terra-rt, watchOS (SwiftUI), and Wear OS (Kotlin).

```sh
terra examples init streaming-mobile-app my-grip-app
cd my-grip-app/app
npm install
npx expo run:ios   # or: npx expo run:android
```

The Terra RT SDK is a native module and requires a development build; Expo Go is
not supported. Pairing needs a physical phone. See the
[app README](./examples/streaming-mobile-app/README.md) for native build tools,
watch setup, and demo mode.

## Using with AI coding agents

Discover examples and download one with machine-readable output:

```sh
terra examples list --format json
terra examples init unified-api-web-app my-app --format json
```

These commands run without prompts. JSON goes to stdout and progress goes to
stderr. A successful download returns `example`, absolute `path`, `source`, and
`next_steps`. Each step names a working directory relative to the app and an
instruction to follow. Read the app's README and AGENTS.md where present before
running setup.

Use `terra examples --help` for commands and `terra examples init --help` for
options. See [AGENTS.md](./AGENTS.md) for the agent workflow.

## Contributing

The root [examples.json](./examples.json) lists the apps in [examples/](./examples).
Each app is mirrored from its own source repository. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the catalog format and update process.

## Useful links

- [Terra docs](https://docs.tryterra.co)
- [Terra dashboard](https://dashboard.tryterra.co)
