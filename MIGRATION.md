# Terra CLI migration

Merge the catalog PR before changing either app's mirror destination. Existing
npm releases contain their own templates and continue to work. This repository
maintains only the catalog and example apps, with no npm scaffolder or publishing
workflow.

1. Publish `examples.json` and `examples/` on this repository's `main` branch.
2. Merge the mirror workflow updates in `tryterra/unified-api-web-app` and
   `tryterra/terra-grip`.
3. Run the CLI's examples contract check against this repository's commit.
   It downloads the archive in CI and checks every scaffolded file against it.
4. Release a Terra CLI containing `terra examples list` and `terra examples init`.
   Verify both examples with the released binary.
5. Deprecate the npm package using a maintainer's npm credentials:

   ```sh
   npm deprecate 'create-tryterra-app@*' \
     'Use terra examples list and terra examples init <example> [directory].'
   ```

An app rollback is a revert of its mirror or catalog change. Require catalog
validation on PRs before allowing merges to `main`.
