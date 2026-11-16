/** Display metadata per clinical_type. Unknown types get a generic entry. */

export interface TypeMeta {
  /** Section heading: "Lab results". */
  label: string;
  /** One record of this type, for the detail drawer: "Lab result". */
  singular: string;
}

/** Display order: the things a clinician scans first come first. */
const TYPES: Array<[string, TypeMeta]> = [
  ["lab_result", { label: "Lab results", singular: "Lab result" }],
  ["vital_sign", { label: "Vitals", singular: "Vital sign" }],
  ["condition", { label: "Conditions", singular: "Condition" }],
  ["medication", { label: "Medications", singular: "Medication" }],
  ["allergy", { label: "Allergies", singular: "Allergy" }],
  ["immunization", { label: "Immunizations", singular: "Immunization" }],
  ["procedure", { label: "Procedures", singular: "Procedure" }],
  ["clinical_note", { label: "Clinical notes", singular: "Clinical note" }],
  ["coverage", { label: "Coverage", singular: "Coverage" }],
];

const BY_TYPE = new Map(TYPES);
export const TYPE_ORDER = TYPES.map(([t]) => t);

export function typeMeta(type: string): TypeMeta {
  const fallback = type
    ? type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
    : "Other";
  return BY_TYPE.get(type) ?? { label: fallback, singular: fallback };
}

export function compareTypes(a: string, b: string): number {
  const ia = TYPE_ORDER.indexOf(a);
  const ib = TYPE_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
}
