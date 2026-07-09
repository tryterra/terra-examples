import { cancel, confirm, intro, isCancel, log, outro } from "@clack/prompts";
import { existsSync, rmSync } from "node:fs";
import { ensureCloudflareAuth, ensureNeonAuth } from "./lib/auth";
import { bail, loadEnv, updateEnvValue } from "./lib/helpers";
import { deleteProject } from "./lib/neon";
import { deleteR2Bucket, deleteWorker, getWorkerName } from "./lib/wrangler";

const interactive = Boolean(process.stdin.isTTY);

intro("Terra Basecamp – Reset");

const env = loadEnv();
const appName = env.APP_NAME || getWorkerName();

log.warn(
  `This permanently deletes the Neon project "${appName}" (its database and\n` +
    `ALL data), the "${appName}" Worker, and the "terra-webhooks" R2 bucket.\n` +
    "This cannot be undone.",
);

if (interactive) {
  const ok = await confirm({
    message: "Are you sure you want to continue?",
    initialValue: false,
  });
  if (isCancel(ok) || !ok) {
    cancel("Reset cancelled.");
    process.exit(0);
  }
} else if (env.RESET_CONFIRM !== "1" && process.env.RESET_CONFIRM !== "1") {
  bail("Refusing to reset non-interactively. Set RESET_CONFIRM=1 to proceed.");
}

/* ------------------------------- Teardown --------------------------------- */

await ensureCloudflareAuth(env);
await ensureNeonAuth(env);

deleteWorker(appName);
deleteR2Bucket("terra-webhooks");

if (env.NEON_PROJECT_ID) {
  deleteProject(env.NEON_PROJECT_ID);
} else {
  log.warn("No NEON_PROJECT_ID in .env — skipping Neon project deletion.");
}

/* ----------------------------- Clean up local ----------------------------- */

updateEnvValue(".env", "DATABASE_URL", "");
updateEnvValue(".env", "NEON_PROJECT_ID", "");

if (existsSync("dist")) {
  rmSync("dist", { recursive: true, force: true });
  log.success("Removed dist/");
}

outro("Reset complete! Run `npm run setup` to start fresh.");
