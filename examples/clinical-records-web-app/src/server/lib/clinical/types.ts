/**
 * Terra clinical record payloads (data type `clinical_record`): Apple Health
 * Records resources delivered as raw FHIR. Shapes mirror the Terra API
 * reference; `clinical_type` is an open set, so unknown values must render.
 */

export const KNOWN_CLINICAL_TYPES = [
  "lab_result",
  "vital_sign",
  "condition",
  "medication",
  "allergy",
  "immunization",
  "procedure",
  "clinical_note",
  "coverage",
] as const;

export type KnownClinicalType = (typeof KNOWN_CLINICAL_TYPES)[number];
/** Open set: Terra may add types; keep `string` so new ones still flow. */
export type ClinicalType = KnownClinicalType | (string & {});

export interface ClinicalRecordFhirMeta {
  /** FHIR resourceType, e.g. "Observation", "MedicationOrder". */
  resource_type: string;
  /** The resource id at the health system. */
  identifier: string;
  /** FHIR release the health system serves; null when Apple does not say. */
  release: "DSTU2" | "R4" | null;
  source_url: string | null;
  content_sha256: string;
  byte_size: number;
}

export interface ClinicalRecord {
  record_id: string;
  clinical_type: ClinicalType;
  display_name: string;
  /** The health system the record came from, e.g. "Larkspur Medical Group". */
  source_name: string;
  source_bundle_id: string;
  /** When the device downloaded the record from the health system (ISO 8601). */
  downloaded_at: string | null;
  /** When Terra received it (ISO 8601). Later receipts win. */
  received_at: string;
  fhir: ClinicalRecordFhirMeta;
  /** The raw FHIR resource, or null when it could not be retrieved. */
  fhir_resource: Record<string, unknown> | null;
  fhir_resource_error: "fhir_resource_unavailable" | null;
}

/** GET /v2/clinicalRecord response. */
export interface ClinicalRecordPage {
  type: "clinical_record";
  user_id: string;
  data: ClinicalRecord[];
  /** Always returned: resume from it later to receive only newer records. */
  next_cursor: string;
  /** More records are available right now. */
  has_more: boolean;
}

export interface TerraUser {
  user_id: string;
  provider: string;
  reference_id: string | null;
  last_webhook_update?: string | null;
  active?: boolean;
}

/** Webhook event `unified_api.clinical_record.updated` (new or changed records). */
export interface ClinicalRecordEvent {
  type: "clinical_record";
  user: TerraUser;
  data: ClinicalRecord[];
  version: string;
}
