/** Lab report reads: per-patient session list, session detail, files. */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb, schema } from "../lib/db";
import { getAppEnv, isDemoMode } from "../lib/env";
import { getSession, listSessions } from "../lib/lab-reports";
import type { LabReportFilesResponse } from "../lib/terra/types";
import { respondTerraError } from "./respond";

const db = createDb();

export const labReportRoutes = new Hono()
  .get("/patients/:id/lab-reports", async (c) => {
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    try {
      const sessions = await listSessions(p.referenceId);
      return c.json({ sessions });
    } catch (err) {
      return respondTerraError(c, err);
    }
  })
  .get("/lab-reports/:sessionId", async (c) => {
    try {
      const session = await getSession(c.req.param("sessionId"));
      return c.json({ session });
    } catch (err) {
      return respondTerraError(c, err);
    }
  })
  // Presigned URLs expire — always fetched fresh, never cached.
  .get("/lab-reports/:sessionId/files", async (c) => {
    if (isDemoMode()) {
      return c.json(
        { error: "Original files are not available in demo mode." },
        503,
      );
    }
    const { client } = getAppEnv();
    try {
      const files = (await client.get(
        `/lab-reports/${c.req.param("sessionId")}/files`,
      )) as LabReportFilesResponse;
      return c.json(files);
    } catch (err) {
      return respondTerraError(c, err);
    }
  });
