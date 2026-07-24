/**
 * Ops-console routes — the partner side: monitoring, order operations,
 * sandbox simulation, catalog curation, webhook config, and the local
 * webhook inbox. Thin: validation + lib calls.
 */
import { zValidator } from "@hono/zod-validator";
import { desc } from "drizzle-orm";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { createDb, schema } from "../lib/db";
import { getAppEnv } from "../lib/env";
import {
  listProducts,
  listProductTypes,
  setCatalogSelection,
} from "../lib/vantage/catalog";
import { activateKit, getOrder, listOrders } from "../lib/vantage/orders";
import { getOverview, listWebhookDeliveries } from "../lib/vantage/monitoring";
import { listResults } from "../lib/vantage/results";
import {
  SIMULATE_ORDER_EVENTS,
  SIMULATE_RESULT_EVENTS,
  simulateOrderEvent,
} from "../lib/vantage/simulate";
import { getWebhookUrl, setWebhookUrl } from "../lib/vantage/webhook-config";
import { respondVantageError } from "./respond";

export const opsRoutes = new Hono()
  .get("/config", (c) => {
    const { demoMode, sandbox } = getAppEnv();
    return c.json({
      demoMode,
      sandbox,
      simulateEvents: {
        order: SIMULATE_ORDER_EVENTS,
        results: SIMULATE_RESULT_EVENTS,
      },
    });
  })
  .get(
    "/orders",
    zValidator(
      "query",
      z.object({
        cursor: z.string().optional(),
        status: z.string().optional(),
        collectionType: z.enum(["AT_HOME", "GO_TO_LAB"]).optional(),
        since: z.string().optional(),
        missing: z.coerce.boolean().optional(),
      }),
    ),
    async (c) => {
      try {
        return c.json(
          await listOrders(getAppEnv().client, {
            limit: 25,
            ...c.req.valid("query"),
          }),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get("/orders/:orderId", async (c) => {
    try {
      return c.json(await getOrder(getAppEnv().client, c.req.param("orderId")));
    } catch (e) {
      return respondVantageError(c, e);
    }
  })
  .post(
    "/orders/:orderId/simulate",
    zValidator(
      "json",
      z.object({
        event: z.enum([...SIMULATE_ORDER_EVENTS, ...SIMULATE_RESULT_EVENTS]),
        orderItemId: z.string().optional(),
      }),
    ),
    async (c) => {
      const { client, sandbox } = getAppEnv();
      // Simulate exists only outside production (403 there) — don't even try.
      if (!sandbox)
        return c.json(
          {
            error: "Simulation is only available in sandbox.",
            category: "forbidden",
            invalidFields: [],
          },
          403,
        );
      const { event, orderItemId } = c.req.valid("json");
      try {
        return c.json(
          await simulateOrderEvent(client, c.req.param("orderId"), event, {
            orderItemId,
          }),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  // Programmatic activation — the API alternative to the hosted QR page.
  .post(
    "/orders/:orderId/activate",
    zValidator(
      "json",
      z.object({
        supplierKitId: z.string().min(1),
        address: z.object({
          address_line_1: z.string().min(1),
          address_line_2: z.string().optional(),
          city: z.string().min(1),
          administrative_area: z.string(),
          country_code: z.string().length(2),
          postal_code: z.string().min(1),
        }),
      }),
    ),
    async (c) => {
      const { supplierKitId, address } = c.req.valid("json");
      try {
        return c.json(
          await activateKit(getAppEnv().client, {
            supplier_kit_id: supplierKitId,
            address,
          }),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get("/catalog", async (c) => {
    try {
      const { client } = getAppEnv();
      const types = await listProductTypes(client);
      // A product type with no products currently 404s (should be []); tolerate
      // it per-type so one empty category doesn't fail the whole catalog.
      const perType = await Promise.allSettled(
        types.map((t) =>
          t.id
            ? listProducts(client, t.id, { showAll: true })
            : Promise.resolve([]),
        ),
      );
      const products = perType.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      );
      return c.json({ types, products });
    } catch (e) {
      return respondVantageError(c, e);
    }
  })
  .put(
    "/catalog/selection",
    zValidator("json", z.object({ productIds: z.array(z.string()) })),
    async (c) => {
      try {
        return c.json(
          await setCatalogSelection(
            getAppEnv().client,
            c.req.valid("json").productIds,
          ),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  // Results queue: ready-but-unacknowledged is the actionable slice.
  .get(
    "/results",
    zValidator(
      "query",
      z.object({
        status: z.string().optional(),
        cursor: z.string().optional(),
      }),
    ),
    async (c) => {
      try {
        return c.json(
          await listResults(getAppEnv().client, {
            limit: 25,
            ...c.req.valid("query"),
          }),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get("/overview", async (c) => {
    try {
      return c.json(await getOverview(getAppEnv().client));
    } catch (e) {
      return respondVantageError(c, e);
    }
  })
  .get(
    "/deliveries",
    zValidator(
      "query",
      z.object({
        outcome: z
          .enum([
            "delivered",
            "rejected",
            "invalid",
            "dead_lettered",
            "replayed",
            "failed",
          ])
          .optional(),
        cursor: z.string().optional(),
      }),
    ),
    async (c) => {
      try {
        return c.json(
          await listWebhookDeliveries(getAppEnv().client, {
            limit: 25,
            ...c.req.valid("query"),
          }),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get("/webhook-url", async (c) => {
    try {
      return c.json(await getWebhookUrl(getAppEnv().client));
    } catch (e) {
      return respondVantageError(c, e);
    }
  })
  .patch(
    "/webhook-url",
    zValidator(
      "json",
      z.object({
        url: z.string().url().startsWith("https://").or(z.literal("")),
      }),
    ),
    async (c) => {
      try {
        return c.json(
          await setWebhookUrl(getAppEnv().client, c.req.valid("json").url),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  // Local webhook inbox (what OUR endpoint received — deliveries above is
  // what Vantage recorded about sending; the pair teaches the difference).
  .get("/inbox", async (c) => {
    const rows = await createDb()
      .select()
      .from(schema.webhookEvent)
      .orderBy(desc(schema.webhookEvent.receivedAt))
      .limit(100);
    return c.json({ events: rows });
  })
  // Demo-mode stand-in for the presigned FHIR download.
  .get("/demo/fhir-bundle", (c) => {
    const p = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "lib",
      "vantage",
      "fixtures",
      "fhir-bundle.json",
    );
    return c.json(JSON.parse(readFileSync(p, "utf8")));
  });
