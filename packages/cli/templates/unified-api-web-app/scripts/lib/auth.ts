import { isCancel, select } from "@clack/prompts";
import {
  bail,
  commandSucceeds,
  runCaptureAsync,
  runVisible,
  updateEnvValue,
  type Env,
} from "./helpers";
import { getReporter, isInteractive } from "./output";
import { suppressSkillsPrompt } from "./wrangler";

type Account = { name: string; id: string };

/** Parses the account name/id rows from `wrangler whoami` (empty = signed out). */
async function cloudflareAccounts(): Promise<Account[]> {
  let out: string;
  try {
    out = await runCaptureAsync("npx wrangler whoami 2>&1");
  } catch (e) {
    out = (e as { stdout?: Buffer }).stdout?.toString() ?? "";
  }
  const accounts: Account[] = [];
  for (const line of out.split("\n")) {
    const cells = line.split("│").map((c) => c.trim());
    const idx = cells.findIndex((c) => /^[0-9a-f]{32}$/i.test(c));
    if (idx > 0) accounts.push({ name: cells[idx - 1], id: cells[idx] });
  }
  return accounts;
}

/** Pins CLOUDFLARE_ACCOUNT_ID when the user has more than one account. */
async function chooseAccount(env: Env, accounts: Account[]): Promise<void> {
  if (env.CLOUDFLARE_ACCOUNT_ID) {
    process.env.CLOUDFLARE_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID;
    return;
  }
  if (accounts.length <= 1) return; // wrangler auto-selects a lone account
  if (!isInteractive())
    bail(
      `Multiple Cloudflare accounts — set CLOUDFLARE_ACCOUNT_ID to one of: ${accounts.map((a) => a.id).join(", ")}`,
    );
  const picked = await select({
    message: "Which Cloudflare account should we deploy to?",
    options: accounts.map((a) => ({
      value: a.id,
      label: `${a.name} (${a.id})`,
    })),
  });
  if (isCancel(picked)) bail("Setup cancelled.");
  process.env.CLOUDFLARE_ACCOUNT_ID = picked;
  updateEnvValue(".env", "CLOUDFLARE_ACCOUNT_ID", picked);
}

/** Ensures a Cloudflare session (API token or `wrangler login`) + account. */
export async function ensureCloudflareAuth(env: Env): Promise<void> {
  if (env.CLOUDFLARE_API_TOKEN) {
    process.env.CLOUDFLARE_API_TOKEN = env.CLOUDFLARE_API_TOKEN;
    if (env.CLOUDFLARE_ACCOUNT_ID)
      process.env.CLOUDFLARE_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID;
    return;
  }
  suppressSkillsPrompt();

  const s = getReporter().task();
  s.start("Checking Cloudflare sign-in");
  let accounts = await cloudflareAccounts();
  s.stop(
    accounts.length ? "Signed in to Cloudflare" : "Cloudflare sign-in needed",
  );

  if (!accounts.length) {
    if (!isInteractive())
      bail(
        "Not signed in to Cloudflare. Set CLOUDFLARE_API_TOKEN or run `npx wrangler login`.",
      );
    getReporter().step("Signing in to Cloudflare (opens your browser)…");
    runVisible("npx wrangler login");
    accounts = await cloudflareAccounts();
  }
  await chooseAccount(env, accounts);
}

/** Ensures a Neon session: API key if set, else `neonctl auth`. */
export async function ensureNeonAuth(env: Env): Promise<void> {
  if (env.NEON_API_KEY) {
    process.env.NEON_API_KEY = env.NEON_API_KEY;
    return;
  }
  const s = getReporter().task();
  s.start("Checking Neon sign-in");
  const signedIn = await commandSucceeds("npx neonctl me");
  s.stop(signedIn ? "Signed in to Neon" : "Neon sign-in needed");

  if (!signedIn) {
    if (!isInteractive())
      bail(
        "Not signed in to Neon. Set NEON_API_KEY or run `npx neonctl auth`.",
      );
    getReporter().step("Signing in to Neon (opens your browser)…");
    runVisible("npx neonctl auth");
  }
}
