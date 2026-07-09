import {
  confirm,
  intro,
  isCancel,
  log,
  outro,
  password,
  spinner,
  text,
} from "@clack/prompts";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import pc from "picocolors";
import { ensureCloudflareAuth, ensureNeonAuth } from "./lib/auth";
import {
  GROUPS,
  WORKER_SECRETS,
  type Field,
  type Group,
  type ValidationResult,
} from "./lib/credentials";
import {
  bail,
  errorMessage,
  loadEnv,
  runVisible,
  updateEnvValue,
  type Env,
} from "./lib/helpers";
import { provisionNeon } from "./lib/neon";
import {
  deployWorker,
  ensureR2Bucket,
  getWorkerName,
  hasWorkerLoaders,
  PaidPlanError,
  setWorkerLoaders,
  setWorkerName,
} from "./lib/wrangler";

/* ----------------------------- Credential wizard -------------------------- */

const interactive = Boolean(process.stdin.isTTY);

/** .env flag remembering that an optional group was deliberately skipped. */
function skipKeyFor(group: Group): string {
  return `SETUP_SKIP_${group.name.toUpperCase()}`;
}

/** Prompts for one field and persists the answer to .env immediately. */
async function promptField(
  env: Env,
  field: Field,
  skipNote?: string,
): Promise<string> {
  const ask = field.secret ? password : text;
  const value = await ask({
    message: skipNote
      ? `${field.key} — ${field.help} (Enter to skip: ${skipNote})`
      : `${field.key} — ${field.help}`,
    validate: skipNote
      ? undefined
      : (v) => (v?.trim() ? undefined : "Required"),
  });
  if (isCancel(value)) {
    bail("Setup cancelled. Re-run to pick up where you left off.");
  }

  env[field.key] = (value ?? "").trim();
  if (env[field.key]) updateEnvValue(".env", field.key, env[field.key]);
  return env[field.key];
}

/** Clears an optional group's values and remembers the skip across runs. */
function skipGroup(env: Env, group: Group): void {
  for (const field of group.fields) {
    env[field.key] = "";
    updateEnvValue(".env", field.key, "");
  }
  env[skipKeyFor(group)] = "true";
  updateEnvValue(".env", skipKeyFor(group), "true");
  log.info(`Skipped ${group.name} — ${group.skipNote}`);
}

/** Runs a group's validator, treating network failures as validation failures. */
async function validateGroup(
  env: Env,
  group: Group,
): Promise<ValidationResult> {
  if (!group.validate) return { ok: true };
  try {
    return await group.validate(env);
  } catch (e) {
    return {
      ok: false,
      message: `Could not reach the ${group.name} API: ${errorMessage(e)}`,
    };
  }
}

/** Prompts for and validates each credential group, re-prompting on failure. */
async function runWizard(env: Env): Promise<void> {
  if (!interactive) {
    const missing = GROUPS.filter((g) => g.required)
      .flatMap((g) => g.fields)
      .filter((f) => !env[f.key])
      .map((f) => `  ${f.key} — ${f.help}`);
    if (missing.length > 0) {
      bail(
        `Missing required credentials in .env (no terminal to prompt):\n${missing.join("\n")}`,
      );
    }
  }

  for (const group of GROUPS) {
    const skippable = !group.required;
    if (skippable && env[skipKeyFor(group)] === "true") continue;
    // Non-interactive: an incomplete optional group is quietly left unset
    if (!interactive && skippable && group.fields.some((f) => !env[f.key])) {
      continue;
    }

    let skipped = false;
    while (!skipped) {
      for (const field of group.fields.filter((f) => !env[f.key])) {
        const value = await promptField(
          env,
          field,
          skippable ? group.skipNote : undefined,
        );
        if (skippable && !value) {
          skipGroup(env, group);
          skipped = true;
          break;
        }
      }
      if (skipped) break;

      const s = spinner();
      s.start(`Validating ${group.name} credentials`);
      const result = await validateGroup(env, group);
      if (result.ok) {
        s.stop(`${group.name} credentials verified`);
        break;
      }
      s.stop(`${group.name} validation failed`);
      if (!interactive) bail(result.message);
      log.error(result.message);
      // Clear only in memory: .env keeps the old values until new answers land
      for (const field of group.fields) env[field.key] = "";
    }
  }
}

/* -------------------------------- App name -------------------------------- */

const APP_NAME_RE = /^[a-z0-9][a-z0-9-]{0,53}$/;

