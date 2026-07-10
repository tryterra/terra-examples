import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locates the bundled `templates/` directory by walking up from this module.
 * Robust to layout differences: bundled to `dist/index.js` in production, run
 * from `src/lib/` under tsx in dev — either way the nearest ancestor holding a
 * `templates/` folder is the package root.
 */
function findTemplatesDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "templates");
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error("Could not locate the templates directory.");
}

export const templatesDir = findTemplatesDir();

/** Lists available template names (directory names under templates/). */
export function listTemplates(): string[] {
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Reads a template's one-line description from its package.json, if present. */
export function templateDescription(name: string): string | undefined {
  try {
    const pkg = JSON.parse(
      readFileSync(join(templatesDir, name, "package.json"), "utf-8"),
    ) as { description?: string };
    return pkg.description;
  } catch {
    return undefined;
  }
}

export function templateExists(name: string): boolean {
  return existsSync(join(templatesDir, name));
}

/** Every template paired with its description — the payload for `--list`. */
export function describeTemplates(): { name: string; description?: string }[] {
  return listTemplates().map((name) => ({
    name,
    description: templateDescription(name),
  }));
}

/** Coerces a directory name into a valid, lowercase npm package name. */
export function toPackageName(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-~.]/g, "-")
      .replace(/^[._]+/, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "terra-app"
  );
}

// Benign entries that don't count as "occupied" (mirrors create-next-app)
const ALLOWED_EXISTING = new Set([
  ".git",
  ".gitignore",
  ".vscode",
  ".idea",
  ".DS_Store",
  "LICENSE",
]);

export function isEmptyDir(dir: string): boolean {
  if (!existsSync(dir)) return true;
  return readdirSync(dir).every((e) => ALLOWED_EXISTING.has(e));
}

/**
 * Copies a template into targetDir, then applies scaffold transforms:
 * restores `gitignore` → `.gitignore` (npm strips real .gitignore from
 * published packages) and names the app after its directory. Returns the
 * scaffolded package.json so callers can inspect its scripts.
 */
export function scaffold(template: string, targetDir: string): {
  scripts?: Record<string, string>;
} {
  cpSync(join(templatesDir, template), targetDir, { recursive: true });

  const shippedGitignore = join(targetDir, "gitignore");
  if (existsSync(shippedGitignore)) {
    renameSync(shippedGitignore, join(targetDir, ".gitignore"));
  }

  const pkgPath = join(targetDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  pkg.name = toPackageName(basename(targetDir));
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  return pkg;
}
