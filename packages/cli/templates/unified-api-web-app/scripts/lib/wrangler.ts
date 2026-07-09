import { log } from "@clack/prompts";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { errorMessage, runCapture, runVisible } from "./helpers";

const WORKERS_DEV_URL = /https:\/\/[^\s]+\.workers\.dev/;
const WRANGLER_CONFIG = "wrangler.jsonc";

/** wrangler's global config dir, mirroring its own resolution logic. */
function wranglerConfigDir(): string {
  const home = homedir();
  const legacy = join(home, ".wrangler");
  if (existsSync(legacy) && statSync(legacy).isDirectory()) return legacy;
  const xdg = process.env.XDG_CONFIG_HOME;
  if (process.platform === "darwin")
    return join(xdg || join(home, "Library", "Preferences"), ".wrangler");
  if (process.platform === "win32")
    return join(
      xdg || process.env.APPDATA || join(home, "AppData", "Roaming"),
      ".wrangler",
    );
  return join(xdg || join(home, ".config"), ".wrangler");
}

/** Pre-answers wrangler's "install Cloudflare skills?" prompt so it stays quiet. */
export function suppressSkillsPrompt(): void {
  try {
    const file = join(wranglerConfigDir(), "agents-skills-install.jsonc");
    if (existsSync(file)) return;
    mkdirSync(wranglerConfigDir(), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({ version: 1, accepted: false, detectedAgents: [] }) +
        "\n",
    );
  } catch {
    // Best-effort: if this fails the prompt just appears as before.
  }
}

/** Reads the Worker name from wrangler.jsonc (the source of truth). */
export function getWorkerName(): string {
  const config = readFileSync(WRANGLER_CONFIG, "utf-8");
  return config.match(/"name"\s*:\s*"([^"]*)"/)?.[1] ?? "terra-basecamp";
}

/** Sets the Worker name in wrangler.jsonc (no-op if unchanged). */
export function setWorkerName(name: string): void {
  const config = readFileSync(WRANGLER_CONFIG, "utf-8");
  const updated = config.replace(/("name"\s*:\s*)"[^"]*"/, `$1"${name}"`);
  if (updated !== config) writeFileSync(WRANGLER_CONFIG, updated);
}

const LOADER_LINE = '  "worker_loaders": [{ "binding": "LOADER" }],\n';

/** True if wrangler.jsonc declares the Worker Loaders (LOADER) binding. */
export function hasWorkerLoaders(): boolean {
  return /"worker_loaders"\s*:/.test(readFileSync(WRANGLER_CONFIG, "utf-8"));
}

/** Adds or removes the LOADER binding (the analyze tool needs the paid plan). */
export function setWorkerLoaders(enabled: boolean): void {
  const config = readFileSync(WRANGLER_CONFIG, "utf-8");
  const has = /"worker_loaders"\s*:/.test(config);
  let updated = config;
  if (enabled && !has) {
    updated = config.replace(/(^\s*"main"\s*:.*\n)/m, `$1${LOADER_LINE}`);
  } else if (!enabled && has) {
    updated = config.replace(/^\s*"worker_loaders"\s*:.*\n/m, "");
  }
  if (updated !== config) writeFileSync(WRANGLER_CONFIG, updated);
}

/** Deploy failed because the account is on the free plan (Worker Loaders). */
export class PaidPlanError extends Error {}

/** Creates the R2 bucket, treating "already exists" as success. */
export function ensureR2Bucket(name: string): void {
  try {
    runCapture(`npx wrangler r2 bucket create ${name}`);
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    const output = `${err.stdout ?? ""}${err.stderr ?? ""}${errorMessage(e)}`;
    if (!/already exist|exists/i.test(output)) throw e;
  }
}

/** Trims a generic deploy failure to just the error block, not the upload log. */
function errorBlock(output: string): string {
  const marker = output.indexOf("✘");
  return marker >= 0 ? output.slice(marker).trim() : output.trim();
}

/** Deploys the Worker and returns its workers.dev URL (empty if unparsed). */
export function deployWorker(): string {
  let out: string;
  try {
    out = runCapture("npx wrangler deploy 2>&1");
  } catch (e) {
    const captured =
      (e as { stdout?: Buffer }).stdout?.toString() ?? errorMessage(e);
    if (/\b10195\b|Dynamic Workers|switch to a paid plan/i.test(captured)) {
      throw new PaidPlanError(
        'This app uses Worker Loaders (the sandbox behind the AI "analyze"\n' +
          "tool), which requires the Cloudflare Workers Paid plan ($5/mo).",
      );
    }
    throw new Error(errorBlock(captured));
  }
  process.stdout.write(out + "\n");
  return out.match(WORKERS_DEV_URL)?.[0] ?? "";
}

/** Deletes the Worker (used by reset); ignores "not found". */
export function deleteWorker(name: string): void {
  try {
    runVisible(`npx wrangler delete ${name} --force`);
  } catch (e) {
    log.warn(`Could not delete Worker "${name}": ${errorMessage(e)}`);
  }
}

/** Best-effort R2 bucket delete (requires the bucket be empty). */
export function deleteR2Bucket(name: string): void {
  try {
    runCapture(`npx wrangler r2 bucket delete ${name} 2>&1`);
    log.success(`Deleted R2 bucket "${name}"`);
  } catch (e) {
    log.warn(
      `Could not delete R2 bucket "${name}" (empty it first): ${errorMessage(e)}`,
    );
  }
}
