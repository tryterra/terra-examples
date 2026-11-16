/**
 * Synthetic Apple Health Records, shaped like Apple's DSTU2 sample records
 * plus a few R4 resources from a second health system. Every patient,
 * clinician, organization, and identifier here is fictional; the FHIR URLs
 * use the reserved `.example` domain. Never put real patient data here.
 */
import { createHash } from "node:crypto";
import type { ClinicalRecord, TerraUser } from "./lib/clinical/types";

export const DEMO_USERS: TerraUser[] = [
  {
    user_id: "demo-3f2a9c1e-apple",
    provider: "APPLE",
    reference_id: "patient-avery-morgan",
  },
  {
    // A connected user whose phone has not shared any records yet: shows the
    // empty state.
    user_id: "demo-8b71d044-apple",
    provider: "APPLE",
    reference_id: "patient-sam-okafor",
  },
];

const LARKSPUR = {
  name: "Larkspur Medical Group",
  bundle: "com.apple.health.5E1C2A90-0B6F-4C1D-9A3E-2F7B8D6C4A11",
  base: "https://fhir.larkspur.example/api/FHIR/DSTU2",
  release: "DSTU2" as const,
};

const NORTHBAY = {
  name: "Northbay Health",
  bundle: "com.apple.health.A7D3E5B2-91C4-4F08-B6A2-0C9E1D3F5B77",
  base: "https://fhir.northbay.example/r4",
  release: "R4" as const,
};

const PATIENT_REF = {
  reference: "Patient/eXk2Lm9QrT",
  display: "Avery Morgan",
};

const LOINC = "http://loinc.org";
const SNOMED = "http://snomed.info/sct";
const RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm";
const CVX = "http://hl7.org/fhir/sid/cvx";
const V2_0078 = "http://hl7.org/fhir/v2/0078";
const R4_INTERP =
  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

function record(
  n: number,
  source: typeof LARKSPUR | typeof NORTHBAY,
  clinicalType: string,
  displayName: string,
  resource: Record<string, unknown> | null,
  opts: { receivedAt: string; resourceType?: string; id?: string },
): ClinicalRecord {
  const resourceType =
    (resource?.resourceType as string) ??
    opts.resourceType ??
    "DocumentReference";
  const id = (resource?.id as string) ?? opts.id ?? `doc-${n}`;
  const json = resource ? JSON.stringify(resource) : "";
  return {
    record_id: `crec_demo_${String(n).padStart(3, "0")}`,
    clinical_type: clinicalType,
    display_name: displayName,
    source_name: source.name,
    source_bundle_id: source.bundle,
    downloaded_at: opts.receivedAt,
    received_at: opts.receivedAt,
    fhir: {
      resource_type: resourceType,
      identifier: id,
      release: source.release,
      source_url: `${source.base}/${resourceType}/${id}`,
      content_sha256: createHash("sha256").update(json).digest("hex"),
      byte_size: Buffer.byteLength(json),
    },
    fhir_resource: resource,
    fhir_resource_error: resource ? null : "fhir_resource_unavailable",
  };
}

/** Short lab names, as health systems usually put them in `code.text`. */
const LAB_TEXT: Record<string, string> = {
  "4548-4": "Hemoglobin A1c",
  "13457-7": "LDL Cholesterol",
  "2085-9": "HDL Cholesterol",
};

function dstu2Lab(
  id: string,
  loinc: string,
  name: string,
  value: number,
  unit: string,
  effective: string,
  range: { low?: number; high?: number },
  flag: "H" | "L" | "N",
) {
  return {
    resourceType: "Observation",
    id,
    status: "final",
    category: {
      coding: [
        {
          system: "http://hl7.org/fhir/observation-category",
          code: "laboratory",
          display: "Laboratory",
        },
      ],
      text: "Laboratory",
    },
    code: {
      coding: [{ system: LOINC, code: loinc, display: name }],
      text: LAB_TEXT[loinc] ?? name,
    },
    subject: PATIENT_REF,
    effectiveDateTime: effective,
    issued: effective.replace("T08:15:00", "T14:02:00"),
    valueQuantity: {
      value,
      unit,
      system: "http://unitsofmeasure.org",
      code: unit,
    },
    interpretation: {
      coding: [
        {
          system: V2_0078,
          code: flag,
          display: flag === "H" ? "High" : flag === "L" ? "Low" : "Normal",
        },
      ],
      text: flag === "H" ? "High" : flag === "L" ? "Low" : "Normal",
    },
    referenceRange: [
      {
        ...(range.low !== undefined
          ? {
              low: {
                value: range.low,
                unit,
                system: "http://unitsofmeasure.org",
                code: unit,
              },
            }
          : {}),
        ...(range.high !== undefined
          ? {
              high: {
                value: range.high,
                unit,
                system: "http://unitsofmeasure.org",
                code: unit,
              },
            }
          : {}),
      },
    ],
    performer: [{ display: "Larkspur Reference Laboratory" }],
  };
}

