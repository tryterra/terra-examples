/** Pre-draw wearable context per lab report. */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb, schema } from "../lib/db";
import { getDrawContexts } from "../lib/draw-context";
import { respondTerraError } from "./respond";

const db = createDb();

export const drawContextRoutes = new Hono().get(
  "/patients/:id/draw-context",
  async (c) => {
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    try {
      return c.json({ contexts: await getDrawContexts(p.referenceId) });
    } catch (err) {
      return respondTerraError(c, err);
    }
  },
);
