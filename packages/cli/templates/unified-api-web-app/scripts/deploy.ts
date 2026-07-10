import { execSync } from "node:child_process";
import { initScript } from "./lib/args";
import { ensureCloudflareAuth, ensureNeonAuth } from "./lib/auth";
import { WORKER_SECRETS } from "./lib/credentials";
import {
  bail,
  errorMessage,
  loadEnv,
  runVisible,
  surfaceChildError,
} from "./lib/helpers";
import { connectionString } from "./lib/neon";
import { EXIT } from "./lib/output";
import { deployWorker } from "./lib/wrangler";

const HELP = `
  npm run deploy — build, migrate, and deploy Terra Basecamp to production

  Usage
    npm run deploy -- [options]

  Options
    --yes, -y     Non-interactive: use env/.env, never prompt
    --json        Machine-readable result on stdout, logs on stderr
    -h, --help    Show this help
    -v, --version Show version

  Requires a completed setup (NEON_PROJECT_ID in .env). See AGENTS.md.

  Exit codes
    0  success   1  usage / missing setup   2  execution failure
`;

const { reporter } = initScript(HELP);

reporter.intro("Terra Basecamp – Deploy");

const env = loadEnv();
await ensureCloudflareAuth(env);
await ensureNeonAuth(env);

if (!env.NEON_PROJECT_ID) {
  bail("Missing NEON_PROJECT_ID in .env. Run: npm run setup");
}
const prodDbUrl = connectionString(env.NEON_PROJECT_ID);

/* ---------------------------------- Build --------------------------------- */

const build = reporter.task();
build.start("Building the app");
try {
  runVisible("npx vite build");
  build.stop("App built");
} catch {
  build.stop("Build failed");
  bail("Vite build failed. Check the errors above.", EXIT.RUNTIME);
}

/* --------------------------- Migrate production --------------------------- */

reporter.step("Applying database migrations to production...");
try {
  runVisible("npx drizzle-kit generate");
  runVisible("npx drizzle-kit migrate", {
    env: { ...process.env, DATABASE_URL: prodDbUrl },
  });
  reporter.success("Migrations applied");
} catch {
  bail("Production migration failed. Check the errors above.", EXIT.RUNTIME);
}

/* --------------------------------- Deploy --------------------------------- */

reporter.step("Deploying the Worker...");
let workerUrl: string;
try {
  workerUrl = deployWorker();
  reporter.success("Deployed");
} catch (e) {
  bail(`Couldn't deploy the Worker:\n\n${errorMessage(e)}`, EXIT.RUNTIME);
}

/* ------------------------------ Worker secrets ---------------------------- */

reporter.step("Setting worker secrets...");
const workerSecrets: Record<string, string> = { DATABASE_URL: prodDbUrl };
for (const name of WORKER_SECRETS) {
  if (name === "DATABASE_URL") continue;
  if (env[name]) workerSecrets[name] = env[name];
}
try {
  execSync("npx wrangler secret bulk", {
    input: JSON.stringify(workerSecrets),
    stdio: reporter.json ? "pipe" : ["pipe", "inherit", "inherit"],
  });
  reporter.success("Worker secrets set");
} catch (e) {
  if (reporter.json) surfaceChildError(e);
  bail("Failed to set worker secrets. Check the errors above.", EXIT.RUNTIME);
}

reporter.data({ ok: true, workerUrl });
reporter.outro(
  workerUrl ? `Live at ${workerUrl}` : "Deployed (see wrangler output above)",
);
