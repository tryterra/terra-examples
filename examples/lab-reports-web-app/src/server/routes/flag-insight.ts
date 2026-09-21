/** AI wearable-signal insight for one flagged biomarker. */
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb, schema } from "../lib/db";
import { aiEnabled } from "../lib/ai";
import { getOrGenerateFlagInsight } from "../lib/flag-insight";
import { respondTerraError } from "./respond";

const db = createDb();

export const flagInsightRoutes = new Hono().get(
  "/patients/:id/flag-insight",
  zValidator("query", z.object({ biomarker: z.string().min(1).max(80) })),
  async (c) => {
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    try {
      const insight = await getOrGenerateFlagInsight(
        p.id,
        p.referenceId,
        c.req.valid("query").biomarker,
      );
      if (!insight) {
        // Without a key there is nothing to generate with — the panel hides.
        if (!aiEnabled()) return c.json({ enabled: false as const });
        return c.json({ error: "No trend data for this biomarker." }, 404);
      }
      return c.json({ enabled: true as const, insight });
    } catch (err) {
      if (err instanceof Error && !("category" in err)) {
        return c.json({ error: err.message }, 502);
      }
      return respondTerraError(c, err);
    }
  },
);
