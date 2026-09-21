/**
 * Setup = env check only. Names every key, where it comes from, and which
 * mode the app will run in. Exit 0 always — no key is strictly required:
 * without Terra credentials the app runs in demo mode on bundled sample
 * data. JSON on stdout with --json; logs on stderr.
 */
import "dotenv/config";
import pc from "picocolors";

const json = process.argv.includes("--json");

const KEYS = [
  {
    name: "TERRA_DEV_ID",
    source: "dashboard.tryterra.co, API credentials page",
    enables: "live Terra API (uploads, wearable connections)",
  },
  {
    name: "TERRA_API_KEY",
    source: "dashboard.tryterra.co, API credentials page",
    enables: "live Terra API (uploads, wearable connections)",
  },
  {
    name: "ANTHROPIC_API_KEY",
    source: "console.anthropic.com",
    enables: "live AI brief, chat and wearable-signal insights",
  },
] as const;

const missing = KEYS.filter((k) => !process.env[k.name]).map((k) => k.name);
const demo =
  missing.includes("TERRA_DEV_ID") || missing.includes("TERRA_API_KEY");
const ai = !missing.includes("ANTHROPIC_API_KEY");

if (json) {
  console.log(JSON.stringify({ ok: true, demo, ai, missing }));
} else {
  console.error("");
  for (const k of KEYS) {
    const set = !missing.includes(k.name);
    console.error(
      `  ${set ? pc.green("set    ") : pc.yellow("missing")} ${k.name.padEnd(20)} ${pc.dim(`${k.source} — ${k.enables}`)}`,
    );
  }
  console.error("");
  console.error(
    demo
      ? pc.yellow(
          "  Mode: DEMO — bundled sample data, read-only. Fill .env (see .env.example) to go live.",
        )
      : pc.green("  Mode: LIVE Terra API."),
  );
  console.error(
    ai
      ? pc.green("  AI: live (brief regeneration + chat enabled).")
      : pc.dim(
          "  AI: pre-generated content only (add ANTHROPIC_API_KEY for live chat).",
        ),
  );
  console.error("");
  console.error(pc.dim("  Start the app:  npm run dev"));
  console.error("");
}
process.exit(0);
