import { describe, expect, it } from "vitest";
import { DEMO_RECORDS } from "../../demo-fixtures";
import { summarizeRecord } from "./fhir";
import type { ClinicalRecord } from "./types";

function rec(
  resource: Record<string, unknown> | null,
  over: Partial<ClinicalRecord> = {},
): ClinicalRecord {
  return {
    record_id: "r1",
    clinical_type: "lab_result",
    display_name: "Terra display name",
    source_name: "Test Health",
    source_bundle_id: "com.apple.health.test",
    downloaded_at: "2026-01-02T00:00:00Z",
    received_at: "2026-01-03T00:00:00Z",
    fhir: {
      resource_type: (resource?.resourceType as string) ?? "Observation",
      identifier: "x",
      release: null,
      source_url: null,
      content_sha256: "",
      byte_size: 0,
    },
    fhir_resource: resource,
    fhir_resource_error: resource ? null : "fhir_resource_unavailable",
    ...over,
  };
}

describe("Observation", () => {
  it("DSTU2 lab: value, unit, range, single-concept interpretation", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ code: "4548-4", display: "Hemoglobin A1c" }] },
        effectiveDateTime: "2026-03-12T08:15:00-08:00",
        valueQuantity: { value: 6.1, unit: "%" },
        interpretation: { coding: [{ code: "H", display: "High" }] },
        referenceRange: [
          { low: { value: 4, unit: "%" }, high: { value: 5.6, unit: "%" } },
        ],
      }),
    );
    expect(s).toMatchObject({
      parsed: true,
      title: "Hemoglobin A1c",
      value: "6.1 %",
      date: "2026-03-12T08:15:00-08:00",
      dateLabel: "Effective",
      status: "Final",
      flag: { code: "H", label: "High", tone: "high" },
    });
    expect(s.details).toContainEqual({
      label: "Reference range",
      value: "4-5.6 %",
    });
  });

  it("R4 lab: interpretation array, one-sided range, effectivePeriod", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Observation",
        code: { text: "LDL Cholesterol" },
        effectivePeriod: { start: "2026-04-01", end: "2026-04-01" },
        valueQuantity: { value: 142, unit: "mg/dL" },
        interpretation: [{ coding: [{ system: "v3", code: "L" }] }],
        referenceRange: [{ high: { value: 100, unit: "mg/dL" } }],
      }),
    );
    expect(s.value).toBe("142 mg/dL");
    expect(s.date).toBe("2026-04-01");
    expect(s.flag).toEqual({ code: "L", label: "Low", tone: "low" });
    expect(s.details).toContainEqual({
      label: "Reference range",
      value: "<100 mg/dL",
    });
  });

  it("derives a flag from the range when none is sent", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Observation",
        code: { text: "Glucose" },
        valueQuantity: { value: 130, unit: "mg/dL" },
        referenceRange: [{ low: { value: 70 }, high: { value: 99 } }],
      }),
    );
    expect(s.flag?.tone).toBe("high");
  });

  it("blood pressure components collapse to systolic/diastolic", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Observation",
        code: { text: "Blood Pressure" },
        effectiveDateTime: "2026-03-12",
        component: [
          {
            code: { coding: [{ code: "8480-6" }] },
            valueQuantity: { value: 128, unit: "mmHg" },
          },
          {
            code: { coding: [{ code: "8462-4" }] },
            valueQuantity: { value: 82, unit: "mmHg" },
          },
        ],
      }),
    );
    expect(s.value).toBe("128/82 mmHg");
  });

  it("drops UCUM annotation units and keeps codeable values", () => {
    expect(
      summarizeRecord(
        rec({
          resourceType: "Observation",
          code: { text: "RBC" },
          valueQuantity: { value: 4.5, unit: "{cells}" },
        }),
      ).value,
    ).toBe("4.5");
    expect(
      summarizeRecord(
        rec({
          resourceType: "Observation",
          code: { text: "Strep" },
          valueCodeableConcept: { text: "Negative" },
        }),
      ).value,
    ).toBe("Negative");
  });
});