/** Prompts for the app name (Worker + Neon project); syncs .env + wrangler.jsonc. */
async function resolveAppName(env: Env): Promise<void> {
  const current = env.APP_NAME || getWorkerName();
  let name = current;
  if (interactive) {
    const answer = await text({
      message: "What should we call your app? (names the Worker + database)",
      placeholder: current,
      defaultValue: current,
      validate: (v) =>
        !v || APP_NAME_RE.test(v.trim())
          ? undefined
          : "Use lowercase letters, numbers, and hyphens (max 54 chars).",
    });
    if (isCancel(answer)) bail("Setup cancelled.");
    name = (answer || current).trim();
  }
  env.APP_NAME = name;
  updateEnvValue(".env", "APP_NAME", name);
  setWorkerName(name);
}

/* ------------------------------ AI assistant ------------------------------ */

/** Applies the AI choice: a key enables it (+ Worker Loaders), "" disables it. */
function setAi(env: Env, key: string): void {
  env.ANTHROPIC_API_KEY = key;
  updateEnvValue(".env", "ANTHROPIC_API_KEY", key);
  setWorkerLoaders(Boolean(key));
}

/** AI opt-in: a key enables chat + the analyze tool (needs the paid plan). */
async function resolveAiAssistant(env: Env): Promise<void> {
  if (!interactive) {
    setWorkerLoaders(Boolean(env.ANTHROPIC_API_KEY));
    return;
  }

  const enable = await confirm({
    message:
      "Enable the AI assistant (chat + data analysis)? " +
      "Needs an Anthropic API key and the Cloudflare Workers Paid plan ($5/mo).",
    initialValue: hasWorkerLoaders(),
  });
  if (isCancel(enable)) bail("Setup cancelled.");

  if (!enable) {
    setAi(env, "");
    log.info("AI assistant off — deploying on the free plan.");
    return;
  }

  let key = env.ANTHROPIC_API_KEY;
  if (!key) {
    const answer = await password({
      message: "ANTHROPIC_API_KEY — console.anthropic.com/settings/keys",
      validate: (v) => (v?.trim() ? undefined : "Required"),
    });
    if (isCancel(answer)) bail("Setup cancelled.");
    key = answer.trim();
  }
  setAi(env, key);
}

/* ----------------------------- Run migrations ----------------------------- */

