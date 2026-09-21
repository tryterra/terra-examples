# AGENTS.md

This repository publishes runnable Terra apps for `terra examples`.

## Discover and download

```sh
terra examples list --format json
terra examples init unified-api-web-app my-app --format json
```

`list` returns `{ "examples": [...] }`. Use an entry's `name` with `init`.
`init` returns `example`, absolute `path`, `source`, and `next_steps`.
Each next step has a `directory` relative to the app and an `instruction` to
follow. Only trust stdout when the command exits successfully.

No login, Git, or Node.js is required to download an app. Installation and setup
are separate actions. Read the app's README and AGENTS.md where present before
configuring credentials or provisioning services. Mobile apps have native build
requirements rather than web deployment steps.

## Maintaining the catalog

- `examples.json` is the authoritative catalog; `examples.schema.json` defines
  its format. App files live under `examples/<name>/`.
- App folders are mirrored from their source repos. Do not hand-edit app code
  here: changes would be overwritten by the next sync.
- Edit catalog metadata here. Adding an app requires a manifest entry and its
  mirrored folder in the same PR.
- CI runs `npm run test:catalog` and `npm run validate:catalog`.
