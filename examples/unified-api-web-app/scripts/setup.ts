import { confirm, isCancel, password, text } from "@clack/prompts";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import pc from "picocolors";
import { initScript } from "./lib/args";
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
  surfaceChildError,
  updateEnvValue,
  withLocalBin,
  type Env,
} from "./lib/helpers";
import { provisionNeon } from "./lib/neon";
import { EXIT } from "./lib/output";
import {
  deployWorker,
  ensureR2Bucket,
  getWorkerName,
  hasWorkerLoaders,
  PaidPlanError,
  setWorkerLoaders,
  setWorkerName,
} from "./lib/wrangler";

/* -------------------------------- CLI flags ------------------------------- */

const HELP = `
  npm run setup — provision services and deploy Terra Basecamp

  Usage
    npm run setup -- [options]

  Options
    --app-name <name>   Name the Worker + Neon project (env: APP_NAME)
    --ai, --no-ai       Turn the AI assistant on/off (skips the prompt). Off by
                        default; --ai needs ANTHROPIC_API_KEY + the Workers Paid plan.
    --free-plan         On a paid-plan error, drop AI and redeploy free (env: SETUP_FREE_PLAN)
    --yes, -y           Non-interactive: use env/.env, never prompt
    --json              Machine-readable result on stdout, logs on stderr
    -h, --help          Show this help
    -v, --version       Show version

  Non-interactive setup reads credentials from .env / the environment. See
  AGENTS.md for the full agent workflow, JSON shape, and exit codes.

  Exit codes
    0  success
    1  usage / missing credentials
    2  execution failure (build / migrate / deploy)
`;

const { flags, reporter, interactive } = initScript(HELP, {
  "app-name": { type: "string" },
  ai: { type: "boolean" },
  "no-ai": { type: "boolean" },
  "free-plan": { type: "boolean" },
});

if (flags.ai && flags["no-ai"]) {
  bail("--ai and --no-ai are mutually exclusive.");
}
/** Explicit AI choice from flags, or `undefined` to fall back to the default. */
const aiFlag: boolean | undefined = flags["no-ai"]
  ? false
  : flags.ai
    ? true
    : undefined;
const freePlan =
  Boolean(flags["free-plan"]) || process.env.SETUP_FREE_PLAN === "1";

/* ----------------------------- Credential wizard -------------------------- */

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
  reporter.info(`Skipped ${group.name} — ${group.skipNote}`);
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

      const s = reporter.task();
      s.start(`Validating ${group.name} credentials`);
      const result = await validateGroup(env, group);
      if (result.ok) {
        s.stop(`${group.name} credentials verified`);
        break;
      }
      s.stop(`${group.name} validation failed`);
      if (!interactive) bail(result.message);
      reporter.error(result.message);
      // Clear only in memory: .env keeps the old values until new answers land
      for (const field of group.fields) env[field.key] = "";
    }
  }
}

/* -------------------------------- App name -------------------------------- */

const APP_NAME_RE = /^[a-z0-9][a-z0-9-]{0,53}$/;

