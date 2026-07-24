/**
 * Storefront routes — the end-user journey: browse → order → track →
 * results → acknowledge. Thin: validation + lib calls + local mapping rows.
 */
import { zValidator } from "@hono/zod-validator";
import { suggestAddresses } from "../lib/address-suggest";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb, schema } from "../lib/db";
import { getAppEnv } from "../lib/env";
import {
  listProducts,
  listProductTypes,
  listVariants,
} from "../lib/vantage/catalog";
import { parseFhirBundle } from "../lib/vantage/fhir";
import {
  activationPageUrl,
  createOrder,
  getOrder,
  listLabs,
} from "../lib/vantage/orders";
import {
  findOrderByReference,
  recoverTestTakers,
} from "../lib/vantage/reconcile";
import {
  acknowledgeResults,
  getResultDownloadUrl,
} from "../lib/vantage/results";
import { respondVantageError } from "./respond";

const addressSchema = z.object({
  address_line_1: z.string().min(1).max(100),
  address_line_2: z.string().max(100).optional(),
  city: z.string().min(1).max(50),
  administrative_area: z.string().max(50),
  country_code: z.string().length(2),
  postal_code: z.string().min(1),
});

const patientSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email().max(100),
  // Single E.164 string, the industry-standard phone shape (Stripe/Twilio).
  phoneNumber: z.string().regex(/^\+[1-9]\d{6,14}$/),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  genderAtBirth: z.enum(["male", "female"]),
});

