import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "src/client/routeTree.gen.ts",
      "src/server/lib/vantage/types.gen.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/server/lib/vantage/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      // The copyability invariant, mechanically enforced: lib/vantage files
      // must stay liftable — client + stdlib + zod + local types only.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db", "**/db/*", "../../../db/*"],
              message:
                "lib/vantage must not touch the app DB — keep it liftable.",
            },
            {
              group: ["hono", "hono/*", "@hono/*"],
              message:
                "lib/vantage must not import the HTTP framework — routes do HTTP.",
            },
            {
              group: ["../env", "**/lib/env"],
              message:
                "lib/vantage must not read app env plumbing — accept a client instead.",
            },
            {
              group: ["../../routes/*", "**/routes/*"],
              message: "lib/vantage must not import routes.",
            },
          ],
        },
      ],
    },
  },
  {
    // Atoms are copied verbatim from the Terra Basecamp template — keep them
    // byte-comparable rather than lint-patching them locally.
    files: ["src/client/components/shared/atoms/**"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
