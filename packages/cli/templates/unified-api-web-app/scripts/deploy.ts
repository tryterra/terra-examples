import { intro, log, outro, spinner } from "@clack/prompts";
import { execSync } from "node:child_process";
import { ensureCloudflareAuth, ensureNeonAuth } from "./lib/auth";
import { WORKER_SECRETS } from "./lib/credentials";
import { bail, errorMessage, loadEnv, runVisible } from "./lib/helpers";
import { connectionString } from "./lib/neon";
import { deployWorker } from "./lib/wrangler";

intro("Terra Basecamp – Deploy");

const env = loadEnv();
await ensureCloudflareAuth(env);
await ensureNeonAuth(env);

if (!env.NEON_PROJECT_ID) {
  bail("Missing NEON_PROJECT_ID in .env. Run: npm run setup");
}
const prodDbUrl = connectionString(env.NEON_PROJECT_ID);

/* ---------------------------------- Build --------------------------------- */

const s = spinner();
s.start("Building the app");
runVisible("npx vite build");
s.stop("App built");

/* --------------------------- Migrate production --------------------------- */

log.step("Applying database migrations to production...");
runVisible("npx drizzle-kit generate");
runVisible("npx drizzle-kit migrate", {
  env: { ...process.env, DATABASE_URL: prodDbUrl },
});
log.success("Migrations applied");

/* --------------------------------- Deploy --------------------------------- */

log.step("Deploying the Worker...");
let workerUrl: string;
try {
  workerUrl = deployWorker();
  log.success("Deployed");
} catch (e) {
  bail(`Couldn't deploy the Worker:\n\n${errorMessage(e)}`);
}

/* ------------------------------ Worker secrets ---------------------------- */

log.step("Setting worker secrets...");
const workerSecrets: Record<string, string> = { DATABASE_URL: prodDbUrl };
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

outro(
  workerUrl ? `Live at ${workerUrl}` : "Deployed (see wrangler output above)",
);
