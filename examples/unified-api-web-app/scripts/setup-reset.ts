import { confirm, isCancel } from "@clack/prompts";
import { existsSync, rmSync } from "node:fs";
import { initScript } from "./lib/args";
import { ensureCloudflareAuth, ensureNeonAuth } from "./lib/auth";
import { bail, loadEnv, updateEnvValue } from "./lib/helpers";
import { deleteProject } from "./lib/neon";
import { deleteR2Bucket, deleteWorker, getWorkerName } from "./lib/wrangler";

const HELP = `
  npm run setup:reset — tear down the Neon project, Worker, and R2 bucket

  Usage
    npm run setup:reset -- [options]

  Options
    --dry-run     Report what would be deleted, then exit without deleting
    --yes, -y     Skip the confirmation (alias for RESET_CONFIRM=1)
    --json        Machine-readable result on stdout, logs on stderr
    -h, --help    Show this help
    -v, --version Show version

  Destructive: permanently deletes the database and all its data.

  Exit codes
    0  success   1  usage / refused without --yes   2  execution failure
`;

const { flags, reporter, interactive } = initScript(HELP, {
  "dry-run": { type: "boolean" },
});

reporter.intro("Terra Basecamp – Reset");

const env = loadEnv();
const appName = env.APP_NAME || getWorkerName();
const r2Bucket = "terra-webhooks";
const dryRun = Boolean(flags["dry-run"]);
const deleted = {
  neonProject: env.NEON_PROJECT_ID || null,
  worker: appName,
  r2Bucket,
};

reporter.warn(
  `This permanently deletes the Neon project "${appName}" (its database and\n` +
    `ALL data), the "${appName}" Worker, and the "${r2Bucket}" R2 bucket.\n` +
    "This cannot be undone.",
);

if (dryRun) {
  reporter.data({ ok: true, dryRun: true, deleted });
  reporter.outro("Dry run — nothing was deleted.");
  process.exit(0);
}

const confirmed =
  Boolean(flags.yes) ||
  env.RESET_CONFIRM === "1" ||
  process.env.RESET_CONFIRM === "1";

if (interactive && !confirmed) {
  const ok = await confirm({
    message: "Are you sure you want to continue?",
    initialValue: false,
  });
  if (isCancel(ok) || !ok) bail("Reset cancelled.");
} else if (!confirmed) {
  bail(
    "Refusing to reset non-interactively. Pass --yes (or set RESET_CONFIRM=1).",
  );
}

/* ------------------------------- Teardown --------------------------------- */

await ensureCloudflareAuth(env);
await ensureNeonAuth(env);

deleteWorker(appName);
deleteR2Bucket(r2Bucket);

if (env.NEON_PROJECT_ID) {
  deleteProject(env.NEON_PROJECT_ID);
} else {
  reporter.warn("No NEON_PROJECT_ID in .env — skipping Neon project deletion.");
}

/* ----------------------------- Clean up local ----------------------------- */

updateEnvValue(".env", "DATABASE_URL", "");
updateEnvValue(".env", "NEON_PROJECT_ID", "");

if (existsSync("dist")) {
  rmSync("dist", { recursive: true, force: true });
  reporter.success("Removed dist/");
}

reporter.data({ ok: true, dryRun: false, deleted });
reporter.outro("Reset complete! Run `npm run setup` to start fresh.");
