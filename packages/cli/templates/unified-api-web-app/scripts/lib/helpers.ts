import { exec, execSync, type ExecSyncOptions } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import type { z } from "zod";
import { EXIT, getReporter } from "./output";

const execAsync = promisify(exec);

/* --------------------------------- Shell ---------------------------------- */

/** Runs a command and returns its trimmed stdout. */
export function runCapture(cmd: string, opts: ExecSyncOptions = {}): string {
  return execSync(cmd, { encoding: "utf-8", stdio: "pipe", ...opts })
    .toString()
    .trim();
}

/** Runs a command, discarding its output (throws on non-zero exit). */
export function runQuiet(cmd: string, opts: ExecSyncOptions = {}): void {
  execSync(cmd, { encoding: "utf-8", stdio: "pipe", ...opts });
}

/** Writes a failed command's captured output to stderr (json-mode diagnostics). */
export function surfaceChildError(e: unknown): void {
  const err = e as { stdout?: Buffer | string; stderr?: Buffer | string };
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
  if (out) process.stderr.write(out + "\n");
}

/** Streams a command's output live (human) or captures it and shows it only on failure (json). */
export function runVisible(cmd: string, opts: ExecSyncOptions = {}): void {
  if (!getReporter().json) {
    execSync(cmd, { encoding: "utf-8", stdio: "inherit", ...opts });
    return;
  }
  try {
    execSync(cmd, { encoding: "utf-8", stdio: "pipe", ...opts });
  } catch (e) {
    surfaceChildError(e);
    throw e;
  }
}

/** Runs a command that emits JSON on stdout and parses the result. */
export function runJson<T = unknown>(
  cmd: string,
  opts: ExecSyncOptions = {},
): T {
  return JSON.parse(runCapture(cmd, opts)) as T;
}

/** Async runCapture: keeps the event loop free so a spinner can animate. */
export async function runCaptureAsync(cmd: string): Promise<string> {
  const { stdout } = await execAsync(cmd, { encoding: "utf-8" });
  return stdout.toString().trim();
}

/** Resolves true if the command exits cleanly (async auth checks). */
export async function commandSucceeds(cmd: string): Promise<boolean> {
  try {
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

/** Prints an error (honoring json mode) and exits — usage error by default. */
export function bail(msg: string, code: number = EXIT.USAGE): never {
  getReporter().error(msg);
  process.exit(code);
}

/** Extracts a human-readable message from an unknown thrown value. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* -------------------------------- Env files ------------------------------- */

export type Env = Record<string, string>;

export function readEnv(path: string): Env {
  const env: Env = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

/** Loads .env, creating it from .env.example on first run. */
export function loadEnv(): Env {
  if (!existsSync(".env")) copyFileSync(".env.example", ".env");
  return readEnv(".env");
}

/** Sets or appends a single key in an env file, preserving everything else. */
export function updateEnvValue(path: string, key: string, value: string): void {
  const content = readFileSync(path, "utf-8");
  const regex = new RegExp(`^${key}=.*$`, "m");
  // Replacement callback so `$`-sequences in secrets are written literally
  if (regex.test(content)) {
    writeFileSync(
      path,
      content.replace(regex, () => `${key}=${value}`),
    );
  } else {
    writeFileSync(path, content.trimEnd() + `\n${key}=${value}\n`);
  }
}

/* ---------------------------------- HTTP ---------------------------------- */

/** Fetches a JSON endpoint and validates the response body with zod. */
export async function fetchJson<Schema extends z.ZodType>(
  url: string,
  init: RequestInit,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const res = await fetch(url, init);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(
      `Unexpected non-JSON response (HTTP ${res.status}) from ${new URL(url).hostname}`,
    );
  }
  return schema.parse(body);
}
