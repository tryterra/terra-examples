# Contributing

## Catalog format

`examples.json` is the single source of catalog metadata. It has
`schema_version: 1` and an `examples` array. Entries contain:

- `name`: stable lowercase identifier with hyphens.
- `title` and `description`: plain text shown by the CLI.
- `path`: exactly `examples/<name>`.
- `next_steps`: ordered objects with `directory` and `instruction`. Directories
  are relative to the example, with `.` meaning its root. Instructions are
  displayed, never executed by the CLI.

Every app must include README.md. Preserve package names, lockfiles, binary
assets, executable scripts, and real `.gitignore` files. Files must have portable
ASCII paths; symlinks, special files, Windows reserved names, and case collisions
are rejected. Keep secrets and source-only publication workflows out of mirrors.

CI validates the schema, file paths, instruction directories, and the CLI's
archive budgets: 1 MiB catalog, 32 MiB compressed repository, 128 MiB expanded,
and 10,000 archive entries. The publisher reserves 1 MiB of compressed headroom
for differences between Git and GitHub archive generation.

```sh
npm ci --ignore-scripts
npm run test:catalog
npm run validate:catalog
```

## Updating examples

Apps are developed in their source repositories:

- `unified-api-web-app`: `tryterra/unified-api-web-app`.
- `streaming-mobile-app`: `tryterra/terra-grip`.

Their release-triggered mirror workflows open PRs here. Update the source app,
cut its release, review the resulting sync PR, and merge. Merging a validated
catalog or app change publishes it to existing Terra CLI installations.

Keep the catalog and its corresponding folder changes in the same commit. The
CLI downloads one repository snapshot when creating an app, so it uses matching
metadata and files even when another release merges during a download.

## Adding an example

Create a standalone app in its own source repository. Add a release-triggered
mirror targeting `examples/<name>/`, using the existing sync GitHub App. Open a
PR here with the app folder and catalog entry. Keep app-specific provisioning
and setup behavior inside the app's documentation and scripts.

No Terra CLI release is required for a valid schema-v1 example. Changes to the
catalog schema require coordinated CLI support first.

## Migration

Follow [MIGRATION.md](MIGRATION.md) for the coordinated Terra CLI release and
npm package deprecation. Mirror workflows target `examples/`.
