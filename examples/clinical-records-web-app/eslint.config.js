import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "src/client/routeTree.gen.ts"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/server/lib/clinical/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      // lib/clinical stays liftable: pure parsing + a Terra client interface,
      // no app DB, HTTP framework, or env plumbing.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db", "**/db/*", "../../../db/*"],
              message: "lib/clinical must not touch the app DB.",
            },
            {
              group: ["hono", "hono/*", "@hono/*"],
              message: "lib/clinical must not import the HTTP framework.",
            },
            {
              group: ["../env", "**/lib/env"],
              message: "lib/clinical must not read app env plumbing.",
            },
          ],
        },
      ],
    },
  },
  {
    // Atoms are copied verbatim from the Terra Basecamp template - keep them
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
