import { initScript } from "./lib/args";
import { ensureNeonAuth } from "./lib/auth";
import { bail, loadEnv, runVisible } from "./lib/helpers";
import { connectionString } from "./lib/neon";
import { EXIT } from "./lib/output";

const HELP = `
  npm run db:migrate:prod — apply Drizzle migrations to the production branch

  Usage
    npm run db:migrate:prod -- [options]

  Options
    --json        Machine-readable result on stdout, logs on stderr
    -h, --help    Show this help
    -v, --version Show version

  Requires a completed setup (NEON_PROJECT_ID in .env).

  Exit codes
    0  success   1  usage / missing setup   2  migration failure
`;

const { reporter } = initScript(HELP);

const env = loadEnv();
await ensureNeonAuth(env);

if (!env.NEON_PROJECT_ID) {
  bail("Missing NEON_PROJECT_ID in .env. Run: npm run setup");
}

reporter.step("Applying migrations to the production branch...");
try {
  runVisible("npx drizzle-kit migrate", {
    env: {
      ...process.env,
      DATABASE_URL: connectionString(env.NEON_PROJECT_ID),
    },
  });
} catch {
  bail("Production migration failed. Check the errors above.", EXIT.RUNTIME);
}

reporter.data({ ok: true });
reporter.success("Migrations applied");
