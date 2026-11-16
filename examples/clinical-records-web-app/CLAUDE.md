Read AGENTS.md first - it covers running the app (demo vs live), the Terra
API facts it relies on, the architecture, and the conventions that matter.

Quick facts:

- `npm run dev` works with zero credentials (demo mode, synthetic records).
- Typed end to end: Hono `AppType` on the server, `hc<AppType>` on the
  client - don't break the route chain in `src/server/index.ts`.
- FHIR parsing lives in `src/server/lib/clinical/fhir.ts` and must handle
  DSTU2 and R4; add a test in `fhir.test.ts` for every shape you support.
- Verify with `npm run typecheck && npm run lint && npm run test`.
