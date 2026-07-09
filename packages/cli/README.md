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

| Option              | Description                       |
| ------------------- | --------------------------------- |
| `--template <name>` | Choose the example                 |
| `--skip-install`    | Skip the dependency install       |
| `--no-git`          | Skip git initialization           |
| `-h, --help`        | Show help                         |
| `-v, --version`     | Show version                      |

## Examples

- **unified-api-web-app** (Terra Basecamp): connect wearables and health sources through Terra's Unified API and view them on a health dashboard with an AI assistant. React, Hono on Cloudflare Workers, Neon Postgres, Durable Objects.

Requires Node.js 20+.

## License

Apache-2.0. See [LICENSE](./LICENSE).
