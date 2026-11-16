/**
 * Setup = env check only. Names every key, where it comes from, and which
 * mode the app will run in. Exit 0 always - no key is strictly required:
 * without Terra credentials the app runs in demo mode on synthetic records.
 * JSON on stdout with --json; logs on stderr.
 */
import "dotenv/config";
import pc from "picocolors";

const json = process.argv.includes("--json");

const KEYS = [
  {
    name: "TERRA_DEV_ID",
    source: "dashboard.tryterra.co, API credentials page",
    enables: "live pull-API backfills (enable CLINICAL_RECORD too)",
  },
  {
    name: "TERRA_API_KEY",
    source: "dashboard.tryterra.co, API credentials page",
    enables: "live pull-API backfills (enable CLINICAL_RECORD too)",
  },
  {
    name: "TERRA_WEBHOOK_SECRET",
    source: "dashboard.tryterra.co, webhook destination",
    enables: "POST /api/webhook (clinical_record updates)",
  },
] as const;

const missing = KEYS.filter((k) => !process.env[k.name]).map((k) => k.name);
const demo =
  missing.includes("TERRA_DEV_ID") || missing.includes("TERRA_API_KEY");
const webhooks = !missing.includes("TERRA_WEBHOOK_SECRET");

if (json) {
  console.log(JSON.stringify({ ok: true, demo, webhooks, missing }));
} else {
  console.error("");
  for (const k of KEYS) {
    const set = !missing.includes(k.name);
    console.error(
      `  ${set ? pc.green("set    ") : pc.yellow("missing")} ${k.name.padEnd(22)} ${pc.dim(`${k.source} - ${k.enables}`)}`,
    );
  }
  console.error("");
  console.error(
    demo
      ? pc.yellow(
          "  Mode: DEMO - synthetic Apple Health Records, read-only. Fill .env (see .env.example) to go live.",
        )
      : pc.green("  Mode: LIVE Terra API."),
  );
  console.error(
    webhooks
      ? pc.green("  Webhooks: enabled at POST /api/webhook.")
      : pc.dim(
          "  Webhooks: off (add TERRA_WEBHOOK_SECRET to receive updates).",
        ),
  );
  console.error("");
  console.error(pc.dim("  Start the app:  npm run dev"));
  console.error("");
}
process.exit(0);
