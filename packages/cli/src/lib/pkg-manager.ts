export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** The package managers a `--package-manager` override may name. */
export const PACKAGE_MANAGERS: readonly PackageManager[] = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
];

/** Narrows an arbitrary string to a supported package manager. */
export function isPackageManager(value: string): value is PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

/**
 * Detects the package manager that invoked this CLI, from the
 * `npm_config_user_agent` env var that npm/pnpm/yarn/bun all set. Defaults to
 * npm when the variable is missing or unrecognized.
 */
export function getUserPkgManager(): PackageManager {
  const ua = process.env.npm_config_user_agent;
  if (ua?.startsWith("yarn")) return "yarn";
  if (ua?.startsWith("pnpm")) return "pnpm";
  if (ua?.startsWith("bun")) return "bun";
  return "npm";
}

/** The install command for a package manager (yarn omits the `install` word). */
export function installCommand(pm: PackageManager): string {
  return pm === "yarn" ? "yarn" : `${pm} install`;
}

/** Install command run during scaffold: skips audit/funding, prefers cache, and uses `npm ci` when a lockfile ships. */
export function installRunCommand(pm: PackageManager, lockfile: boolean): string {
  switch (pm) {
    case "npm":
      return `npm ${lockfile ? "ci" : "install"} --no-audit --no-fund --prefer-offline`;
    case "pnpm":
      return "pnpm install --prefer-offline";
    case "yarn":
      return "yarn";
    case "bun":
      return "bun install";
  }
}

/** How to run a package.json script — yarn/pnpm drop the `run` keyword. */
export function runScriptCommand(pm: PackageManager, script: string): string {
  return pm === "yarn" || pm === "pnpm" ? `${pm} ${script}` : `${pm} run ${script}`;
}
