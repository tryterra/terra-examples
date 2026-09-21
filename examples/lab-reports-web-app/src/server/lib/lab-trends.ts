/**
 * Cross-report biomarker trends: every results-ready session for a
 * reference_id, grouped by canonical `biomarker.key` (that is exactly what
 * the slug exists for), one dated point per session. Only numeric
 * measurements trend; points whose units disagree with the most recent
 * result's units are dropped rather than mixed on one axis.
 */
import { getSession, listSessions } from "./lab-reports";
import {
  RESULTS_READY_STATUSES,
  type LabReportResult,
  type LabReportSession,
} from "./terra/types";

export interface BiomarkerTrendPoint {
  date: string; // collection_date ?? report_date
  value: number;
  sessionId: string;
  flag: string | null;
}

export interface BiomarkerTrend {
  key: string;
  displayName: string;
  unit: string;
  panelName?: string;
  points: BiomarkerTrendPoint[];
  /** Resolved range from the most recent result, when the report had one. */
  latestRange?: { lower?: number; upper?: number };
  droppedUnitMismatch: number;
}

const normalizeUnit = (u: string | undefined) =>
  (u ?? "").toLowerCase().replace(/\s/g, "");

function sessionDate(s: LabReportSession): string | undefined {
  return s.collection_date ?? s.report_date;
}

export async function getBiomarkerTrends(
  referenceId: string,
): Promise<BiomarkerTrend[]> {
  const summaries = await listSessions(referenceId);
  const ready = summaries.filter(
    (s) => RESULTS_READY_STATUSES.has(s.current_status) && sessionDate(s),
  );
  const sessions = await Promise.all(
    ready.map((s) => getSession(s.session_id)),
  );
  sessions.sort((a, b) =>
    (sessionDate(a) ?? "").localeCompare(sessionDate(b) ?? ""),
  );

  const byKey = new Map<
    string,
    Array<{ session: LabReportSession; result: LabReportResult }>
  >();
  for (const session of sessions) {
    for (const result of session.results ?? []) {
      const key = result.biomarker.key;
      if (key == null || result.measurement.type !== "numeric") continue;
      if (result.measurement.numeric == null) continue;
      byKey.set(key, [...(byKey.get(key) ?? []), { session, result }]);
    }
  }

  const trends: BiomarkerTrend[] = [];
  for (const [key, entries] of byKey) {
    // One point per session: a report can print the same biomarker twice
    // (e.g. two ALT rows) — keep the first occurrence.
    const perSession = new Map<
      string,
      { session: LabReportSession; result: LabReportResult }
    >();
    for (const e of entries) {
      if (!perSession.has(e.session.session_id)) {
        perSession.set(e.session.session_id, e);
      }
    }
    const deduped = [...perSession.values()];
    if (deduped.length < 2) continue;

    const latest = deduped[deduped.length - 1];
    const unit = latest.result.measurement.units ?? "";
    const matching = deduped.filter(
      (e) => normalizeUnit(e.result.measurement.units) === normalizeUnit(unit),
    );
    if (matching.length < 2) continue;

    const panelId = latest.result.biomarker.panel_id;
    const panelName =
      panelId != null
        ? (latest.session.panels ?? []).find((p) => p.id === panelId)?.name
        : undefined;
    const range = latest.result.interpretation.applied_range;

    trends.push({
      key,
      displayName: latest.result.biomarker.display_name ?? key,
      unit,
      panelName: panelName ?? latest.result.source.panel,
      points: matching.map((e) => ({
        date: sessionDate(e.session)!,
        value: e.result.measurement.numeric!,
        sessionId: e.session.session_id,
        flag: e.result.interpretation.flag,
      })),
      latestRange:
        range && (range.lower != null || range.upper != null)
          ? range
          : undefined,
      droppedUnitMismatch: deduped.length - matching.length,
    });
  }

  trends.sort(
    (a, b) =>
      b.points.length - a.points.length ||
      a.displayName.localeCompare(b.displayName),
  );
  return trends;
}
