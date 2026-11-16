/**
 * FHIR to readable summary. Apple Health Records hands over whatever the
 * health system serves - DSTU2 or R4 - so every reader here accepts both
 * shapes structurally instead of branching on `fhir.release` (which can be
 * null). Pure: no I/O, no app imports; feed it a Terra clinical record.
 *
 * Anything this file does not understand still renders: the summary falls
 * back to Terra's `display_name` plus the best date it can find, with
 * `parsed: false` so the UI can say so.
 */
import type { ClinicalRecord } from "./types";

export type FlagTone = "high" | "low" | "abnormal" | "normal";

export interface RecordFlag {
  /** HL7 v2-0078 style code as served, e.g. "H", "L", "N", "A". */
  code: string;
  label: string;
  tone: FlagTone;
}

export interface RecordDetail {
  label: string;
  value: string;
}

export interface RecordSummary {
  title: string;
  /** The clinically meaningful date (ISO 8601 or partial date), if any. */
  date: string | null;
  /** What `date` means: "Effective", "Onset", "Started", "Performed"... */
  dateLabel: string;
  /** Headline value, e.g. "6.1 %", "128/82 mmHg", "500 mg twice daily". */
  value: string | null;
  flag: RecordFlag | null;
  status: string | null;
  details: RecordDetail[];
  /** False when only the Terra fallback (display_name + date) was used. */
  parsed: boolean;
}

type Json = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/*                              Primitive readers                              */
/* -------------------------------------------------------------------------- */

function obj(v: unknown): Json | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Json)
    : undefined;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** CodeableConcept text: `text`, else the first coding display, else code. */
export function conceptText(v: unknown): string | undefined {
  const c = obj(v);
  if (!c) return str(v);
  const codings = arr(c.coding).map(obj).filter(Boolean) as Json[];
  return (
    str(c.text) ??
    codings.map((x) => str(x.display)).find(Boolean) ??
    codings.map((x) => str(x.code)).find(Boolean)
  );
}

function referenceText(v: unknown): string | undefined {
  return str(obj(v)?.display);
}

/** Status that is a plain code (DSTU2) or a CodeableConcept (R4). */
function statusText(v: unknown): string | undefined {
  const s = str(v) ?? conceptText(v);
  return s ? humanize(s) : undefined;
}

