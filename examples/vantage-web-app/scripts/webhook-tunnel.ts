/**
 * Webhook upgrade: expose the local server via ngrok and register the tunnel
 * URL as this environment's Vantage webhook destination.
 *
 * Owns registration (setup.ts only validates env): the tunnel URL doesn't
 * exist until the tunnel is up. Requires the ngrok CLI to be installed and
 * authed (https://ngrok.com/download; `ngrok config add-authtoken ...`).
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import {
  createVantageClient,
  SANDBOX_BASE_URL,
} from "../src/server/lib/vantage/client";
import { setWebhookUrl } from "../src/server/lib/vantage/webhook-config";

const PORT = Number(process.env.PORT ?? 8787);

const devId = process.env.TERRA_DEV_ID;
const apiKey = process.env.TERRA_API_KEY;
if (!devId || !apiKey) {
  console.error(
    "Missing TERRA_DEV_ID / TERRA_API_KEY in .env — webhooks need live sandbox credentials.",
  );
  console.error(
    "Get them from dashboard.tryterra.co (Vantage access is enabled by the Terra team).",
  );
  process.exit(1);
}

console.error(`Starting ngrok tunnel → localhost:${PORT} …`);
const ngrok = spawn(
  "ngrok",
  ["http", String(PORT), "--log", "stdout", "--log-format", "json"],
  { stdio: ["ignore", "pipe", "inherit"] },
);

let registered = false;
ngrok.stdout.setEncoding("utf8");
ngrok.stdout.on("data", async (chunk: string) => {
  for (const line of chunk.split("\n")) {
    if (!line.trim() || registered) continue;
    try {
      const evt = JSON.parse(line);
      const url: string | undefined =
        evt.url ?? (evt.msg === "started tunnel" ? evt.addr : undefined);
      if (evt.msg === "started tunnel" && evt.url?.startsWith("https://")) {
        registered = true;
        const webhookUrl = `${evt.url}/api/webhook`;
        const client = createVantageClient({
          devId,
          apiKey,
          baseUrl: process.env.VANTAGE_BASE_URL ?? SANDBOX_BASE_URL,
        });
        await setWebhookUrl(client, webhookUrl);
        console.error(`✔ Tunnel up: ${evt.url}`);
        console.error(`✔ Registered webhook destination: ${webhookUrl}`);
        console.error(
          "Leave this running; Ctrl-C stops the tunnel (the registered URL then dead-letters until changed).",
        );
      }
      void url;
    } catch {
      // non-JSON log line — ignore
    }
  }
});

ngrok.on("exit", (code) => {
  if (!registered) {
    console.error(
      `ngrok exited (${code ?? "?"}) before a tunnel came up. Is the CLI installed and authed?`,
    );
  }
  process.exit(code ?? 0);
});
