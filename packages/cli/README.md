# create-tryterra-app

Scaffold a [Terra](https://tryterra.co) example app into a new folder.

```bash
npx create-tryterra-app@latest my-app
```

Copies an example, installs dependencies with the package manager you invoked it
with (`npm`/`pnpm`/`yarn`/`bun`), initializes git, and (where supported) offers to
run the setup wizard.

## Usage

```bash
npx create-tryterra-app [directory] [options]
```

If you omit the directory or `--template`, you'll be prompted (pick the example
first, then name the project). Names are validated as npm package names; pass `.`
to scaffold into the current directory.

| Option                         | Description                                         |
| ------------------------------ | --------------------------------------------------- |
| `--template <name>`            | Choose the example                                  |
| `--list`                       | List examples (add `--json` for machine output)     |
| `--package-manager <name>`     | Force `npm` \| `pnpm` \| `yarn` \| `bun`            |
| `--yes`, `-y`                  | Non-interactive: accept defaults, never prompt      |
| `--force`                      | Scaffold into a non-empty directory                 |
| `--setup`                      | Run the example's setup script after install        |
| `--no-setup`                   | Never run the setup script                          |
| `--skip-install`               | Skip the dependency install (alias: `--no-install`) |
| `--no-git`                     | Skip git initialization                             |
| `--json`                       | Machine-readable output on stdout, logs on stderr   |
| `-h, --help`                   | Show help                                           |
| `-v, --version`                | Show version                                        |

## Non-interactive / AI agents

```bash
npx create-tryterra-app@latest my-app --template unified-api-web-app --yes --json
```

`--json` prints a single result object to stdout (`{ ok, directory, path,
template, packageManager, install, git, setup, nextSteps }`) and routes all
progress to stderr. Exit codes: `0` success · `1` usage/input error · `2`
execution failure. See [AGENTS.md](../../AGENTS.md) for the full agent workflow.

## Examples

- **unified-api-web-app** (Terra Basecamp): connect wearables and health sources through Terra's Unified API and view them on a health dashboard with an AI assistant. React, Hono on Cloudflare Workers, Neon Postgres, Durable Objects.
- **streaming-mobile-app** (Terra Grip): stream real-time wearable and sensor data to Terra from a React Native app, with Apple Watch and Wear OS companion apps. React Native (Expo), terra-rt SDK.

Requires Node.js 20+.

## License

Apache-2.0. See [LICENSE](./LICENSE).