export const storefrontRoutes = new Hono()
  .get("/catalog/types", async (c) => {
    try {
      return c.json(await listProductTypes(getAppEnv().client));
    } catch (e) {
      return respondVantageError(c, e);
    }
  })
  .get(
    "/catalog/products",
    zValidator("query", z.object({ typeId: z.coerce.number() })),
    async (c) => {
      try {
        return c.json(
          await listProducts(getAppEnv().client, c.req.valid("query").typeId),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get(
    "/catalog/variants",
    zValidator("query", z.object({ productId: z.coerce.number() })),
    async (c) => {
      try {
        return c.json(
          await listVariants(
            getAppEnv().client,
            c.req.valid("query").productId,
          ),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get(
    "/labs",
    zValidator(
      "query",
      z.object({ zip: z.string().regex(/^\d{5}(-\d{4})?$/) }),
    ),
    async (c) => {
      try {
        return c.json(
          await listLabs(getAppEnv().client, c.req.valid("query").zip),
        );
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get(
    "/address-suggest",
    zValidator(
      "query",
      z.object({
        q: z.string().min(2).max(120),
        countries: z.string().optional(),
        kind: z.enum(["street", "postal"]).optional(),
      }),
    ),
    async (c) => {
      const { q, countries, kind } = c.req.valid("query");
      try {
        return c.json(
          await suggestAddresses(
            q,
            countries ? countries.split(",") : [],
            kind,
          ),
        );
      } catch {
        return c.json([]); // suggestions are best-effort; never block the form
      }
    },
  )
  .get("/patients", async (c) => {
    const rows = await createDb()
      .select()
      .from(schema.patient)
      .orderBy(desc(schema.patient.createdAt));
    return c.json(rows);
  })
  .post("/patients", zValidator("json", patientSchema), async (c) => {
    const p = c.req.valid("json");
    const id = crypto.randomUUID();
    await createDb()
      .insert(schema.patient)
      .values({ id, ...p });
    return c.json({ id }, 201);
  })
  .post(
    "/orders",
    zValidator(
      "json",
      z.object({
        patientId: z.string(),
        variantId: z.string(),
        collectionType: z.enum(["AT_HOME", "GO_TO_LAB"]),
        address: addressSchema,
        // The draw site the user picked from the labs list (GO_TO_LAB) —
        // binds the order to that site server-side.
        requestedLab: z
          .object({
            code: z.string().min(1),
            postal_code: z.string().optional(),
          })
          .optional(),
        clientOrderReferenceId: z.string().min(1).max(100),
        // Unique per order attempt; makes retries replay instead of re-order.
        idempotencyKey: z.string().uuid().optional(),
      }),
    ),
    async (c) => {
      const db = createDb();
      const body = c.req.valid("json");
      const [p] = await db
        .select()
        .from(schema.patient)
        .where(eq(schema.patient.id, body.patientId));
      if (!p)
        return c.json(
          {
            error: "Unknown patient",
            category: "not_found",
            invalidFields: [],
          },
          404,
        );
      try {
        const res = await createOrder(
          getAppEnv().client,
          {
            client_order_reference_id: body.clientOrderReferenceId,
            collection_type: body.collectionType,
            recipient: {
              first_name: p.firstName,
              last_name: p.lastName,
              email: p.email,
              // Legacy patient rows predate the E.164 form and stored national
              // digits + a separate country code — join them on the way out.
              phone_number: p.phoneNumber.startsWith("+")
                ? p.phoneNumber
                : `+${p.countryCode ?? "1"}${p.phoneNumber}`,
              date_of_birth: p.dateOfBirth,
              gender_at_birth: p.genderAtBirth,
            },
            ...(body.collectionType === "AT_HOME"
              ? { shipping_address: body.address }
              : {
                  requested_lab_address: body.address,
                  ...(body.requestedLab
                    ? { requested_lab: body.requestedLab }
                    : {}),
                }),
            items: [{ variant_id: body.variantId, quantity: 1 }],
          },
          body.idempotencyKey,
        );
        // Record the patient ↔ order_item mapping — the one thing Vantage
        // can't hold for us. Everything else about the order stays in Vantage.
        for (const item of res.order_items ?? []) {
          if (res.order_id && item.order_item_id) {
            await db
              .insert(schema.patientOrderItem)
              .values({
                patientId: p.id,
                orderId: res.order_id,
                orderItemId: item.order_item_id,
              })
              .onConflictDoNothing();
          }
        }
        return c.json(res, 201);
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  // Safe-retry reconcile: did my reference already become an order?
  .get(
    "/orders/by-reference",
    zValidator("query", z.object({ reference: z.string().min(1) })),
    async (c) => {
      try {
        const hit = await findOrderByReference(
          getAppEnv().client,
          c.req.valid("query").reference,
        );
        return c.json({ order: hit ?? null });
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get(
    "/kits",
    zValidator("query", z.object({ patientId: z.string() })),
    async (c) => {
      const db = createDb();
      const rows = await db
        .select()
        .from(schema.patientOrderItem)
        .where(
          eq(schema.patientOrderItem.patientId, c.req.valid("query").patientId),
        )
        .orderBy(desc(schema.patientOrderItem.createdAt));
      try {
        // Vantage holds the truth about each order; fetch per distinct order.
        const orders = new Map<string, Awaited<ReturnType<typeof getOrder>>>();
        for (const orderId of new Set(rows.map((r) => r.orderId))) {
          orders.set(orderId, await getOrder(getAppEnv().client, orderId));
        }
        const kits = rows.map((r) => {
          const order = orders.get(r.orderId);
          const item = order?.items?.find(
            (i) => i.order_item_id === r.orderItemId,
          );
          return { mapping: r, order_status: order?.order_status, item };
        });
        return c.json({ kits });
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  )
  .get("/kits/:orderItemId", async (c) => {
    const db = createDb();
    const [row] = await db
      .select()
      .from(schema.patientOrderItem)
      .where(
        eq(schema.patientOrderItem.orderItemId, c.req.param("orderItemId")),
      );
    if (!row)
      return c.json(
        { error: "Unknown kit", category: "not_found", invalidFields: [] },
        404,
      );
    try {
      const { client } = getAppEnv();
      const order = await getOrder(client, row.orderId);
      const item = order.items?.find(
        (i) => i.order_item_id === row.orderItemId,
      );
      const kitId = item?.supplier_item_id;
      return c.json({
        mapping: row,
        order,
        item,
        activationUrl: kitId ? activationPageUrl(client.baseUrl, kitId) : null,
      });
    } catch (e) {
      return respondVantageError(c, e);
    }
  })
  .get("/kits/:orderItemId/result", async (c) => {
    const db = createDb();
    const [row] = await db
      .select()
      .from(schema.patientOrderItem)
      .where(
        eq(schema.patientOrderItem.orderItemId, c.req.param("orderItemId")),
      );
    if (!row) {
      return c.json(
        { error: "Unknown kit", category: "not_found", invalidFields: [] },
        404,
      );
    }
    // Webhooks are the fast path for learning test_taker_id; recovery from
    // the order itself is the safety net (missed webhook / polling-only).
    if (!row.testTakerId) {
      const recovered = await recoverTestTakers(
        getAppEnv().client,
        row.orderId,
      );
      const ids = recovered.get(row.orderItemId) ?? [];
      if (ids[0]) {
        await db
          .update(schema.patientOrderItem)
          .set({ testTakerId: ids[0] })
          .where(eq(schema.patientOrderItem.orderItemId, row.orderItemId));
        row.testTakerId = ids[0];
      }
    }
    if (!row.testTakerId) {
      return c.json(
        {
          error: "No test taker registered yet — activate the kit first.",
          category: "not_found",
          invalidFields: [],
        },
        404,
      );
    }
    try {
      const { client } = getAppEnv();
      // Presigned URLs expire in 15 minutes — always re-fetch, never store.
      const url = await getResultDownloadUrl(
        client,
        row.orderItemId,
        row.testTakerId,
      );
      const target = url.download_url?.startsWith("/")
        ? new URL(url.download_url, c.req.url).toString()
        : url.download_url;
      if (!target) throw new Error("missing download_url");
      const dl = await fetch(target);
      // Presigned URLs expire in 15 minutes; a stale one comes back non-2xx.
      if (!dl.ok) throw new Error(`result download failed (${dl.status})`);
      const bundle = await dl.json();
      const order = await getOrder(client, row.orderId);
      const history = (order.status_history ?? []).filter(
        (h) => !h.order_item_id || h.order_item_id === row.orderItemId,
      );
      const escalation = history.find(
        (h) => h.status === "results.escalation_raised",
      );
      return c.json({
        parsed: parseFhirBundle(bundle),
        testTakerId: row.testTakerId,
        escalation: escalation
          ? {
              level: escalation.escalation_level,
              dueBy: escalation.acknowledgment_due_by,
            }
          : null,
      });
    } catch (e) {
      return respondVantageError(c, e);
    }
  })
  // DEMO SWITCH — replace with real auth. Acknowledgment is liability-bound
  // and must be tied to an authenticated end user in production; here the
  // caller passes the test_taker_id it learned from the kit endpoints.
  .post(
    "/kits/:orderItemId/acknowledge",
    zValidator(
      "json",
      z.object({ testTakerId: z.string(), confirmed: z.literal(true) }),
    ),
    async (c) => {
      try {
        const res = await acknowledgeResults(
          getAppEnv().client,
          c.req.param("orderItemId"),
          c.req.valid("json").testTakerId,
        );
        return c.json(res);
      } catch (e) {
        return respondVantageError(c, e);
      }
    },
  );
