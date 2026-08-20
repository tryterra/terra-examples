/**
 * Report upload + progress polling.
 *
 * Upload returns an `upload_id`, not a session: one file can fan out to N
 * sessions, and the reference_id list is eventually consistent. The client
 * therefore polls GET /api/uploads/:uploadId (which queries Terra by
 * upload_id) until every fanned-out session reaches a terminal status.
 */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb, schema } from "../lib/db";
import { getAppEnv, isDemoMode } from "../lib/env";
import { cacheIfTerminal } from "../lib/lab-reports";
import {
  TERMINAL_LAB_STATUSES,
  type LabReportListResponse,
  type LabReportUploadResponse,
} from "../lib/terra/types";
import { respondTerraError } from "./respond";

const db = createDb();

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const MAX_BYTES = 20 * 1024 * 1024;

export const uploadRoutes = new Hono()
  .post("/patients/:id/upload", async (c) => {
    if (isDemoMode()) {
      return c.json(
        {
          error:
            "Demo mode is read-only. Add Terra credentials in .env to upload reports.",
        },
        503,
      );
    }
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);

    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "Attach a report file under `file`." }, 400);
    }
    if (!ACCEPTED_TYPES.has(file.type)) {
      return c.json(
        { error: "Only PDF, PNG, JPEG, GIF or WebP reports are accepted." },
        400,
      );
    }
    if (file.size > MAX_BYTES) {
      return c.json({ error: "That file is over the 20 MB limit." }, 400);
    }

    const { client } = getAppEnv();
    const terraForm = new FormData();
    terraForm.append("file", file, file.name);
    try {
      const res = (await client.postMultipart("/lab-reports", terraForm, {
        reference_id: p.referenceId,
      })) as LabReportUploadResponse;
      await db.insert(schema.upload).values({
        uploadId: res.upload_id,
        patientId: p.id,
        fileName: file.name,
      });
      return c.json(
        { uploadId: res.upload_id, currentStatus: res.current_status },
        202,
      );
    } catch (err) {
      return respondTerraError(c, err);
    }
  })
  .get("/uploads/:uploadId", async (c) => {
    const uploadId = c.req.param("uploadId");
    const [row] = await db
      .select()
      .from(schema.upload)
      .where(eq(schema.upload.uploadId, uploadId));
    const { client } = getAppEnv();
    try {
      const res = (await client.get("/lab-reports", {
        upload_id: uploadId,
      })) as LabReportListResponse;
      const sessions = res.sessions ?? [];
      // Terminal sessions get their full payload cached right away so the
      // report page is instant and the roster list sees them immediately.
      for (const s of sessions) {
        if (TERMINAL_LAB_STATUSES.has(s.current_status)) {
          const full = await client.get(`/lab-reports/${s.session_id}`);
          await cacheIfTerminal(full as typeof s);
        }
      }
      const done =
        sessions.length > 0 &&
        sessions.every((s) => TERMINAL_LAB_STATUSES.has(s.current_status));
      return c.json({
        uploadId,
        fileName: row?.fileName ?? null,
        // Empty right after the 202 (eventually-consistent list) — the
        // client keeps polling until sessions appear AND all are terminal.
        sessions: sessions.map((s) => ({
          sessionId: s.session_id,
          status: s.current_status,
          statusHistory: s.status_history ?? [],
          resultsCount: s.results_count ?? null,
        })),
        done,
      });
    } catch (err) {
      return respondTerraError(c, err);
    }
  });
