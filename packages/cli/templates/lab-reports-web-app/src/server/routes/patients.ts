/**
 * Roster routes. The patient table is app-owned (Terra stores no names);
 * everything Terra-side hangs off patient.referenceId.
 */
import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb, schema } from "../lib/db";
import { getAppEnv, isDemoMode } from "../lib/env";
import { invalidateConnections } from "../lib/terra/user-info";
import { getEffectiveConnections } from "../lib/wearables";
import type { TerraUser, WidgetSessionResponse } from "../lib/terra/types";
import { respondTerraError } from "./respond";

const db = createDb();

const patientInput = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(["male", "female"]),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function rosterMeta(referenceId: string): Promise<{
  connections: TerraUser[];
  lastReportDate: string | null;
}> {
  const { client } = getAppEnv();
  // Best-effort: a Terra hiccup must not blank the roster.
  const connections = await getEffectiveConnections(client, referenceId).catch(
    () => [] as TerraUser[],
  );
  const [latest] = await db
    .select({ payload: schema.labSessionCache.payload })
    .from(schema.labSessionCache)
    .where(eq(schema.labSessionCache.referenceId, referenceId))
    .orderBy(desc(schema.labSessionCache.fetchedAt))
    .limit(1);
  let lastReportDate: string | null = null;
  if (latest) {
    const session = JSON.parse(latest.payload) as {
      report_date?: string;
      collection_date?: string;
    };
    lastReportDate = session.collection_date ?? session.report_date ?? null;
  }
  return { connections, lastReportDate };
}

export const patientRoutes = new Hono()
  .get("/", async (c) => {
    const patients = await db
      .select()
      .from(schema.patient)
      .orderBy(schema.patient.lastName);
    const withMeta = await Promise.all(
      patients.map(async (p) => ({ ...p, ...(await rosterMeta(p.referenceId)) })),
    );
    return c.json({ patients: withMeta });
  })
  .post("/", zValidator("json", patientInput), async (c) => {
    const input = c.req.valid("json");
    const slug = slugify(`${input.firstName}-${input.lastName}`);
    const id = `pt_${slug}_${Date.now().toString(36)}`;
    const referenceId = `demo-patient-${slug}-${Date.now().toString(36)}`;
    const [created] = await db
      .insert(schema.patient)
      .values({ id, referenceId, ...input })
      .returning();
    return c.json({ patient: created }, 201);
  })
  .get("/:id", async (c) => {
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    const meta = await rosterMeta(p.referenceId);
    return c.json({ patient: { ...p, ...meta } });
  })
  .put(
    "/:id/watchlist",
    zValidator(
      "json",
      z.object({
        biomarkers: z.array(z.string().min(1).max(80)).max(12),
        metrics: z.array(z.string().min(1).max(40)).max(8),
      }),
    ),
    async (c) => {
      const input = c.req.valid("json");
      const [updated] = await db
        .update(schema.patient)
        .set({ watchlist: JSON.stringify(input) })
        .where(eq(schema.patient.id, c.req.param("id")))
        .returning();
      if (!updated) return c.json({ error: "Patient not found" }, 404);
      return c.json({ patient: updated });
    },
  )
  .post("/:id/widget-session", async (c) => {
    if (isDemoMode()) {
      return c.json(
        {
          error:
            "Demo mode: connecting wearables needs Terra credentials in .env.",
        },
        503,
      );
    }
    const [p] = await db
      .select()
      .from(schema.patient)
      .where(eq(schema.patient.id, c.req.param("id")));
    if (!p) return c.json({ error: "Patient not found" }, 404);
    const { client } = getAppEnv();
    const origin = new URL(c.req.url).origin;
    try {
      const session = (await client.postJson("/auth/generateWidgetSession", {
        reference_id: p.referenceId,
        language: "en",
        auth_success_redirect_url: `${origin}/patients/${p.id}?connected=1`,
        auth_failure_redirect_url: `${origin}/patients/${p.id}?connected=0`,
      })) as WidgetSessionResponse;
      // The widget flow will change connections — drop the cached lookup.
      invalidateConnections(p.referenceId);
      return c.json({ url: session.url });
    } catch (err) {
      return respondTerraError(c, err);
    }
  });
