/**
 * Pure display helpers for the patient page: group repeated measurements into
 * one row, shorten LOINC long names, and tidy RxNorm casing. No React here so
 * it stays unit-testable.
 */
import type { RecordItem } from "./queries";

/** One row on the page: the newest reading plus everything older. */
export interface RecordGroup {
  key: string;
  latest: RecordItem;
  /** Every reading, newest first (includes `latest`). */
  readings: RecordItem[];
}

const REPEATABLE = new Set(["lab_result", "vital_sign"]);

/**
 * Lab results and vitals with the same code collapse into one group, newest
 * first. Everything else is one group per record. Input order is kept for the
 * groups (by each group's newest reading).
 */
export function groupRecords(items: RecordItem[]): RecordGroup[] {
  const sorted = [...items].sort((a, b) =>
    (b.summary.date ?? "").localeCompare(a.summary.date ?? ""),
  );
  const groups = new Map<string, RecordGroup>();
  for (const item of sorted) {
    const { clinical_type, record_id } = item.record;
    const repeatable =
      REPEATABLE.has(clinical_type) &&
      item.summary.components.length === 0 &&
      item.summary.code;
    const key = repeatable
      ? `${clinical_type}:${item.summary.code}`
      : `record:${record_id}`;
    const existing = groups.get(key);
    if (existing) existing.readings.push(item);
    else groups.set(key, { key, latest: item, readings: [item] });
  }
  return [...groups.values()];
}

/** Oldest-to-newest numeric values, for a sparkline. */
export function trendValues(group: RecordGroup): number[] {
  return group.readings
    .map((r) => r.summary.quantity?.numeric)
    .filter((n): n is number => typeof n === "number")
    .reverse();
}

/**
 * Pad plain numbers in a series to the same decimals, so a history reads
 * "6.1, 6.4, 6.0" instead of "6.1, 6.4, 6" (JSON drops the trailing zero).
 * Non-numeric values ("<0.04", "128/82", "Negative") pass through.
 */
export function alignDecimals(values: string[]): string[] {
  const plain = /^-?\d+(\.\d+)?$/;
  const decimals = Math.max(
    0,
    ...values
      .filter((v) => plain.test(v))
      .map((v) => v.split(".")[1]?.length ?? 0),
  );
  return values.map((v) => (plain.test(v) ? Number(v).toFixed(decimals) : v));
}

/**
 * LOINC long names to what a clinician would write:
 * "Cholesterol in HDL [Mass/volume] in Serum or Plasma" -> "Cholesterol in HDL",
 * "CBC panel - Blood by Automated count" -> "CBC panel".
 */
export function shortTestName(name: string): string {
  const short = name
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(
      /\s+(in|-)\s+(whole\s+)?(blood|serum or plasma|serum|plasma|urine)\b.*$/i,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  return short || name;
}

/** RxNorm shouts units ("20 MG Oral Tablet"); write them as people do. */
export function tidyMedicationName(name: string): string {
  return name.replace(/\b(MG|MCG|ML|ACTUAT|UNT|HR|MEQ)\b/g, (u) =>
    u.toLowerCase(),
  );
}

/**
 * Sentence case that respects clinical names: "Blood Pressure" -> "Blood
 * pressure", "LDL Cholesterol" -> "LDL cholesterol". Acronyms (LDL, COVID-19)
 * and mixed-case tokens (A1c, mRNA) keep their casing; so does the first word.
 */
export function sentenceCaseTitle(name: string): string {
  let first = true;
  return name.replace(/[A-Za-z][A-Za-z0-9'-]*/g, (word) => {
    const keep = first;
    first = false;
    if (keep) return word;
    // Only plain Capitalized words get lowered; "A1c", "LDL", "mRNA" stay.
    return /^[A-Z][a-z']+$/.test(word) ? word.toLowerCase() : word;
  });
}

/** The name a row shows for a record. */
export function displayTitle(item: RecordItem): string {
  const { clinical_type } = item.record;
  const title = item.summary.title;
  if (clinical_type === "medication")
    return sentenceCaseTitle(tidyMedicationName(title));
  if (clinical_type === "lab_result" || clinical_type === "vital_sign")
    return sentenceCaseTitle(shortTestName(title));
  return sentenceCaseTitle(title);
}

const QUIET_STATUSES = new Set(["active", "final", "completed", "confirmed"]);

/** Status worth a badge: anything other than the expected default. */
export function notableStatus(status: string | null): string | null {
  if (!status) return null;
  return QUIET_STATUSES.has(status.toLowerCase()) ? null : status;
}

export function detail(item: RecordItem, label: string): string | undefined {
  return item.summary.details.find((d) => d.label === label)?.value;
}