function humanize(s: string): string {
  const spaced = s.replace(/[-_]/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatNumber(n: number): string {
  // Keep the precision the lab reported; just drop float noise.
  return String(Number(n.toPrecision(12)));
}

/** Quantity to "6.1 %" / "142 mg/dL". UCUM `{...}` annotations are dropped. */
export function quantityText(v: unknown): string | undefined {
  const q = obj(v);
  const value = num(q?.value);
  if (!q || value === undefined) return undefined;
  const comparator = str(q.comparator) ?? "";
  const unit = str(q.unit) ?? str(q.code);
  const cleanUnit = unit && !/^\{.*\}$/.test(unit) ? unit : undefined;
  return `${comparator}${formatNumber(value)}${cleanUnit ? ` ${cleanUnit}` : ""}`;
}

function periodStart(v: unknown): string | undefined {
  return str(obj(v)?.start);
}

function periodEnd(v: unknown): string | undefined {
  return str(obj(v)?.end);
}

/** First present value of `prefix` + DateTime | Period.start | String | Date. */
function choiceDate(r: Json, prefix: string): string | undefined {
  return (
    str(r[`${prefix}DateTime`]) ??
    periodStart(r[`${prefix}Period`]) ??
    str(r[`${prefix}Date`]) ??
    str(r[`${prefix}Instant`]) ??
    str(r[prefix])
  );
}

function push(details: RecordDetail[], label: string, value?: string) {
  if (value) details.push({ label, value });
}

/* -------------------------------------------------------------------------- */
/*                                 Observation                                 */
/* -------------------------------------------------------------------------- */

const FLAGS: Record<string, { label: string; tone: FlagTone }> = {
  H: { label: "High", tone: "high" },
  HH: { label: "Critically high", tone: "high" },
  HU: { label: "Very high", tone: "high" },
  ">": { label: "Above range", tone: "high" },
  L: { label: "Low", tone: "low" },
  LL: { label: "Critically low", tone: "low" },
  LU: { label: "Very low", tone: "low" },
  "<": { label: "Below range", tone: "low" },
  A: { label: "Abnormal", tone: "abnormal" },
  AA: { label: "Critically abnormal", tone: "abnormal" },
  POS: { label: "Positive", tone: "abnormal" },
  DET: { label: "Detected", tone: "abnormal" },
  N: { label: "Normal", tone: "normal" },
  NEG: { label: "Negative", tone: "normal" },
  ND: { label: "Not detected", tone: "normal" },
};

/** DSTU2 interpretation is one CodeableConcept, R4 is an array of them. */
export function readInterpretation(v: unknown): RecordFlag | null {
  for (const concept of arr(v)) {
    const c = obj(concept);
    if (!c) continue;
    const codings = arr(c.coding).map(obj).filter(Boolean) as Json[];
    for (const coding of codings) {
      const code = str(coding.code)?.toUpperCase();
      if (code && FLAGS[code]) return { code, ...FLAGS[code] };
    }
    const text = conceptText(c);
    if (text) {
      const lower = text.toLowerCase();
      const tone: FlagTone = lower.includes("high")
        ? "high"
        : lower.includes("low")
          ? "low"
          : lower.includes("normal")
            ? "normal"
            : "abnormal";
      return {
        code: str(codings[0]?.code) ?? text,
        label: humanize(text),
        tone,
      };
    }
  }
  return null;
}

function rangeText(v: unknown): string | undefined {
  const r = obj(arr(v)[0]);
  if (!r) return undefined;
  const text = str(r.text);
  const low = obj(r.low);
  const high = obj(r.high);
  const lowV = num(low?.value);
  const highV = num(high?.value);
  const unit = str(high?.unit) ?? str(low?.unit);
  const u = unit && !/^\{.*\}$/.test(unit) ? ` ${unit}` : "";
  if (lowV !== undefined && highV !== undefined)
    return `${formatNumber(lowV)}-${formatNumber(highV)}${u}`;
  if (highV !== undefined) return `<${formatNumber(highV)}${u}`;
  if (lowV !== undefined) return `>${formatNumber(lowV)}${u}`;
  return text;
}

/** Derive a flag from value vs range when the system did not send one. */
function flagFromRange(obs: Json): RecordFlag | null {
  const value = num(obj(obs.valueQuantity)?.value);
  const r = obj(arr(obs.referenceRange)[0]);
  if (value === undefined || !r) return null;
  const low = num(obj(r.low)?.value);
  const high = num(obj(r.high)?.value);
  if (high !== undefined && value > high) return { code: "H", ...FLAGS.H };
  if (low !== undefined && value < low) return { code: "L", ...FLAGS.L };
  return null;
}

function observationValue(o: Json): string | undefined {
  return (
    quantityText(o.valueQuantity) ??
    conceptText(o.valueCodeableConcept) ??
    str(o.valueString) ??
    (typeof o.valueBoolean === "boolean"
      ? o.valueBoolean
        ? "Yes"
        : "No"
      : undefined) ??
    (num(o.valueInteger) !== undefined ? String(o.valueInteger) : undefined)
  );
}

const SYSTOLIC = new Set(["8480-6", "271649006"]);
const DIASTOLIC = new Set(["8462-4", "271650006"]);

function codes(concept: unknown): string[] {
  return (arr(obj(concept)?.coding).map(obj).filter(Boolean) as Json[])
    .map((c) => str(c.code))
    .filter((c): c is string => Boolean(c));
}

function parseObservation(o: Json): Omit<RecordSummary, "title" | "parsed"> & {
  title?: string;
} {
  const details: RecordDetail[] = [];
  const components = arr(o.component).map(obj).filter(Boolean) as Json[];
  let value = observationValue(o);

  // Blood pressure: systolic/diastolic arrive as components, no top value.
  const sys = components.find((c) =>
    codes(c.code).some((x) => SYSTOLIC.has(x)),
  );
  const dia = components.find((c) =>
    codes(c.code).some((x) => DIASTOLIC.has(x)),
  );
  const sysV = num(obj(sys?.valueQuantity)?.value);
  const diaV = num(obj(dia?.valueQuantity)?.value);
  if (!value && sysV !== undefined && diaV !== undefined) {
    const unit = str(obj(sys?.valueQuantity)?.unit) ?? "mmHg";
    value = `${formatNumber(sysV)}/${formatNumber(diaV)} ${unit}`;
  } else {
    for (const c of components) {
      push(details, conceptText(c.code) ?? "Component", observationValue(c));
    }
  }

  push(details, "Reference range", rangeText(o.referenceRange));
  push(
    details,
    "Category",
    arr(o.category).map(conceptText).filter(Boolean).join(", ") || undefined,
  );
  push(details, "Performer", referenceText(arr(o.performer)[0]));
  push(details, "Note", str(o.comments) ?? str(obj(arr(o.note)[0])?.text));

  return {
    title: conceptText(o.code),
    date: choiceDate(o, "effective") ?? str(o.issued) ?? null,
    dateLabel: "Effective",
    value: value ?? null,
    flag: readInterpretation(o.interpretation) ?? flagFromRange(o),
    status: statusText(o.status) ?? null,
    details,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Condition                                  */
/* -------------------------------------------------------------------------- */

function parseCondition(c: Json) {
  const details: RecordDetail[] = [];
  const onset =
    choiceDate(c, "onset") ??
    (quantityText(c.onsetAge) ? `Age ${quantityText(c.onsetAge)}` : undefined);
  const abatement =
    choiceDate(c, "abatement") ??
    (c.abatementBoolean === true ? "Resolved" : undefined);
  push(details, "Onset", onset);
  push(details, "Resolved", abatement);
  push(details, "Verification", statusText(c.verificationStatus));
  push(details, "Severity", conceptText(c.severity));
  push(
    details,
    "Category",
    arr(c.category).map(conceptText).filter(Boolean).join(", ") || undefined,
  );
  // DSTU2 `dateRecorded`, R4 `recordedDate`.
  push(details, "Recorded", str(c.dateRecorded) ?? str(c.recordedDate));
  return {
    title: conceptText(c.code),
    date:
      onset && !onset.startsWith("Age")
        ? onset
        : (str(c.dateRecorded) ?? str(c.recordedDate) ?? null),
    dateLabel: onset && !onset.startsWith("Age") ? "Onset" : "Recorded",
    value: null,
    flag: null,
    status: statusText(c.clinicalStatus) ?? null,
    details,
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Medications                                 */
/* -------------------------------------------------------------------------- */

/** One dosage line: text, else dose + timing (DSTU2 doseQuantity, R4 doseAndRate). */
export function dosageText(v: unknown): string | undefined {
  const d = obj(v);
  if (!d) return undefined;
  const text = str(d.text);
  if (text) return text;
  const dose =
    quantityText(d.doseQuantity) ??
    quantityText(d.quantityQuantity) ??
    quantityText(obj(arr(d.doseAndRate)[0])?.doseQuantity);
  const timing =
    conceptText(obj(d.timing)?.code) ??
    (() => {
      const rep = obj(obj(d.timing)?.repeat);
      const freq = num(rep?.frequency);
      const period = num(rep?.period);
      const unit = str(rep?.periodUnit) ?? str(rep?.periodUnits);
      if (freq === undefined || period === undefined || !unit) return undefined;
      const units: Record<string, string> = {
        h: "hour",
        d: "day",
        wk: "week",
        mo: "month",
      };
      const u = units[unit] ?? unit;
      return `${freq}x every ${period === 1 ? u : `${period} ${u}s`}`;
    })();
  const route = conceptText(d.route);
  return [dose, timing, route].filter(Boolean).join(", ") || undefined;
}

function parseMedication(m: Json, resourceType: string) {
  const details: RecordDetail[] = [];
  const title =
    conceptText(m.medicationCodeableConcept) ??
    referenceText(m.medicationReference);
  // MedicationStatement: dosage[]; MedicationOrder / MedicationRequest: dosageInstruction[].
  const dosage = [...arr(m.dosage), ...arr(m.dosageInstruction)]
    .map(dosageText)
    .filter(Boolean)
    .join("; ");

  let date: string | undefined;
  let dateLabel = "Started";
  if (resourceType === "MedicationStatement") {
    date = choiceDate(m, "effective") ?? str(m.dateAsserted);
    push(details, "Ended", periodEnd(m.effectivePeriod));
    push(details, "Asserted", str(m.dateAsserted));
  } else {
    // MedicationOrder (DSTU2) `dateWritten`, MedicationRequest (R4) `authoredOn`.
    date = str(m.dateWritten) ?? str(m.authoredOn);
    dateLabel = "Prescribed";
    push(
      details,
      "Prescriber",
      referenceText(m.prescriber) ?? referenceText(m.requester),
    );
    push(details, "Ended", str(m.dateEnded));
    const supply = obj(m.dispenseRequest);
    push(details, "Quantity", quantityText(supply?.quantity));
    const refills = num(supply?.numberOfRepeatsAllowed);
    if (refills !== undefined) push(details, "Refills", String(refills));
  }
  push(
    details,
    "Reason",
    arr(m.reasonCode ?? m.reasonForUseCodeableConcept)
      .map(conceptText)
      .filter(Boolean)
      .join(", ") || conceptText(m.reasonCodeableConcept),
  );
  push(details, "Note", str(m.note) ?? str(obj(arr(m.note)[0])?.text));

  return {
    title,
    date: date ?? null,
    dateLabel,
    value: dosage || null,
    flag: null,
    status: statusText(m.status) ?? null,
    details,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Allergies                                  */
/* -------------------------------------------------------------------------- */

const CRITICALITY: Record<string, string> = {
  CRITL: "Low",
  CRITH: "High",
  CRITU: "Unable to assess",
  low: "Low",
  high: "High",
  "unable-to-assess": "Unable to assess",
};

function parseAllergy(a: Json) {
  const details: RecordDetail[] = [];
  const reactions = arr(a.reaction).map(obj).filter(Boolean) as Json[];
  const manifestations = reactions
    .flatMap((r) => arr(r.manifestation).map(conceptText))
    .filter(Boolean);
  const severities = reactions
    .map((r) => str(r.severity))
    .filter((s): s is string => Boolean(s));
  push(details, "Severity", severities.map(humanize).join(", ") || undefined);
  const crit = str(a.criticality);
  push(
    details,
    "Criticality",
    crit ? (CRITICALITY[crit] ?? humanize(crit)) : undefined,
  );
  push(details, "Type", str(a.type) ? humanize(str(a.type)!) : undefined);
  push(
    details,
    "Category",
    arr(a.category)
      .map((c) => (str(c) ? humanize(str(c)!) : undefined))
      .filter(Boolean)
      .join(", ") || undefined,
  );
  push(details, "Recorded", str(a.recordedDate));

  return {
    // DSTU2 `substance`, R4 `code`.
    title: conceptText(a.substance) ?? conceptText(a.code),
    date: choiceDate(a, "onset") ?? str(a.recordedDate) ?? null,
    dateLabel: choiceDate(a, "onset") ? "Onset" : "Recorded",
    value: manifestations.length
      ? `Reaction: ${manifestations.join(", ")}`
      : null,
    flag:
      crit && /^(CRITH|high)$/.test(crit)
        ? { code: crit, label: "High criticality", tone: "high" as const }
        : null,
    // DSTU2 `status` code, R4 `clinicalStatus` CodeableConcept.
    status: statusText(a.clinicalStatus) ?? statusText(a.status) ?? null,
    details,
  };
}

/* -------------------------------------------------------------------------- */
/*                          Procedures & immunizations                         */
/* -------------------------------------------------------------------------- */

function parseProcedure(p: Json) {
  const details: RecordDetail[] = [];
  push(
    details,
    "Body site",
    arr(p.bodySite).map(conceptText).filter(Boolean).join(", ") || undefined,
  );
  push(
    details,
    "Performer",
    (arr(p.performer).map(obj).filter(Boolean) as Json[])
      .map((x) => referenceText(x.actor))
      .filter(Boolean)
      .join(", ") || undefined,
  );
  push(details, "Location", referenceText(p.location));
  push(details, "Outcome", conceptText(p.outcome));
  push(
    details,
    "Reason",
    arr(p.reasonCode ?? p.reasonCodeableConcept)
      .map(conceptText)
      .filter(Boolean)
      .join(", ") || undefined,
  );
  push(details, "Ended", periodEnd(p.performedPeriod));
  return {
    title: conceptText(p.code),
    date: choiceDate(p, "performed") ?? null,
    dateLabel: "Performed",
    value: null,
    flag: null,
    status: statusText(p.status) ?? null,
    details,
  };
}

function parseImmunization(i: Json) {
  const details: RecordDetail[] = [];
  // DSTU2 vaccinationProtocol[].doseSequence, R4 protocolApplied[].doseNumberPositiveInt.
  const dose =
    num(obj(arr(i.vaccinationProtocol)[0])?.doseSequence) ??
    num(obj(arr(i.protocolApplied)[0])?.doseNumberPositiveInt);
  if (dose !== undefined) push(details, "Dose", `#${dose}`);
  push(details, "Lot", str(i.lotNumber));
  push(details, "Site", conceptText(i.site));
  push(details, "Route", conceptText(i.route));
  push(details, "Manufacturer", referenceText(i.manufacturer));
  push(details, "Dose quantity", quantityText(i.doseQuantity));
  // DSTU2 wasNotGiven boolean, R4 status "not-done".
  const notGiven = i.wasNotGiven === true || str(i.status) === "not-done";
  return {
    title: conceptText(i.vaccineCode),
    date: str(i.date) ?? choiceDate(i, "occurrence") ?? null,
    dateLabel: "Administered",
    value: null,
    flag: notGiven
      ? { code: "not-done", label: "Not given", tone: "abnormal" as const }
      : null,
    status: statusText(i.status) ?? null,
    details,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Fallback                                   */
/* -------------------------------------------------------------------------- */

/** Best-effort date for resources without a dedicated reader. */
function genericDate(r: Json): string | undefined {
  return (
    choiceDate(r, "effective") ??
    str(r.issued) ??
    str(r.date) ??
    str(r.created) ??
    periodStart(r.period) ??
    str(r.indexed)
  );
}

function fallback(
  record: ClinicalRecord,
  resource: Json | null,
): RecordSummary {
  const details: RecordDetail[] = [];
  if (resource) {
    push(
      details,
      "Category",
      conceptText(resource.type) ?? conceptText(arr(resource.category)[0]),
    );
    push(details, "Payor", referenceText(arr(resource.payor)[0]));
    push(details, "Subscriber ID", str(resource.subscriberId));
    push(details, "Author", referenceText(arr(resource.author)[0]));
  }
  return {
    title: record.display_name || record.fhir.resource_type,
    date:
      (resource && genericDate(resource)) ??
      record.downloaded_at ??
      record.received_at,
    dateLabel: resource && genericDate(resource) ? "Date" : "Received",
    value: null,
    flag: null,
    status: resource ? (statusText(resource.status) ?? null) : null,
    details,
    parsed: false,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Entry point                                */
/* -------------------------------------------------------------------------- */

export function summarizeRecord(record: ClinicalRecord): RecordSummary {
  const resource = obj(record.fhir_resource) ?? null;
  if (!resource) return fallback(record, null);

  const type = str(resource.resourceType) ?? record.fhir.resource_type;
  let partial: ReturnType<typeof parseObservation> | undefined;
  try {
    switch (type) {
      case "Observation":
        partial = parseObservation(resource);
        break;
      case "Condition":
        partial = parseCondition(resource);
        break;
      case "MedicationStatement":
      case "MedicationOrder":
      case "MedicationRequest":
        partial = parseMedication(resource, type);
        break;
      case "AllergyIntolerance":
        partial = parseAllergy(resource);
        break;
      case "Procedure":
        partial = parseProcedure(resource);
        break;
      case "Immunization":
        partial = parseImmunization(resource);
        break;
    }
  } catch {
    // Malformed resource: render the fallback rather than break the page.
    partial = undefined;
  }
  if (!partial) return fallback(record, resource);

  const date = partial.date ?? record.downloaded_at ?? null;
  return {
    ...partial,
    title: partial.title ?? record.display_name ?? type,
    date,
    // The headline date already shows this one; don't repeat it as a detail.
    details: partial.details.filter(
      (d) => !(d.label === partial.dateLabel && d.value === date),
    ),
    parsed: true,
  };
}
