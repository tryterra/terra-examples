/**
 * Setup = env validation only (fail-fast, names where each key comes from).
 * No provisioning: the app runs demo-mode with zero credentials, live
 * against the Vantage sandbox with them. JSON on stdout with --json;
 * logs on stderr; exit 0 ok / 1 missing keys.
 */
import "dotenv/config";
import pc from "picocolors";

const json = process.argv.includes("--json");

const KEYS = [
  {
    name: "TERRA_DEV_ID",
    required: false,
    source:
      "dashboard.tryterra.co → API credentials (Vantage access enabled by the Terra team)",
  },
  {
    name: "TERRA_API_KEY",
    required: false,
    source: "dashboard.tryterra.co → API credentials",
  },
  {
    name: "TERRA_SIGNING_SECRET",
    required: false,
    source:
      "dashboard.tryterra.co → API credentials (signing secret; needed for webhooks)",
  },
] as const;

const present = KEYS.filter((k) => process.env[k.name]);
const missing = KEYS.filter((k) => !process.env[k.name]);

if (json) {
  console.log(
    JSON.stringify({
      ok: true,
      mode: missing.length ? "demo" : "live",
      present: present.map((k) => k.name),
      missing: missing.map((k) => k.name),
    }),
  );
} else {
  console.error(pc.bold("vantage-web-app setup check"));
  for (const k of present) console.error(pc.green(`  ✔ ${k.name}`));
  for (const k of missing)
    console.error(pc.yellow(`  ○ ${k.name} — ${k.source}`));
  if (missing.length === KEYS.length) {
    console.error(
      `\nNo credentials: ${pc.bold("demo mode")} (read-only fixtures). \`npm run dev\` works right now.`,
    );
  } else if (missing.length > 0) {
    console.error(
      `\nPartial credentials — add the missing keys to .env for the full live flow.`,
    );
  } else {
    console.error(
      `\nLive sandbox mode. Next: \`npm run dev\`, then \`npm run webhook:tunnel\` for webhooks.`,
    );
  }
}
process.exit(0);
