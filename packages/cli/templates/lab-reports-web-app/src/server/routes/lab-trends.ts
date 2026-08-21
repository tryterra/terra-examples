/** Cross-report biomarker trends per patient. */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb, schema } from "../lib/db";
import { getBiomarkerTrends } from "../lib/lab-trends";
import { respondTerraError } from "./respond";

const db = createDb();

export const labTrendRoutes = new Hono().get(
  "/patients/:id/lab-trends",
  async (c) => {
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    try {
      const trends = await getBiomarkerTrends(p.referenceId);
      return c.json({ trends });
    } catch (err) {
      return respondTerraError(c, err);
    }
  },
);