/** Generates migrations, then applies them to the dev and prod branches. */
function runMigrations(prodDatabaseUrl: string): void {
  log.step("Generating database migrations...");
  try {
    runVisible("npx drizzle-kit generate");
  } catch {
    bail("Migration generation failed. Check the errors above.");
  }

  log.step("Applying migrations to dev branch...");
  try {
    runVisible("npx drizzle-kit migrate");
  } catch {
    bail("Dev branch migration failed. Check the errors above.");
  }

  log.step("Applying migrations to production branch...");
  try {
    runVisible("npx drizzle-kit migrate", {
      env: { ...process.env, DATABASE_URL: prodDatabaseUrl },
    });
  } catch {
    bail("Production branch migration failed. Check the errors above.");
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

intro(pc.bgCyan(pc.black(pc.bold(" Terra Basecamp – Setup "))));

/** Formats one "What you'll need" row: cyan name, coloured tag, description. */
const row = (
  name: string,
  tag: string,
  color: (s: string) => string,
  desc: string,
) => `  ${pc.cyan(name.padEnd(14))}${color(tag.padEnd(10))}${desc}`;

log.message(
  [
    pc.bold("What this does"),
    "",
    "Signs you in to Cloudflare and Neon, provisions your database, deploys\n" +
      "the Worker, runs migrations, and hands you a live URL.",
    "",
    pc.bold("What you'll need"),
    "",
    row("Cloudflare", "login", pc.green, "hosts the Worker"),
    row("Neon", "login", pc.green, "Postgres database (dev + prod branches)"),
    row(
      "Terra API",
      "keys",
      pc.green,
      "the health data integrations this app is built on",
    ),
    row(
      "Anthropic",
      "optional",
      pc.yellow,
      "powers the AI assistant (chat + analysis)",
    ),
    row("SendGrid", "optional", pc.yellow, "emails login OTP codes"),
    "",
    pc.gray("│ Heads up: the AI assistant also needs the Workers Paid plan"),
    pc.gray("│ ($5/mo). Decline it during setup to stay on the free plan."),
    "",
    "Cloudflare and Neon open a browser to sign in (or set CLOUDFLARE_API_TOKEN\n" +
      "/ NEON_API_KEY to skip). You'll only be prompted for what's missing.",
  ].join("\n"),
);

/* -------------------------------- App name -------------------------------- */

const env = loadEnv();

// Let the reader take in the overview before the questions begin.
if (interactive) {
  const go = await text({ message: "Press Enter to begin" });
  if (isCancel(go)) bail("Setup cancelled.");
}

await resolveAppName(env);

/* -------------------------------- Sign in --------------------------------- */

await ensureCloudflareAuth(env);
await ensureNeonAuth(env);

/* ------------------------------- Credentials ------------------------------ */

await runWizard(env);
await resolveAiAssistant(env);

if (!env.BETTER_AUTH_SECRET) {
  env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
  updateEnvValue(".env", "BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET);
  log.success("Generated BETTER_AUTH_SECRET");
}

/* ---------------------------- Provision Neon ------------------------------ */

const neon = await provisionNeon(env);
updateEnvValue(".env", "DATABASE_URL", neon.devDatabaseUrl);
log.success(".env updated with DATABASE_URL (dev branch)");

/* ------------------------------- R2 bucket -------------------------------- */

const r2Spinner = spinner();
r2Spinner.start("Ensuring R2 bucket (terra-webhooks)");
try {
  ensureR2Bucket("terra-webhooks");
  r2Spinner.stop("R2 bucket ready (terra-webhooks)");
} catch (e) {
  r2Spinner.stop("R2 setup failed");
  bail(errorMessage(e) + "\n  Fix the issue above and re-run: npm run setup");
}

/* --------------------------------- Build ---------------------------------- */

log.step("Building the app (vite build)...");
try {
  runVisible("npx vite build");
  log.success("App built");
} catch {
  bail("Vite build failed. Check the errors above.");
}

/* ------------------------------- Migrations ------------------------------- */

runMigrations(neon.prodDatabaseUrl);

/* --------------------------------- Deploy --------------------------------- */

log.step("Deploying the Worker...");
let workerUrl: string;
try {
  workerUrl = deployWorker();
  log.success("Worker deployed");
} catch (e) {
  // The AI assistant needs the paid plan — offer to drop it and deploy free.
  if (e instanceof PaidPlanError && interactive) {
    log.warn(errorMessage(e));
    const goFree = await confirm({
      message: "Disable the AI assistant and deploy on the free plan?",
      initialValue: true,
    });
    if (isCancel(goFree) || !goFree) {
      bail("Upgrade to the Workers Paid plan, then re-run: npm run setup");
    }
    setAi(env, "");
    log.step("Redeploying on the free plan (AI assistant disabled)...");
    try {
      workerUrl = deployWorker();
      log.success("Worker deployed (free plan)");
    } catch (e2) {
      bail(`Couldn't deploy the Worker:\n\n${errorMessage(e2)}`);
    }
  } else {
    bail(`Couldn't deploy the Worker:\n\n${errorMessage(e)}`);
  }
}

/* ----------------------------- Worker secrets ----------------------------- */

log.step("Setting worker secrets...");
const workerSecrets: Record<string, string> = {
  DATABASE_URL: neon.prodDatabaseUrl,
};
for (const name of WORKER_SECRETS) {
  if (name === "DATABASE_URL") continue;
  if (env[name]) workerSecrets[name] = env[name];
}
try {
  execSync("npx wrangler secret bulk", {
    input: JSON.stringify(workerSecrets),
    stdio: ["pipe", "inherit", "inherit"],
  });
  log.success("Worker secrets set");
} catch {
  bail("Failed to set worker secrets. Check the errors above.");
}

/* ---------------------------------- Done ---------------------------------- */

const webhookUrl = workerUrl
  ? `${workerUrl}/api/terra/webhook`
  : "<your app URL>/api/terra/webhook";

log.success(`Your app is live at ${pc.cyan(workerUrl || "your Worker URL")}`);

log.message(
  [
    `${pc.bold(pc.yellow("One last step"))} – point Terra at your webhook`,
    "",
    `  1. Open ${pc.cyan("https://dashboard.tryterra.co/dashboard/connections")}`,
    "  2. Set the destination (webhook) URL to:",
    "",
    `     ${pc.cyan(webhookUrl)}`,
    "",
    pc.gray(
      "│ Until this is set, Terra can't deliver health data to your app.",
    ),
  ].join("\n"),
);

log.message(
  [
    pc.bold("Commands"),
    "",
    `  ${pc.cyan("npm run dev".padEnd(16))}local dev server (Neon "dev" branch)`,
    `  ${pc.cyan("npm run deploy".padEnd(16))}build + migrate + deploy to prod`,
  ].join("\n"),
);

outro("Setup complete 🎉");
