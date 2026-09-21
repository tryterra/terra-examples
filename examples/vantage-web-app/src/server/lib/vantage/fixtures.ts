/**
 * Demo-mode fetch interceptor: a GET-URL → captured-sandbox-JSON map, injected
 * into createVantageClient as fetchImpl when no credentials are configured.
 *
 * ponytail: read-only ceiling by design. No state machine, no fake mutations —
 * POST/PUT/PATCH return 403 so mutating UI stays visibly disabled in demo
 * mode. Add real sandbox credentials to go live; do not extend this file.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Ordered [pattern, fixture file] — first match wins. */
const ROUTES: Array<[RegExp, string]> = [
  [/\/products\/\d+\/variants$/, "variants-10001.json"],
  [/\/products\/1$/, "products-type-1.json"],
  [/\/products\/\d+$/, "products-type-1.json"],
  [/\/products$/, "products.json"],
  // Specific bound-lab order first: the GO_TO_LAB demo shows confirmed_lab.
  [/\/orders\/338735426810802176$/, "order-detail-gotolab.json"],
  [/\/orders\/\d+$/, "order-detail.json"],
  [/\/orders$/, "orders.json"],
  [/\/results\/\d+$/, "result-url.json"],
  [/\/results$/, "results.json"],
  [/\/labs$/, "labs.json"],
  [/\/overview$/, "overview.json"],
  [/\/webhook-deliveries$/, "webhook-deliveries.json"],
  [/\/clients\/webhook-url$/, "webhook-url.json"],
];

export const demoFetch: typeof fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  const method = init?.method ?? "GET";
  if (method !== "GET") {
    return Response.json(
      {
        title: "Demo mode",
        status: 403,
        detail:
          "Demo mode is read-only. Add sandbox credentials to place orders.",
      },
      { status: 403 },
    );
  }
  const hit = ROUTES.find(([re]) => re.test(url.pathname));
  if (!hit) {
    return Response.json(
      {
        title: "Not Found",
        status: 404,
        detail: "No demo fixture for this route.",
      },
      { status: 404 },
    );
  }
  return Response.json(
    JSON.parse(readFileSync(join(FIXTURES_DIR, hit[1]), "utf8")),
  );
};