/** DSTU2 CBC: a panel whose results arrive as components, no top value. */
function cbcPanel() {
  const ucum = "http://unitsofmeasure.org";
  const part = (
    loinc: string,
    display: string,
    value: number,
    unit: string,
    low: number,
    high: number,
    flag?: "L" | "H",
  ) => ({
    code: { coding: [{ system: LOINC, code: loinc, display }] },
    valueQuantity: { value, unit, system: ucum, code: unit },
    ...(flag
      ? {
          interpretation: {
            coding: [{ system: V2_0078, code: flag }],
          },
        }
      : {}),
    referenceRange: [
      {
        low: { value: low, unit, system: ucum, code: unit },
        high: { value: high, unit, system: ucum, code: unit },
      },
    ],
  });
  return {
    resourceType: "Observation",
    id: "eLb.CBC.20261103",
    status: "final",
    category: {
      coding: [
        {
          system: "http://hl7.org/fhir/observation-category",
          code: "laboratory",
          display: "Laboratory",
        },
      ],
      text: "Laboratory",
    },
    code: {
      coding: [
        {
          system: LOINC,
          code: "58410-2",
          display: "CBC panel - Blood by Automated count",
        },
      ],
      text: "CBC panel - Blood by Automated count",
    },
    subject: PATIENT_REF,
    effectiveDateTime: "2026-11-03T08:15:00-08:00",
    component: [
      part(
        "6690-2",
        "Leukocytes [#/volume] in Blood by Automated count",
        7.2,
        "10*3/uL",
        4.5,
        11,
      ),
      part(
        "789-8",
        "Erythrocytes [#/volume] in Blood by Automated count",
        4.1,
        "10*6/uL",
        4.2,
        5.9,
        "L",
      ),
      part(
        "718-7",
        "Hemoglobin [Mass/volume] in Blood",
        13.9,
        "g/dL",
        13.5,
        17.5,
      ),
      part(
        "777-3",
        "Platelets [#/volume] in Blood by Automated count",
        251,
        "10*3/uL",
        150,
        400,
      ),
    ],
    performer: [{ display: "Larkspur Reference Laboratory" }],
  };
}

/** R4 vital sign with a single UCUM quantity. */
function r4Vital(
  id: string,
  loinc: string,
  display: string,
  value: number,
  ucum: string,
) {
  return {
    resourceType: "Observation",
    id,
    status: "final",
    category: [
      {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs",
          },
        ],
      },
    ],
    code: { coding: [{ system: LOINC, code: loinc, display }], text: display },
    subject: { reference: "Patient/nb-55210" },
    effectiveDateTime: "2026-10-21T10:30:00-07:00",
    valueQuantity: {
      value,
      unit: ucum,
      system: "http://unitsofmeasure.org",
      code: ucum,
    },
  };
}

const R1 = "2026-11-09T18:42:10Z";
const R2 = "2026-11-12T07:05:33Z";

