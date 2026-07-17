import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Verifies every bundled template has the root package.json the CLI depends
 * on: `scaffold()` rewrites its `name`, and `--list` reads its `description`.
 */
const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

const problems = [];
for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(templatesDir, entry.name, "package.json"), "utf-8"));
  } catch {
    problems.push(`${entry.name}: missing or unparsable root package.json`);
    continue;
  }
  for (const field of ["name", "description"]) {
    if (!pkg[field]) problems.push(`${entry.name}: package.json is missing "${field}"`);
  }
}

if (problems.length > 0) {
  console.error(`Template validation failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("All templates have a root package.json with a name and description.");
