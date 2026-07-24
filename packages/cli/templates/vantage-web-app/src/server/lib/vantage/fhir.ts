/**
 * FHIR result parsing — exactly what a results screen needs, nothing more.
 * Pure: no Vantage imports; feed it the JSON downloaded from the presigned
 * results URL. Vantage results are a FHIR Bundle containing DiagnosticReport,
 * Patient, and Observation resources.
 */

export interface ParsedObservation {
  code: string;
  display: string;
  value: number | undefined;
  unit: string;
  referenceText: string;
  low: number | undefined;
  high: number | undefined;
  /** HL7 v2-0078: N normal, L below low, H above high, LL/HH critical. */
  interpretation: string;
  interpretationDisplay: string;
  /**
   * Range status derived from value vs referenceRange — the field to render.
   * Derived rather than read from interpretation because some supplier
   * normalisations currently emit non-HL7 vocabulary in interpretation
   * (observed live: "not_escalated"/"medium"); fix tracked upstream in the
   * Vantage API. When interpretation IS a valid HL7 code it always agrees.
   */
  rangeStatus: "in_range" | "below_range" | "above_range" | "unknown";
}

export interface ParsedResult {
  panelName: string;
  issued: string | undefined;
  collected: string | undefined;
  patientName: string;
  observations: ParsedObservation[];
}

interface FhirResource {
  resourceType?: string;
  [key: string]: unknown;
}

/** Parse a Vantage FHIR Bundle into the flat shape the results UI renders. */
export function parseFhirBundle(bundle: unknown): ParsedResult {
  const entries: FhirResource[] = (
    (bundle as { entry?: Array<{ resource?: FhirResource }> })?.entry ?? []
  )
    .map((e) => e.resource ?? {})
    .filter(Boolean);

  const report =
    entries.find((r) => r.resourceType === "DiagnosticReport") ?? {};
  const patient = entries.find((r) => r.resourceType === "Patient") ?? {};
  const observations = entries.filter((r) => r.resourceType === "Observation");

  const name = ((patient.name as Array<{
    family?: string;
    given?: string[];
  }>) ?? [])[0];
  const patientName =
    [...(name?.given ?? []), name?.family].filter(Boolean).join(" ") ||
    "Unknown patient";

  return {
    panelName: ((report.code as { text?: string })?.text ??
      "Laboratory Panel") as string,
    issued: report.issued as string | undefined,
    collected: report.effectiveDateTime as string | undefined,
    patientName,
    observations: observations.map(parseObservation),
  };
}

function parseObservation(obs: FhirResource): ParsedObservation {
  const coding =
    (obs.code as {
      coding?: Array<{ code?: string; display?: string }>;
      text?: string;
    }) ?? {};
  const first = coding.coding?.[0];
  const vq = obs.valueQuantity as { value?: number; unit?: string } | undefined;
  // Prefer the band tagged type=normal (FHIR referencerange-meaning) —
  // suppliers may emit multiple bands (Low/Normal/High); the untagged-first
  // fallback covers bundles produced before the normal-band tagging shipped.
  const ranges =
    (obs.referenceRange as Array<{
      low?: { value?: number };
      high?: { value?: number };
      text?: string;
      type?: { coding?: Array<{ code?: string }> };
    }>) ?? [];
  const range =
    ranges.find((r) => r.type?.coding?.some((c) => c.code === "normal")) ??
    ranges[0];
  const interp = ((obs.interpretation as Array<{
    coding?: Array<{ code?: string; display?: string }>;
  }>) ?? [])[0]?.coding?.[0];
  const value = vq?.value;
  const low = range?.low?.value;
  const high = range?.high?.value;
  let rangeStatus: ParsedObservation["rangeStatus"] = "unknown";
  if (value !== undefined) {
    if (low !== undefined && value < low) rangeStatus = "below_range";
    else if (high !== undefined && value > high) rangeStatus = "above_range";
    else if (low !== undefined || high !== undefined) rangeStatus = "in_range";
  }
  return {
    rangeStatus,
    code: first?.code ?? "",
    display: first?.display ?? coding.text ?? first?.code ?? "Observation",
    value,
    unit: vq?.unit ?? "",
    referenceText: range?.text ?? "",
    low,
    high,
    interpretation: interp?.code ?? "",
    interpretationDisplay: interp?.display ?? "",
  };
}

/** true when the HL7 interpretation code means out-of-range (incl. critical). */
export function isOutOfRange(interpretation: string): boolean {
  return ["L", "H", "LL", "HH", "A", "AA"].includes(interpretation);
}

/** true for the critical HL7 codes (double letters). */
export function isCritical(interpretation: string): boolean {
  return ["LL", "HH", "AA"].includes(interpretation);
}