export const DEMO_RECORDS: Record<string, ClinicalRecord[]> = {
  "demo-3f2a9c1e-apple": [
    record(
      1,
      LARKSPUR,
      "lab_result",
      "Hemoglobin A1c",
      dstu2Lab(
        "eLb.A1c.20261103",
        "4548-4",
        "Hemoglobin A1c/Hemoglobin.total in Blood",
        6.1,
        "%",
        "2026-11-03T08:15:00-08:00",
        { low: 4.0, high: 5.6 },
        "H",
      ),
      { receivedAt: R1 },
    ),
    record(
      2,
      LARKSPUR,
      "lab_result",
      "Hemoglobin A1c",
      dstu2Lab(
        "eLb.A1c.20260512",
        "4548-4",
        "Hemoglobin A1c/Hemoglobin.total in Blood",
        6.4,
        "%",
        "2026-05-12T08:15:00-07:00",
        { low: 4.0, high: 5.6 },
        "H",
      ),
      { receivedAt: R1 },
    ),
    record(
      3,
      LARKSPUR,
      "lab_result",
      "LDL Cholesterol",
      dstu2Lab(
        "eLb.LDL.20261103",
        "13457-7",
        "Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation",
        142,
        "mg/dL",
        "2026-11-03T08:15:00-08:00",
        { high: 100 },
        "H",
      ),
      { receivedAt: R1 },
    ),
    record(
      4,
      LARKSPUR,
      "lab_result",
      "HDL Cholesterol",
      dstu2Lab(
        "eLb.HDL.20261103",
        "2085-9",
        "Cholesterol in HDL [Mass/volume] in Serum or Plasma",
        54,
        "mg/dL",
        "2026-11-03T08:15:00-08:00",
        { low: 40 },
        "N",
      ),
      { receivedAt: R1 },
    ),
    record(
      5,
      LARKSPUR,
      "vital_sign",
      "Blood Pressure",
      {
        resourceType: "Observation",
        id: "eVs.BP.20261103",
        status: "final",
        category: {
          coding: [
            {
              system: "http://hl7.org/fhir/observation-category",
              code: "vital-signs",
              display: "Vital Signs",
            },
          ],
          text: "Vital Signs",
        },
        code: {
          coding: [
            {
              system: LOINC,
              code: "55284-4",
              display: "Blood pressure systolic and diastolic",
            },
          ],
          text: "Blood Pressure",
        },
        subject: PATIENT_REF,
        effectiveDateTime: "2026-11-03T08:02:00-08:00",
        component: [
          {
            code: {
              coding: [
                {
                  system: LOINC,
                  code: "8480-6",
                  display: "Systolic blood pressure",
                },
              ],
              text: "Systolic",
            },
            valueQuantity: {
              value: 128,
              unit: "mmHg",
              system: "http://unitsofmeasure.org",
              code: "mm[Hg]",
            },
          },
          {
            code: {
              coding: [
                {
                  system: LOINC,
                  code: "8462-4",
                  display: "Diastolic blood pressure",
                },
              ],
              text: "Diastolic",
            },
            valueQuantity: {
              value: 82,
              unit: "mmHg",
              system: "http://unitsofmeasure.org",
              code: "mm[Hg]",
            },
          },
        ],
      },
      { receivedAt: R1 },
    ),
    record(
      6,
      LARKSPUR,
      "vital_sign",
      "Pulse",
      {
        resourceType: "Observation",
        id: "eVs.HR.20261103",
        status: "final",
        category: {
          coding: [
            {
              system: "http://hl7.org/fhir/observation-category",
              code: "vital-signs",
            },
          ],
          text: "Vital Signs",
        },
        code: {
          coding: [{ system: LOINC, code: "8867-4", display: "Heart rate" }],
          text: "Pulse",
        },
        subject: PATIENT_REF,
        effectiveDateTime: "2026-11-03T08:02:00-08:00",
        valueQuantity: {
          value: 68,
          unit: "/min",
          system: "http://unitsofmeasure.org",
          code: "/min",
        },
      },
      { receivedAt: R1 },
    ),
    record(
      7,
      NORTHBAY,
      "vital_sign",
      "Body Weight",
      {
        resourceType: "Observation",
        id: "obs-wt-7731",
        meta: {
          profile: ["http://hl7.org/fhir/StructureDefinition/bodyweight"],
        },
        status: "final",
        category: [
          {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "vital-signs",
                display: "Vital Signs",
              },
            ],
          },
        ],
        code: {
          coding: [{ system: LOINC, code: "29463-7", display: "Body weight" }],
          text: "Body Weight",
        },
        subject: { reference: "Patient/nb-55210" },
        effectiveDateTime: "2026-10-21T10:30:00-07:00",
        valueQuantity: {
          value: 81.6,
          unit: "kg",
          system: "http://unitsofmeasure.org",
          code: "kg",
        },
        interpretation: [
          { coding: [{ system: R4_INTERP, code: "N", display: "Normal" }] },
        ],
      },
      { receivedAt: R2 },
    ),
    record(
      8,
      LARKSPUR,
      "condition",
      "Prediabetes",
      {
        resourceType: "Condition",
        id: "eCn.714628002",
        patient: PATIENT_REF,
        asserter: { display: "Priya Raman, MD" },
        dateRecorded: "2026-05-14",
        code: {
          coding: [
            { system: SNOMED, code: "714628002", display: "Prediabetes" },
            {
              system: "http://hl7.org/fhir/sid/icd-10-cm",
              code: "R73.03",
              display: "Prediabetes",
            },
          ],
          text: "Prediabetes",
        },
        category: {
          coding: [
            {
              system: "http://hl7.org/fhir/condition-category",
              code: "diagnosis",
              display: "Diagnosis",
            },
          ],
          text: "Diagnosis",
        },
        clinicalStatus: "active",
        verificationStatus: "confirmed",
        onsetDateTime: "2026-05-12",
      },
      { receivedAt: R1 },
    ),
    record(
      9,
      LARKSPUR,
      "condition",
      "Acute sinusitis",
      {
        resourceType: "Condition",
        id: "eCn.15805002",
        patient: PATIENT_REF,
        dateRecorded: "2025-02-03",
        code: {
          coding: [
            { system: SNOMED, code: "15805002", display: "Acute sinusitis" },
          ],
          text: "Acute sinusitis",
        },
        clinicalStatus: "resolved",
        verificationStatus: "confirmed",
        onsetDateTime: "2025-01-28",
        abatementDateTime: "2025-02-20",
      },
      { receivedAt: R1 },
    ),
    record(
      10,
      LARKSPUR,
      "medication",
      "Atorvastatin 20 MG Oral Tablet",
      {
        resourceType: "MedicationStatement",
        id: "eMs.617310",
        patient: PATIENT_REF,
        status: "active",
        dateAsserted: "2026-11-05",
        medicationCodeableConcept: {
          coding: [
            {
              system: RXNORM,
              code: "617310",
              display: "Atorvastatin 20 MG Oral Tablet",
            },
          ],
          text: "Atorvastatin 20 MG Oral Tablet",
        },
        effectivePeriod: { start: "2026-11-05" },
        reasonForUseCodeableConcept: { text: "Hyperlipidemia" },
        dosage: [
          {
            text: "Take 1 tablet (20 mg total) by mouth once daily.",
            timing: { repeat: { frequency: 1, period: 1, periodUnits: "d" } },
            route: { text: "Oral" },
            quantityQuantity: { value: 20, unit: "mg" },
          },
        ],
      },
      { receivedAt: R1 },
    ),
    record(
      11,
      LARKSPUR,
      "medication",
      "Metformin 500 MG Oral Tablet",
      {
        resourceType: "MedicationOrder",
        id: "eMo.861007",
        dateWritten: "2026-05-14",
        status: "active",
        patient: PATIENT_REF,
        prescriber: { display: "Priya Raman, MD" },
        medicationCodeableConcept: {
          coding: [
            {
              system: RXNORM,
              code: "861007",
              display: "Metformin hydrochloride 500 MG Oral Tablet",
            },
          ],
          text: "Metformin 500 MG Oral Tablet",
        },
        dosageInstruction: [
          {
            text: "Take 1 tablet (500 mg total) by mouth 2 times daily with meals.",
            timing: { repeat: { frequency: 2, period: 1, periodUnits: "d" } },
            route: { text: "Oral" },
            doseQuantity: { value: 500, unit: "mg" },
          },
        ],
        dispenseRequest: {
          numberOfRepeatsAllowed: 3,
          quantity: { value: 180, unit: "tablet" },
        },
      },
      { receivedAt: R1 },
    ),
    record(
      12,
      LARKSPUR,
      "allergy",
      "Penicillin",
      {
        resourceType: "AllergyIntolerance",
        id: "eAl.7980",
        recordedDate: "2019-04-22",
        patient: PATIENT_REF,
        substance: {
          coding: [{ system: RXNORM, code: "7980", display: "Penicillin G" }],
          text: "Penicillin",
        },
        status: "confirmed",
        criticality: "CRITH",
        type: "allergy",
        category: "medication",
        reaction: [
          {
            manifestation: [
              {
                coding: [
                  { system: SNOMED, code: "247472004", display: "Hives" },
                ],
                text: "Hives",
              },
            ],
            severity: "moderate",
          },
        ],
      },
      { receivedAt: R1 },
    ),
    record(
      13,
      LARKSPUR,
      "procedure",
      "Colonoscopy",
      {
        resourceType: "Procedure",
        id: "ePr.73761001",
        subject: PATIENT_REF,
        status: "completed",
        code: {
          coding: [
            { system: SNOMED, code: "73761001", display: "Colonoscopy" },
          ],
          text: "Colonoscopy",
        },
        performedDateTime: "2024-06-18T09:30:00-07:00",
        performer: [{ actor: { display: "Daniel Ortiz, MD" } }],
        location: { display: "Larkspur Endoscopy Center" },
        outcome: { text: "No polyps found" },
      },
      { receivedAt: R1 },
    ),
    record(
      14,
      LARKSPUR,
      "immunization",
      "Influenza, seasonal, injectable",
      {
        resourceType: "Immunization",
        id: "eIm.141.2025",
        status: "completed",
        date: "2025-10-03",
        vaccineCode: {
          coding: [
            {
              system: CVX,
              code: "141",
              display: "Influenza, seasonal, injectable",
            },
          ],
          text: "Influenza, seasonal, injectable",
        },
        patient: PATIENT_REF,
        wasNotGiven: false,
        reported: false,
        lotNumber: "FL2025-118B",
        site: { text: "Left arm" },
        route: { text: "Intramuscular" },
      },
      { receivedAt: R1 },
    ),
    record(
      15,
      NORTHBAY,
      "immunization",
      "COVID-19 vaccine",
      {
        resourceType: "Immunization",
        id: "imm-9921",
        status: "completed",
        vaccineCode: {
          coding: [
            {
              system: CVX,
              code: "309",
              display:
                "SARS-COV-2 (COVID-19) vaccine, mRNA, spike protein, LNP, preservative free, 50 mcg/0.5mL dose",
            },
          ],
          text: "COVID-19 vaccine, mRNA",
        },
        patient: { reference: "Patient/nb-55210" },
        occurrenceDateTime: "2026-10-21T10:45:00-07:00",
        primarySource: true,
        lotNumber: "MX2026-44",
        site: { coding: [{ display: "Right arm" }] },
        protocolApplied: [{ doseNumberPositiveInt: 1 }],
      },
      { receivedAt: R2 },
    ),
    record(
      16,
      NORTHBAY,
      "medication",
      "Fluticasone propionate 50 MCG/ACTUAT Nasal Spray",
      {
        resourceType: "MedicationRequest",
        id: "mr-30411",
        status: "completed",
        intent: "order",
        medicationCodeableConcept: {
          coding: [
            {
              system: RXNORM,
              code: "1797907",
              display: "fluticasone propionate 50 MCG/ACTUAT Nasal Spray",
            },
          ],
          text: "Fluticasone propionate 50 MCG/ACTUAT Nasal Spray",
        },
        subject: { reference: "Patient/nb-55210" },
        authoredOn: "2025-01-28",
        requester: { display: "Mei Chen, NP" },
        dosageInstruction: [
          {
            timing: { repeat: { frequency: 1, period: 1, periodUnit: "d" } },
            route: { text: "Nasal" },
            doseAndRate: [{ doseQuantity: { value: 2, unit: "spray" } }],
          },
        ],
      },
      { receivedAt: R2 },
    ),
    record(17, NORTHBAY, "clinical_note", "Discharge Summary", null, {
      receivedAt: R2,
      resourceType: "DocumentReference",
      id: "doc-77201",
    }),
    record(
      18,
      LARKSPUR,
      "lab_result",
      "Hemoglobin A1c",
      dstu2Lab(
        "eLb.A1c.20251104",
        "4548-4",
        "Hemoglobin A1c/Hemoglobin.total in Blood",
        6.0,
        "%",
        "2025-11-04T08:15:00-08:00",
        { low: 4.0, high: 5.6 },
        "H",
      ),
      { receivedAt: R1 },
    ),
    record(19, LARKSPUR, "lab_result", "CBC panel", cbcPanel(), {
      receivedAt: R1,
    }),
    record(
      20,
      NORTHBAY,
      "vital_sign",
      "Body Temperature",
      r4Vital("obs-temp-7732", "8310-5", "Body temperature", 37.6, "Cel"),
      { receivedAt: R2 },
    ),
    record(
      21,
      NORTHBAY,
      "vital_sign",
      "BMI",
      r4Vital("obs-bmi-7733", "39156-5", "Body mass index", 26.2, "kg/m2"),
      { receivedAt: R2 },
    ),
    record(
      22,
      LARKSPUR,
      "vital_sign",
      "Pulse",
      {
        resourceType: "Observation",
        id: "eVs.HR.20260512",
        status: "final",
        category: {
          coding: [
            {
              system: "http://hl7.org/fhir/observation-category",
              code: "vital-signs",
            },
          ],
          text: "Vital Signs",
        },
        code: {
          coding: [{ system: LOINC, code: "8867-4", display: "Heart rate" }],
          text: "Pulse",
        },
        subject: PATIENT_REF,
        effectiveDateTime: "2026-05-12T08:02:00-07:00",
        valueQuantity: {
          value: 74,
          unit: "/min",
          system: "http://unitsofmeasure.org",
          code: "/min",
        },
      },
      { receivedAt: R1 },
    ),
  ],
};
