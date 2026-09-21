// Token-mint server — a stand-in for YOUR backend.
//
// The browser must never hold your Terra x-api-key. In production this
// endpoint lives in your existing backend: any authenticated route that calls
// `POST https://ws.tryterra.co/auth/developer` with your dev-id + x-api-key
// headers and returns `{ token }` works — in any language (it's one HTTPS
// call). This ~50-line Express server is the smallest possible version of
// that; you'd normally put your own session/auth check in front of it.
//
// The only contract with the frontend is the HTTP shape:
//   POST /api/token  →  200 { "token": "..." }
// (see src/lib/stream.ts, which is the single place the frontend calls it).

import "dotenv/config";
import express from "express";

const TERRA_AUTH_URL = "https://ws.tryterra.co/auth/developer";

const DEV_ID = process.env.TERRA_DEV_ID;
const API_KEY = process.env.TERRA_API_KEY;

// Fail fast with an actionable message — this check is the entire setup UX.
if (!DEV_ID || !API_KEY) {
  console.error(
    "\n  Missing Terra credentials.\n\n" +
      "  Copy .env.example to .env and fill in TERRA_DEV_ID and TERRA_API_KEY\n" +
      "  from https://dashboard.tryterra.co → API keys.\n",
  );
  process.exit(1);
}

const app = express();

// Mints a single-use consumer ("developer") token. Terra consumes the token
// on a successful IDENTIFY, so the frontend requests a fresh one for every
// WebSocket connection attempt — never cache these.
app.post("/api/token", async (_req, res) => {
  try {
    const r = await fetch(TERRA_AUTH_URL, {
      method: "POST",
      headers: { "dev-id": DEV_ID, "x-api-key": API_KEY },
    });
    if (r.status === 403) {
      res.status(403).json({
        error: "Terra rejected the credentials. Check TERRA_DEV_ID and TERRA_API_KEY in .env",
      });
      return;
    }
    if (!r.ok) {
      res.status(502).json({ error: `Token mint failed (${r.status})` });
      return;
    }
    const { token } = (await r.json()) as { token: string };
    res.json({ token });
  } catch (err) {
    res.status(502).json({ error: `Could not reach Terra: ${String(err)}` });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Token server listening on http://localhost:${port}`);
});
