/**
 * AI endpoints. GET generates the overview on first sight of new data
 * (cached by input hash after that); POST forces a regeneration.
 */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb, schema } from "../lib/db";
import {
  aiEnabled,
  getLatestCachedOverview,
  getOrGenerateOverview,
} from "../lib/ai";

const db = createDb();

async function findPatient(id: string) {
  const [p] = await db
    .select()
    .from(schema.patient)
    .where(eq(schema.patient.id, id));
  return p;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "AI generation failed.";
}

export const aiRoutes = new Hono()
  .get("/patients/:id/ai/overview", async (c) => {
    const p = await findPatient(c.req.param("id"));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    // No key: serve the newest pre-generated brief (demo mode) or hide.
    if (!aiEnabled()) {
      const cached = await getLatestCachedOverview(p.id);
      return cached
        ? c.json({ enabled: true as const, overview: cached, live: false })
        : c.json({ enabled: false as const });
    }
    try {
      const overview = await getOrGenerateOverview(p);
      return c.json({ enabled: true as const, overview, live: true });
    } catch (err) {
      console.error("ai_overview_error", err);
      return c.json({ error: errorMessage(err) }, 502);
    }
  })
  .post("/patients/:id/ai/overview", async (c) => {
    const p = await findPatient(c.req.param("id"));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    if (!aiEnabled()) {
      const cached = await getLatestCachedOverview(p.id);
      return cached
        ? c.json({ enabled: true as const, overview: cached, live: false })
        : c.json({ enabled: false as const });
    }
    try {
      const overview = await getOrGenerateOverview(p, true);
      return c.json({ enabled: true as const, overview, live: true });
    } catch (err) {
      console.error("ai_overview_error", err);
      return c.json({ error: errorMessage(err) }, 502);
    }
  });
