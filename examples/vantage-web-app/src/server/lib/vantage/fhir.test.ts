import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCritical, isOutOfRange, parseFhirBundle } from "./fhir";

// Real bundle captured from the Vantage sandbox (Thriva panel).
const bundle = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "fhir-bundle.json"), "utf8"),
);

describe("parseFhirBundle (real sandbox fixture)", () => {
  const parsed = parseFhirBundle(bundle);

  it("extracts the panel, patient, and every observation", () => {
    expect(parsed.panelName).toBeTruthy();
    expect(parsed.patientName).not.toBe("Unknown patient");
    expect(parsed.observations.length).toBeGreaterThan(0);
  });

  it("every observation carries value, unit, and an interpretation code", () => {
    for (const o of parsed.observations) {
      expect(o.display).toBeTruthy();
      expect(o.value).toBeTypeOf("number");
      expect(o.interpretation).toBeTruthy();
    }
  });

  // Pinned: a diagnostics reference app must never mislabel range status.
  // rangeStatus is DERIVED from value vs referenceRange (not read from
  // interpretation) because some live supplier normalisations emit non-HL7
  // vocabulary in interpretation (fix tracked upstream). This fixture
  // captures that exact bug: FERR 70 (range 0-30) arrives coded
  // "not_escalated" and must still render above_range.
  it("derives range status correctly even when interpretation is non-HL7", () => {
    for (const o of parsed.observations) {
      if (o.value === undefined) continue;
      if (o.low !== undefined && o.value < o.low) {
        expect(o.rangeStatus, `${o.display}`).toBe("below_range");
      } else if (o.high !== undefined && o.value > o.high) {
        expect(o.rangeStatus, `${o.display}`).toBe("above_range");
      } else {
        expect(o.rangeStatus, `${o.display}`).toBe("in_range");
      }
    }
    const ferr = parsed.observations.find((o) => o.code === "FERR");
    expect(ferr?.rangeStatus).toBe("above_range");
  });

  it("gracefully handles an empty bundle", () => {
    const empty = parseFhirBundle({});
    expect(empty.observations).toEqual([]);
    expect(empty.patientName).toBe("Unknown patient");
  });
});

describe("interpretation helpers", () => {
  it("classifies HL7 codes", () => {
    expect(isOutOfRange("N")).toBe(false);
    expect(isOutOfRange("L")).toBe(true);
    expect(isOutOfRange("HH")).toBe(true);
    expect(isCritical("H")).toBe(false);
    expect(isCritical("HH")).toBe(true);
  });
});
