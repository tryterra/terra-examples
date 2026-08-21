Read AGENTS.md first - it covers running the app (demo vs live), the
architecture, and the conventions that matter.

Quick facts:

- `npm run dev` works with zero credentials (demo mode, bundled sample db).
- Typed end to end: Hono `AppType` on the server, `hc<AppType>` on the
  client - don't break the route chain in `src/server/index.ts`.
- Deterministic scoring lives in `src/server/lib/analysis/domains.ts`; the
  AI layer only narrates and selects, never invents numbers.
- Verify with `npm run typecheck && npm run lint && npm run test`.
