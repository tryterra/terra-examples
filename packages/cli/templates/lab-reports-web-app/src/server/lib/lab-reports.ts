/**
 * Lab-report session access with a write-through cache. Sessions are
 * immutable once terminal (standardized/sent/failed/…), so cached terminal
 * payloads never go stale; non-terminal sessions are always refetched.
 */
import { eq } from "drizzle-orm";
import { createDb, schema } from "./db";
import { getAppEnv, isDemoMode } from "./env";
import {
  RESULTS_READY_STATUSES,
  TERMINAL_LAB_STATUSES,
  type LabReportListResponse,
  type LabReportSession,
} from "./terra/types";

const db = createDb();

export async function getSession(sessionId: string): Promise<LabReportSession> {
  const [hit] = await db
    .select()
    .from(schema.labSessionCache)
    .where(eq(schema.labSessionCache.sessionId, sessionId));
  if (hit && TERMINAL_LAB_STATUSES.has(hit.status)) {
    return withComputedFlags(JSON.parse(hit.payload) as LabReportSession);
  }
  const { client } = getAppEnv();
  const session = (await client.get(
    `/lab-reports/${sessionId}`,
  )) as LabReportSession;
  await cacheIfTerminal(session);
  return withComputedFlags(session);
}

/**
 * Fill in flags Terra left null when the data to judge is right there: a
 * numeric value plus a parsed applied_range. Some standardizations emit
 * "normal" for in-range rows yet null for out-of-range ones — a value
 * printed outside its own reference range must never render unflagged.
 * Derived flags carry `source: "computed"` so provenance stays honest.
 * Applied on the read path only; the cache keeps Terra's payload verbatim.
 */
function withComputedFlags(session: LabReportSession): LabReportSession {
  for (const r of session.results ?? []) {
    const i = r.interpretation;
    if (i.flag != null) continue;
    const m = r.measurement;
    const value =
      m.type === "numeric"
        ? m.numeric
        : m.type === "bounded"
          ? m.bounded?.value
          : undefined;
    const range = i.applied_range;
    if (
      value == null ||
      !range ||
      (range.lower == null && range.upper == null)
    ) {
      continue;
    }
    i.flag =
      range.lower != null && value < range.lower
        ? "low"
        : range.upper != null && value > range.upper
          ? "high"
          : "normal";
    i.source = "computed";
  }
  return session;
}

export async function cacheIfTerminal(session: LabReportSession): Promise<void> {
  if (!TERMINAL_LAB_STATUSES.has(session.current_status)) return;
  // Eventual consistency: right after the status flips, the results array can
  // still be empty on the read path. Never freeze that snapshot in the cache.
  const resultsAttached =
    (session.results?.length ?? 0) > 0 || session.results_count === 0;
  if (RESULTS_READY_STATUSES.has(session.current_status) && !resultsAttached) {
    return;
  }
  await db
    .insert(schema.labSessionCache)
    .values({
      sessionId: session.session_id,
      referenceId: session.reference_id ?? "",
      status: session.current_status,
      payload: JSON.stringify(session),
    })
    .onConflictDoUpdate({
      target: schema.labSessionCache.sessionId,
      set: {
        status: session.current_status,
        payload: JSON.stringify(session),
        fetchedAt: new Date(),
      },
    });
}

/**
 * Session summaries for a reference_id: live list merged with the local
 * cache. The Terra list is eventually consistent, so a just-processed
 * session already in the cache (via upload polling) still shows up.
 */
export async function listSessions(
  referenceId: string,
): Promise<LabReportSession[]> {
  const sessions = new Map<string, LabReportSession>();
  const cached = await db
    .select()
    .from(schema.labSessionCache)
    .where(eq(schema.labSessionCache.referenceId, referenceId));
  for (const row of cached) {
    const full = JSON.parse(row.payload) as LabReportSession;
    // Summaries only — drop the heavy fields the live list also omits.
    sessions.set(row.sessionId, { ...full, results: undefined });
  }
  if (!isDemoMode()) {
    const { client } = getAppEnv();
    const live = (await client.get("/lab-reports", {
      reference_id: referenceId,
    })) as LabReportListResponse;
    for (const s of live.sessions ?? []) sessions.set(s.session_id, s);
  }
  return [...sessions.values()].sort((a, b) =>
    (b.report_date ?? b.uploaded_at ?? "").localeCompare(
      a.report_date ?? a.uploaded_at ?? "",
    ),
  );
}
