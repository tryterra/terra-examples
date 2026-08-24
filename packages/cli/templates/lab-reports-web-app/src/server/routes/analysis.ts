/** Deterministic AI-style analysis per patient. */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb, schema } from "../lib/db";
import { analysePatient } from "../lib/analysis";
import { assessLabHistory } from "../lib/analysis/lab-history";
import { respondTerraError } from "./respond";

const db = createDb();

export const analysisRoutes = new Hono().get(
  "/patients/:id/analysis",
  async (c) => {
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    try {
      const [analysis, labAssessments] = await Promise.all([
        analysePatient(p.referenceId),
        assessLabHistory(p.referenceId),
      ]);
      return c.json({ ...analysis, labAssessments });
    } catch (err) {
      return respondTerraError(c, err);
    }
  },
);