/** Resolves the app name (--app-name / APP_NAME / prompt); syncs .env + wrangler.jsonc. */
async function resolveAppName(env: Env): Promise<void> {
  const flagName = flags["app-name"] as string | undefined;
  if (flagName && !APP_NAME_RE.test(flagName.trim())) {
    bail(
      "Invalid --app-name. Use lowercase letters, numbers, and hyphens (max 54 chars).",
    );
  }

  const current = flagName?.trim() || env.APP_NAME || getWorkerName();
  let name = current;
  if (interactive && !flagName) {
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

/** dash.cloudflare.com Workers plans page (redirect form if account id unknown). */
function workersPlansUrl(env: Env): string {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
  return id
    ? `https://dash.cloudflare.com/${id}/workers/plans`
    : "https://dash.cloudflare.com/?to=/:account/workers/plans";
}

/** Flags the Workers Paid plan requirement + link up front (no pre-deploy probe exists; deploy-time fallback handles the wall). */
function noteWorkersPaidPlan(env: Env): void {
  reporter.message(
    [
      `${pc.bold("Heads up")}: the AI assistant runs on Worker Loaders, which`,
      "needs the Cloudflare Workers Paid plan ($5/mo). On the free plan the",
      "deploy will stop and offer to continue with AI disabled.",
      "",
      `  Check/upgrade your plan: ${pc.cyan(workersPlansUrl(env))}`,
    ].join("\n"),
  );
}

/** AI opt-in: enables chat + the analyze tool (needs a key + the paid plan). */
async function resolveAiAssistant(env: Env): Promise<void> {
  if (!interactive) {
    // A paid feature must be an explicit --ai, not inferred from a stray key.
    const enable = aiFlag === true;
    if (enable && !env.ANTHROPIC_API_KEY) {
      bail("--ai requires ANTHROPIC_API_KEY. Set it in .env, or drop --ai.");
    }
    setWorkerLoaders(enable);
    if (!enable) env.ANTHROPIC_API_KEY = ""; // don't ship the key; leave .env as-is
    if (enable) noteWorkersPaidPlan(env);
    return;
  }

  const enable = await confirm({
    message:
      "Enable the AI assistant (chat + data analysis)? " +
      "Needs an Anthropic API key and the Cloudflare Workers Paid plan ($5/mo).",
    initialValue: aiFlag ?? hasWorkerLoaders(),
  });
  if (isCancel(enable)) bail("Setup cancelled.");

  if (!enable) {
    setAi(env, "");
    reporter.info("AI assistant off — deploying on the free plan.");
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
  noteWorkersPaidPlan(env);
}

/* ----------------------------- Run migrations ----------------------------- */

/** Generates migrations, then applies them to the dev and prod branches. */
function runMigrations(prodDatabaseUrl: string): void {
  reporter.step("Generating database migrations...");
  try {
    runVisible("drizzle-kit generate");
  } catch {
    bail("Migration generation failed. Check the errors above.", EXIT.RUNTIME);
  }

  reporter.step("Applying migrations to dev branch...");
  try {
    runVisible("drizzle-kit migrate");
  } catch {
    bail("Dev branch migration failed. Check the errors above.", EXIT.RUNTIME);
  }

  reporter.step("Applying migrations to production branch...");
  try {
    runVisible("drizzle-kit migrate", {
      env: { ...process.env, DATABASE_URL: prodDatabaseUrl },
    });
  } catch {
    bail(
      "Production branch migration failed. Check the errors above.",
      EXIT.RUNTIME,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Main                                    */
/* -------------------------------------------------------------------------- */

reporter.intro(pc.bgCyan(pc.black(pc.bold(" Terra Basecamp – Setup "))));

/** Formats one "What you'll need" row: cyan name, coloured tag, description. */
const row = (
  name: string,
  tag: string,
  color: (s: string) => string,
  desc: string,
) => `  ${pc.cyan(name.padEnd(14))}${color(tag.padEnd(10))}${desc}`;

// The overview + "Press Enter" gate are onboarding for humans; agents read AGENTS.md.
if (interactive) {
  reporter.message(
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

  const go = await text({ message: "Press Enter to begin" });
  if (isCancel(go)) bail("Setup cancelled.");
}

/* -------------------------------- App name -------------------------------- */

const env = loadEnv();

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
  reporter.success("Generated BETTER_AUTH_SECRET");
}

/* ---------------------------- Provision Neon ------------------------------ */

const neon = await provisionNeon(env);
updateEnvValue(".env", "DATABASE_URL", neon.devDatabaseUrl);
reporter.success(".env updated with DATABASE_URL (dev branch)");

/* ------------------------------- R2 bucket -------------------------------- */

const r2Task = reporter.task();
r2Task.start("Ensuring R2 bucket (terra-webhooks)");
try {
  ensureR2Bucket("terra-webhooks");
  r2Task.stop("R2 bucket ready (terra-webhooks)");
} catch (e) {
  r2Task.stop("R2 setup failed");
  bail(
    errorMessage(e) + "\n  Fix the issue above and re-run: npm run setup",
    EXIT.RUNTIME,
  );
}

/* --------------------------------- Build ---------------------------------- */

reporter.step("Building the app (vite build)...");
try {
  runVisible("vite build");
  reporter.success("App built");
} catch {
  bail("Vite build failed. Check the errors above.", EXIT.RUNTIME);
}

/* ------------------------------- Migrations ------------------------------- */

runMigrations(neon.prodDatabaseUrl);

/* --------------------------------- Deploy --------------------------------- */

reporter.step("Deploying the Worker...");
let workerUrl: string;
try {
  workerUrl = deployWorker();
  reporter.success("Worker deployed");
} catch (e) {
  // Paid-plan wall: drop AI and redeploy free if allowed (ask, or --free-plan).
  if (!(e instanceof PaidPlanError) || (!interactive && !freePlan)) {
    bail(`Couldn't deploy the Worker:\n\n${errorMessage(e)}`, EXIT.RUNTIME);
  }
  reporter.warn(errorMessage(e));
  if (interactive) {
    const goFree = await confirm({
      message: "Disable the AI assistant and deploy on the free plan?",
      initialValue: true,
    });
    if (isCancel(goFree) || !goFree) {
      bail("Upgrade to the Workers Paid plan, then re-run: npm run setup");
    }
  }
  setAi(env, "");
  reporter.step("Redeploying on the free plan (AI assistant disabled)...");
  try {
    workerUrl = deployWorker();
    reporter.success("Worker deployed (free plan)");
  } catch (e2) {
    bail(`Couldn't deploy the Worker:\n\n${errorMessage(e2)}`, EXIT.RUNTIME);
  }
}

/* ----------------------------- Worker secrets ----------------------------- */

reporter.step("Setting worker secrets...");
const workerSecrets: Record<string, string> = {
  DATABASE_URL: neon.prodDatabaseUrl,
};
for (const name of WORKER_SECRETS) {
  if (name === "DATABASE_URL") continue;
  if (env[name]) workerSecrets[name] = env[name];
}
try {
  execSync("wrangler secret bulk", {
    input: JSON.stringify(workerSecrets),
    stdio: reporter.json ? "pipe" : ["pipe", "inherit", "inherit"],
    env: withLocalBin(),
  });
  reporter.success("Worker secrets set");
} catch (e) {
  if (reporter.json) surfaceChildError(e);
  bail("Failed to set worker secrets. Check the errors above.", EXIT.RUNTIME);
}

/* ---------------------------------- Done ---------------------------------- */

const webhookUrl = workerUrl
  ? `${workerUrl}/api/terra/webhook`
  : "<your app URL>/api/terra/webhook";

// No connection strings here: stdout lands in an agent's context/logs, and the
// dev URL carries the DB password. It's already saved to .env by setup.
reporter.data({
  ok: true,
  appName: env.APP_NAME,
  workerUrl,
  webhookUrl: workerUrl ? webhookUrl : "",
  neonProjectId: env.NEON_PROJECT_ID ?? "",
  neonOrgId: env.NEON_ORG_ID ?? "",
  ai: hasWorkerLoaders(),
});

reporter.success(
  `Your app is live at ${pc.cyan(workerUrl || "your Worker URL")}`,
);

reporter.message(
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

reporter.message(
  [
    pc.bold("Commands"),
    "",
    `  ${pc.cyan("npm run dev".padEnd(16))}local dev server (Neon "dev" branch)`,
    `  ${pc.cyan("npm run deploy".padEnd(16))}build + migrate + deploy to prod`,
  ].join("\n"),
);

reporter.outro("Setup complete 🎉");
