<p align="center">
  <a href="https://tryterra.co">
    <img src="./src/client/assets/terra-logo-sidebar.svg" height="72" alt="Terra">
  </a>
  <h3 align="center">Terra Dispatch</h3>
  <p align="center">A white-label diagnostics storefront and ops console built on Terra's <a href="https://docs.tryterra.co/vantage-api-docs">Vantage API</a> — order blood &amp; DNA test kits, track fulfilment, deliver FHIR results.</p>
</p>

**Demonstrates every Vantage capability:** catalog browse & curation, AT_HOME and
GO_TO_LAB ordering (with lab draw-site lookup), kit activation (hosted page +
programmatic), signed webhooks with verification and an inbox, order tracking
with status history, FHIR result parsing and display, the mandatory results
acknowledgment flow, escalations, sandbox lifecycle simulation, account
analytics, and webhook-delivery debugging.

|            |                                                                          |
| ---------- | ------------------------------------------------------------------------ |
| **Stack**  | React 19 · Hono · TanStack Router/Query · Drizzle (SQLite) · Tailwind v4 |
| **Runs**   | Locally against the hosted Vantage sandbox — no cloud accounts needed    |
| **Deploy** | Anywhere Hono runs (the API is a plain Hono app)                         |

## Quick start

```bash
npm install
npm run dev
```

That's it — with no credentials the app runs in **demo mode** (read-only, real
captured sandbox data) at http://localhost:5173.

### Go live on the sandbox

1. Copy `.env.example` → `.env` and fill `TERRA_DEV_ID` + `TERRA_API_KEY`
   (from [dashboard.tryterra.co](https://dashboard.tryterra.co); Vantage access
   is enabled by the Terra team — [account setup docs](https://docs.tryterra.co/vantage-api-docs/account-setup-and-api-keys)).
2. `npm run dev` — you can now browse the live catalog, place sandbox orders,
   and drive them with the ops console's **simulate** panel. Updates arrive by
   polling.
3. **Address autocomplete (optional):** works out of the box via the free
   Photon/OSM geocoder (keyless, demo-grade). Set `GOOGLE_PLACES_API_KEY` in
   `.env` for Google Places — the production-grade provider with
   rooftop-accurate delivery addresses.
4. **Webhooks (optional upgrade):** add `TERRA_SIGNING_SECRET` to `.env`,
   install + auth the [ngrok CLI](https://ngrok.com/download), then:
   ```bash
   npm run webhook:tunnel
   ```
   The script opens the tunnel and registers the URL with Vantage. Watch events
   land in `/ops/webhooks`.

## The two personas

- **`/shop` — Storefront** (what your end users would see): browse kits, order,
  track a kit's journey, view results, acknowledge them.
- **`/ops` — Ops console** (your team's view): overview analytics, orders table,
  lifecycle simulation, results queue, webhook inbox + delivery outcomes,
  catalog curation.

The persona switch is a demo device — there is deliberately **no auth
framework** in this example (see `AGENTS.md`).

## Scripts

| Script                                  | What it does                                              |
| --------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                           | API on :8787 + Vite SPA on :5173                          |
| `npm run setup`                         | Env check; names every key and where to get it            |
| `npm run webhook:tunnel`                | ngrok tunnel + registers the webhook URL                  |
| `npm run build` / `preview`             | Production build / serve                                  |
| `npm test`                              | Unit tests (signature verify, FHIR parsing, error triage) |
| `npm run typecheck` / `lint` / `format` | Hygiene                                                   |
| `npm run gen:types`                     | Regenerate API types from the vendored OpenAPI spec       |

## For AI coding agents

Read [`AGENTS.md`](./AGENTS.md) — it includes a **"Copy this, not that"** map of
the liftable integration code in `src/server/lib/vantage/` (one Vantage
capability per dependency-free file), and the principles this app encodes
(query-don't-mirror, IDs-are-strings, non-idempotent create, liability-bound
acknowledgment).