describe("Condition", () => {
  it("DSTU2: string statuses, dateRecorded, abatement", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Condition",
        code: { text: "Acute sinusitis" },
        clinicalStatus: "resolved",
        verificationStatus: "confirmed",
        onsetDateTime: "2025-01-28",
        abatementDateTime: "2025-02-20",
        dateRecorded: "2025-02-03",
      }),
    );
    expect(s).toMatchObject({
      title: "Acute sinusitis",
      status: "Resolved",
      date: "2025-01-28",
      dateLabel: "Onset",
    });
    expect(s.details).toEqual(
      expect.arrayContaining([
        { label: "Resolved", value: "2025-02-20" },
        { label: "Verification", value: "Confirmed" },
        { label: "Recorded", value: "2025-02-03" },
      ]),
    );
  });

  it("R4: CodeableConcept statuses, recordedDate when no onset", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Condition",
        code: { coding: [{ display: "Prediabetes" }] },
        clinicalStatus: { coding: [{ code: "active" }] },
        verificationStatus: { coding: [{ code: "unconfirmed" }] },
        recordedDate: "2026-05-14",
      }),
    );
    expect(s).toMatchObject({
      title: "Prediabetes",
      status: "Active",
      date: "2026-05-14",
      dateLabel: "Recorded",
    });
    expect(s.details).toContainEqual({
      label: "Verification",
      value: "Unconfirmed",
    });
  });
});

describe("Medications", () => {
  it("DSTU2 MedicationStatement: dosage text + effectivePeriod", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "MedicationStatement",
        status: "active",
        medicationCodeableConcept: { text: "Atorvastatin 20 MG Oral Tablet" },
        effectivePeriod: { start: "2026-03-14" },
        dosage: [{ text: "Take 1 tablet by mouth once daily." }],
      }),
    );
    expect(s).toMatchObject({
      title: "Atorvastatin 20 MG Oral Tablet",
      value: "Take 1 tablet by mouth once daily.",
      date: "2026-03-14",
      dateLabel: "Started",
      status: "Active",
    });
  });

  it("DSTU2 MedicationOrder: dosageInstruction, dateWritten, prescriber", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "MedicationOrder",
        medicationReference: { display: "Metformin 500 MG" },
        dateWritten: "2025-09-10",
        prescriber: { display: "Dr. Raman" },
        dosageInstruction: [
          {
            doseQuantity: { value: 500, unit: "mg" },
            timing: { repeat: { frequency: 2, period: 1, periodUnits: "d" } },
          },
        ],
      }),
    );
    expect(s).toMatchObject({
      title: "Metformin 500 MG",
      value: "500 mg, 2x every day",
      date: "2025-09-10",
      dateLabel: "Prescribed",
    });
    expect(s.details).toContainEqual({
      label: "Prescriber",
      value: "Dr. Raman",
    });
  });

  it("R4 MedicationRequest: doseAndRate, authoredOn, requester", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "MedicationRequest",
        status: "completed",
        medicationCodeableConcept: {
          coding: [{ display: "Fluticasone nasal spray" }],
        },
        authoredOn: "2025-01-28",
        requester: { display: "Mei Chen, NP" },
        dosageInstruction: [
          {
            doseAndRate: [{ doseQuantity: { value: 2, unit: "spray" } }],
            route: { text: "Nasal" },
          },
        ],
      }),
    );
    expect(s).toMatchObject({
      value: "2 spray, Nasal",
      date: "2025-01-28",
      status: "Completed",
    });
    expect(s.details).toContainEqual({
      label: "Prescriber",
      value: "Mei Chen, NP",
    });
  });
});

describe("AllergyIntolerance", () => {
  it("DSTU2: substance, reaction, severity, CRITH", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "AllergyIntolerance",
        substance: { text: "Penicillin" },
        status: "confirmed",
        criticality: "CRITH",
        reaction: [
          { manifestation: [{ text: "Hives" }], severity: "moderate" },
        ],
      }),
    );
    expect(s).toMatchObject({
      title: "Penicillin",
      value: "Reaction: Hives",
      status: "Confirmed",
      flag: { tone: "high", label: "High criticality" },
    });
    expect(s.details).toContainEqual({ label: "Severity", value: "Moderate" });
    expect(s.details).toContainEqual({ label: "Criticality", value: "High" });
  });

  it("R4: code + clinicalStatus concept + low criticality", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "AllergyIntolerance",
        code: { coding: [{ display: "Peanut" }] },
        clinicalStatus: { coding: [{ code: "active" }] },
        criticality: "low",
        onsetDateTime: "2010-06-01",
        reaction: [
          {
            manifestation: [{ coding: [{ display: "Swelling" }] }],
            severity: "mild",
          },
        ],
      }),
    );
    expect(s).toMatchObject({
      title: "Peanut",
      status: "Active",
      flag: null,
      date: "2010-06-01",
      dateLabel: "Onset",
    });
  });
});

