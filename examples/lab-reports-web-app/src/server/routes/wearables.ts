/** Wearable summary per patient: snapshot + daily series over a window. */
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb, schema } from "../lib/db";
import {
  getFirstWearableDataDate,
  getWearableSummary,
  windowFromDays,
} from "../lib/wearables";
import { respondTerraError } from "./respond";

const db = createDb();

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const wearableRoutes = new Hono().get(
  "/patients/:id/wearables",
  zValidator(
    "query",
    z.object({
      days: z.string().optional(),
      start: z.string().regex(DATE).optional(),
      end: z.string().regex(DATE).optional(),
    }),
  ),
  async (c) => {
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    const q = c.req.valid("query");

    let window;
    if (q.start && q.end && q.start <= q.end) {
      // Explicit calendar range — uncapped; fetches run in 28-day chunks
      // and land in the per-day cache, so only the first load pays.
      window = { start: q.start, end: q.end };
    } else if (q.days === "full") {
      // Everything since the patient's first recorded wearable day.
      const first = await getFirstWearableDataDate(p.referenceId);
      window = first
        ? { start: first, end: windowFromDays(1).end }
        : windowFromDays(90);
    } else {
      const days = Math.min(3650, Math.max(7, Number(q.days ?? 30) || 30));
      window = windowFromDays(days);
    }

    try {
      const summary = await getWearableSummary(p.referenceId, window);
      return c.json(summary);
    } catch (err) {
      return respondTerraError(c, err);
    }
  },
);
