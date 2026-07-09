import { ensureNeonAuth } from "./lib/auth";
import { bail, loadEnv, runVisible } from "./lib/helpers";
import { connectionString } from "./lib/neon";

const env = loadEnv();
await ensureNeonAuth(env);

if (!env.NEON_PROJECT_ID) {
  bail("Missing NEON_PROJECT_ID in .env. Run: npm run setup");
}

runVisible("npx drizzle-kit migrate", {
  env: {
    ...process.env,
    DATABASE_URL: connectionString(env.NEON_PROJECT_ID),
  },
});