describe("Procedure and Immunization", () => {
  it("Procedure works for performedDateTime and performedPeriod", () => {
    const a = summarizeRecord(
      rec({
        resourceType: "Procedure",
        code: { text: "Colonoscopy" },
        status: "completed",
        performedDateTime: "2024-06-18",
        performer: [{ actor: { display: "Dr. Ortiz" } }],
      }),
    );
    expect(a).toMatchObject({
      title: "Colonoscopy",
      date: "2024-06-18",
      status: "Completed",
    });
    expect(a.details).toContainEqual({
      label: "Performer",
      value: "Dr. Ortiz",
    });
    const b = summarizeRecord(
      rec({
        resourceType: "Procedure",
        code: { text: "Knee MRI" },
        performedPeriod: { start: "2025-02-01", end: "2025-02-02" },
      }),
    );
    expect(b.date).toBe("2025-02-01");
  });

  it("DSTU2 Immunization: date, doseSequence, wasNotGiven", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Immunization",
        vaccineCode: { text: "Influenza" },
        date: "2025-10-03",
        status: "completed",
        wasNotGiven: true,
        vaccinationProtocol: [{ doseSequence: 2 }],
      }),
    );
    expect(s).toMatchObject({
      date: "2025-10-03",
      dateLabel: "Administered",
      flag: { label: "Not given" },
    });
    expect(s.details).toContainEqual({ label: "Dose", value: "#2" });
  });

  it("R4 Immunization: occurrenceDateTime + protocolApplied", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Immunization",
        vaccineCode: { coding: [{ display: "COVID-19 mRNA" }] },
        occurrenceDateTime: "2026-10-21T10:45:00-07:00",
        status: "completed",
        protocolApplied: [{ doseNumberPositiveInt: 1 }],
      }),
    );
    expect(s).toMatchObject({
      title: "COVID-19 mRNA",
      date: "2026-10-21T10:45:00-07:00",
      flag: null,
    });
    expect(s.details).toContainEqual({ label: "Dose", value: "#1" });
  });
});

describe("fallbacks", () => {
  it("fhir_resource_unavailable: display_name + downloaded_at", () => {
    const s = summarizeRecord(rec(null, { display_name: "Discharge Summary" }));
    expect(s).toMatchObject({
      parsed: false,
      title: "Discharge Summary",
      date: "2026-01-02T00:00:00Z",
    });
  });

  it("unknown resource type: display_name + generic date", () => {
    const s = summarizeRecord(
      rec(
        {
          resourceType: "Coverage",
          status: "active",
          period: { start: "2026-01-01" },
          payor: [{ display: "Acme Health Plan" }],
        },
        { display_name: "Insurance" },
      ),
    );
    expect(s).toMatchObject({
      parsed: false,
      title: "Insurance",
      date: "2026-01-01",
      status: "Active",
    });
    expect(s.details).toContainEqual({
      label: "Payor",
      value: "Acme Health Plan",
    });
  });

  it("missing code falls back to display_name; malformed fields never throw", () => {
    const s = summarizeRecord(
      rec({
        resourceType: "Observation",
        valueQuantity: "oops",
        interpretation: 7,
        referenceRange: "x",
      }),
    );
    expect(s).toMatchObject({
      parsed: true,
      title: "Terra display name",
      value: null,
      flag: null,
    });
  });

  it("every demo fixture summarizes with a title and a date", () => {
    for (const r of Object.values(DEMO_RECORDS).flat()) {
      const s = summarizeRecord(r);
      expect(s.title, r.record_id).toBeTruthy();
      expect(s.date, r.record_id).toBeTruthy();
      expect(s.parsed, r.record_id).toBe(r.fhir_resource !== null);
    }
  });
});
