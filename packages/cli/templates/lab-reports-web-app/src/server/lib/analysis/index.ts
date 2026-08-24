/**
 * Analysis orchestrator: latest lab value per biomarker (across all
 * results-ready sessions) + wearable series → scored domains + narrative.
 */
import { listSessions, getSession } from "../lab-reports";
import { getWearableSummary, windowFromDays } from "../wearables";
import {
  RESULTS_READY_STATUSES,
  type LabReportResult,
  type LabReportSession,
} from "../terra/types";
import { DOMAINS } from "./domains";
import {
  labContribution,
  scoreDomain,
  wearableContribution,
  type Contribution,
  type DomainScore,
} from "./scoring";
import { domainNarrative, overallNarrative } from "./narrative";

export interface Analysis {
  domains: Array<DomainScore & { narrative: string[] }>;
  overall: string;
  /**
   * Labs-only domain scores reconstructed at each report date — the score a
   * clinician would have seen back then. Wearable inputs are excluded from
   * historical points (only ~30 days of wearable history exists).
   */
  history: Record<string, Array<{ date: string; score: number | null }>>;
  inputs: {
    labSessionIds: string[];
    latestReportDate: string | null;
    wearableConnected: boolean;
    wearableDays: number;
  };
}

/** Most recent result per biomarker key across sessions (newest draw wins). */
export function latestByBiomarker(
  sessions: LabReportSession[],
): Map<string, LabReportResult> {
  const dated = sessions
    .filter((s) => RESULTS_READY_STATUSES.has(s.current_status))
    .sort((a, b) =>
      (a.collection_date ?? a.report_date ?? "").localeCompare(
        b.collection_date ?? b.report_date ?? "",
      ),
    );
  const latest = new Map<string, LabReportResult>();
  for (const session of dated) {
    for (const result of session.results ?? []) {
      if (result.biomarker.key != null) {
        latest.set(result.biomarker.key, result); // later sessions overwrite
      }
    }
  }
  return latest;
}

function labContributionsFor(
  domainKey: string,
  byBiomarker: Map<string, LabReportResult>,
): Contribution[] {
  const domain = DOMAINS.find((d) => d.key === domainKey)!;
  const contributions: Contribution[] = [];
  for (const input of domain.labInputs) {
    const key = input.biomarkerKeys.find((k) => byBiomarker.has(k));
    if (!key) continue;
    const contribution = labContribution(input, byBiomarker.get(key)!, key);
    if (contribution) contributions.push(contribution);
  }
  return contributions;
}

/** Labs-only domain scores as of each report date (chronological). */
export function domainHistory(
  sessions: LabReportSession[],
): Analysis["history"] {
  const dated = sessions
    .filter(
      (s) =>
        RESULTS_READY_STATUSES.has(s.current_status) &&
        (s.collection_date ?? s.report_date),
    )
    .sort((a, b) =>
      (a.collection_date ?? a.report_date ?? "").localeCompare(
        b.collection_date ?? b.report_date ?? "",
      ),
    );
  const history: Analysis["history"] = Object.fromEntries(
    DOMAINS.map((d) => [d.key, []]),
  );
  for (let i = 0; i < dated.length; i++) {
    const date = dated[i].collection_date ?? dated[i].report_date!;
    // Skip same-date duplicates (two reports from one draw day).
    if (i + 1 < dated.length) {
      const next = dated[i + 1].collection_date ?? dated[i + 1].report_date;
      if (next === date) continue;
    }
    const byBiomarker = latestByBiomarker(dated.slice(0, i + 1));
    for (const domain of DOMAINS) {
      const scored = scoreDomain(
        domain,
        labContributionsFor(domain.key, byBiomarker),
      );
      if (scored.score != null) {
        history[domain.key].push({ date, score: scored.score });
      }
    }
  }
  return history;
}

export async function analysePatient(
  referenceId: string,
  wearableDays = 30,
): Promise<Analysis> {
  const summaries = await listSessions(referenceId);
  const ready = summaries.filter((s) =>
    RESULTS_READY_STATUSES.has(s.current_status),
  );
  // Full payloads (list responses omit results); cache makes this cheap.
  const sessions = await Promise.all(
    ready.map((s) => getSession(s.session_id)),
  );
  const wearables = await getWearableSummary(
    referenceId,
    windowFromDays(wearableDays),
  );
  const byBiomarker = latestByBiomarker(sessions);

  const domains = DOMAINS.map((domain) => {
    const contributions: Contribution[] = labContributionsFor(
      domain.key,
      byBiomarker,
    );
    for (const input of domain.wearableInputs) {
      const contribution = wearableContribution(
        input,
        wearables.series[input.metric],
      );
      if (contribution) contributions.push(contribution);
    }
    const scored = scoreDomain(domain, contributions);
    return { ...scored, narrative: domainNarrative(scored) };
  });

  const latestReportDate =
    sessions
      .map((s) => s.collection_date ?? s.report_date)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null;

  return {
    domains,
    overall: overallNarrative(domains),
    history: domainHistory(sessions),
    inputs: {
      labSessionIds: sessions.map((s) => s.session_id),
      latestReportDate,
      wearableConnected: wearables.connected,
      wearableDays,
    },
  };
}
