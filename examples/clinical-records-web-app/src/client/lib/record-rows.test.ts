import { describe, expect, it } from "vitest";
import { DEMO_RECORDS } from "../../server/demo-fixtures";
import { summarizeRecord } from "../../server/lib/clinical/fhir";
import type { ClinicalRecord } from "../../server/lib/clinical/types";
import type { RecordItem } from "./queries";
import {
  alignDecimals,
  groupRecords,
  notableStatus,
  sentenceCaseTitle,
  shortTestName,
  tidyMedicationName,
  trendValues,
} from "./record-rows";

function item(record: ClinicalRecord): RecordItem {
  return { record, summary: summarizeRecord(record) } as RecordItem;
}

const demo = DEMO_RECORDS["demo-3f2a9c1e-apple"].map(item);
const labs = demo.filter((i) => i.record.clinical_type === "lab_result");

describe("groupRecords", () => {
  it("collapses repeated tests into one row, newest first", () => {
    const groups = groupRecords(labs);
    const a1c = groups.find((g) => g.latest.summary.title === "Hemoglobin A1c");
    expect(a1c?.readings.map((r) => r.summary.quantity?.value)).toEqual([
      "6.1",
      "6.4",
      "6",
    ]);
    expect(a1c && trendValues(a1c)).toEqual([6, 6.4, 6.1]);
    // A1c x3, LDL, HDL, CBC panel -> 4 rows for 6 records.
    expect(labs).toHaveLength(6);
    expect(groups).toHaveLength(4);
  });

  it("never merges panels or non-measurement records", () => {
    const groups = groupRecords(demo);
    const cbc = groups.find((g) => g.latest.summary.components.length > 0);
    expect(cbc?.readings).toHaveLength(1);
    const conditions = groups.filter(
      (g) => g.latest.record.clinical_type === "condition",
    );
    expect(conditions.every((g) => g.readings.length === 1)).toBe(true);
  });

  it("orders groups by their newest reading", () => {
    const dates = groupRecords(labs).map((g) => g.latest.summary.date ?? "");
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("keeps the same code from different record types apart", () => {
    const [a, b] = labs;
    const vital = {
      ...b,
      record: { ...b.record, clinical_type: "vital_sign" },
      summary: { ...b.summary, code: a.summary.code },
    } as RecordItem;
    expect(groupRecords([a, vital])).toHaveLength(2);
  });
});

describe("alignDecimals", () => {
  it("pads plain numbers to the series' precision", () => {
    expect(alignDecimals(["6.1", "6.4", "6"])).toEqual(["6.1", "6.4", "6.0"]);
    expect(alignDecimals(["128/82", "7"])).toEqual(["128/82", "7"]);
  });
});

describe("display names", () => {
  it("shortens LOINC long names", () => {
    expect(
      shortTestName("Cholesterol in HDL [Mass/volume] in Serum or Plasma"),
    ).toBe("Cholesterol in HDL");
    expect(shortTestName("CBC panel - Blood by Automated count")).toBe(
      "CBC panel",
    );
    expect(
      shortTestName("Leukocytes [#/volume] in Blood by Automated count"),
    ).toBe("Leukocytes");
    expect(shortTestName("Hemoglobin A1c")).toBe("Hemoglobin A1c");
  });

  it("sentence-cases names without breaking acronyms", () => {
    expect(sentenceCaseTitle("Blood Pressure")).toBe("Blood pressure");
    expect(sentenceCaseTitle("LDL Cholesterol")).toBe("LDL cholesterol");
    expect(sentenceCaseTitle("Hemoglobin A1c")).toBe("Hemoglobin A1c");
    expect(sentenceCaseTitle("COVID-19 vaccine, mRNA")).toBe(
      "COVID-19 vaccine, mRNA",
    );
    expect(sentenceCaseTitle("Atorvastatin 20 mg Oral Tablet")).toBe(
      "Atorvastatin 20 mg oral tablet",
    );
  });

  it("lowercases RxNorm units", () => {
    expect(tidyMedicationName("Atorvastatin 20 MG Oral Tablet")).toBe(
      "Atorvastatin 20 mg Oral Tablet",
    );
  });

  it("only badges unexpected statuses", () => {
    expect(notableStatus("Active")).toBeNull();
    expect(notableStatus("Final")).toBeNull();
    expect(notableStatus("Resolved")).toBe("Resolved");
  });
});
