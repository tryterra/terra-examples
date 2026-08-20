import { describe, expect, it } from "vitest";
import {
  interpolateBands,
  labContribution,
  scoreDomain,
  scoreLabResult,
  wearableContribution,
} from "./scoring";
import { domainNarrative, overallNarrative } from "./narrative";
import { latestByBiomarker } from "./index";
import type { DomainConfig } from "./domains";
import type { LabReportResult, LabReportSession } from "../terra/types";

/** Golden-shaped result (mirrors the v6 webhook/API parity fixture). */
const hemoglobinHigh: LabReportResult = {
  source: {
    name: "Hemoglobin",
    panel: "CBC",
    value: "19.2",
    units: "g/dL",
    flag: "H",
    reference_text: "13.5 - 17.5",
  },
  biomarker: {
    key: "hemoglobin_blood",
    display_name: "Hemoglobin",
    loinc_code: "718-7",
    panel_id: 1,
    panel_key: "cbc",
    specimen: "blood",
  },
  measurement: { type: "numeric", numeric: 19.2, units: "g/dL", ucum_code: "g/dL" },
  interpretation: {
    flag: "high",
    flag_raw: "H",
    source: "report",
    applied_range: { lower: 13.5, upper: 17.5 },
  },
  reference_ranges: [{ lower: 13.5, upper: 17.5, type: "normal" }],
};

const inRange: LabReportResult = {
  ...hemoglobinHigh,
  measurement: { type: "numeric", numeric: 14.2, units: "g/dL" },
  interpretation: {
    flag: "normal",
    source: "report",
    applied_range: { lower: 13.5, upper: 17.5 },
  },
};

const qualitativePositive: LabReportResult = {
  source: { name: "Mystery Analyte", value: "Positive" },
  biomarker: { key: "mystery" },
  measurement: { type: "qualitative", qualitative: { text: "positive" } },
  interpretation: { flag: "abnormal", source: "report" },
};

describe("scoreLabResult", () => {
  it("scores in-range numeric as 100", () => {
    expect(scoreLabResult(inRange)).toBe(100);
  });

  it("decays with relative deviation past the bound", () => {
    // 19.2 vs upper 17.5, width 4 → relDev 0.425 → 70 - 25.5 → 45 (rounded)
    expect(scoreLabResult(hemoglobinHigh)).toBe(45);
  });

  it("falls back to the flag when no numeric range exists", () => {
    expect(scoreLabResult(qualitativePositive)).toBe(40);
  });

  it("returns null with no range and no flag", () => {
    expect(
      scoreLabResult({
        ...qualitativePositive,
        interpretation: { flag: null, source: "none" },
      }),
    ).toBeNull();
  });
});

describe("interpolateBands", () => {
  const bands: Array<[number, number]> = [
    [55, 100],
    [70, 80],
    [85, 30],
  ];
  it("clamps outside the ends", () => {
    expect(interpolateBands(bands, 40)).toBe(100);
    expect(interpolateBands(bands, 100)).toBe(30);
  });
  it("interpolates between points", () => {
    expect(interpolateBands(bands, 62.5)).toBe(90);
    expect(interpolateBands(bands, 77.5)).toBe(55);
  });
});

describe("wearableContribution", () => {
  const config = {
    metric: "restingHr" as const,
    label: "Resting heart rate",
    unit: "bpm",
    weight: 2,
    bands: [
      [55, 100],
      [70, 80],
      [85, 30],
    ] as Array<[number, number]>,
  };
  it("averages the trailing window", () => {
    const points = [58, 60, 62].map((value, i) => ({
      date: `2026-08-0${i + 1}`,
      value,
    }));
    const c = wearableContribution(config, points)!;
    expect(c.valueText).toBe("60 bpm");
    expect(c.subscore).toBeGreaterThanOrEqual(90);
    expect(c.severity).toBe("normal");
  });
  it("returns null with no data", () => {
    expect(wearableContribution(config, [])).toBeNull();
  });
});

describe("scoreDomain", () => {
  const domain: DomainConfig = {
    key: "test",
    label: "Test",
    description: "",
    labInputs: [],
    wearableInputs: [],
  };
  it("needs minInputs contributions", () => {
    const one = labContribution(
      { biomarkerKeys: ["hemoglobin_blood"], label: "Hemoglobin", weight: 1 },
      inRange,
    )!;
    expect(scoreDomain(domain, [one]).score).toBeNull();
    expect(scoreDomain(domain, [one]).status).toBe("Insufficient data");
  });
  it("weights the mean", () => {
    const good = labContribution(
      { biomarkerKeys: ["a"], label: "A", weight: 3 },
      inRange,
    )!;
    const bad = labContribution(
      { biomarkerKeys: ["b"], label: "B", weight: 1 },
      hemoglobinHigh,
    )!;
    // (100*3 + 45*1) / 4 = 86.25 → 86
    expect(scoreDomain(domain, [good, bad]).score).toBe(86);
  });
});

describe("narrative", () => {
  it("is deterministic and names the finding with provenance", () => {
    const contribution = labContribution(
      { biomarkerKeys: ["hemoglobin_blood"], label: "Hemoglobin", weight: 1 },
      hemoglobinHigh,
    )!;
    const domain = scoreDomain(
      {
        key: "inflammation",
        label: "Inflammation",
        description: "",
        minInputs: 1,
        labInputs: [],
        wearableInputs: [],
      },
      [contribution],
    );
    const first = domainNarrative(domain);
    const second = domainNarrative(domain);
    expect(first).toEqual(second);
    expect(first[0]).toBe(
      "Hemoglobin is high at 19.2 g/dL (reference 13.5–17.5, flagged on the lab report).",
    );
  });

  it("summarises across domains", () => {
    const text = overallNarrative([
      {
        key: "a",
        label: "Metabolic",
        description: "",
        score: 90,
        status: "Good",
        contributions: [],
      },
      {
        key: "b",
        label: "Inflammation",
        description: "",
        score: 30,
        status: "Poor",
        contributions: [],
      },
    ]);
    expect(text).toContain("Metabolic looks good");
    expect(text).toContain("Inflammation needs attention");
  });
});

describe("latestByBiomarker", () => {
  it("newest collection date wins and unmatched rows are skipped", () => {
    const older: LabReportSession = {
      session_id: "1",
      current_status: "sent",
      collection_date: "2026-01-01",
      results: [inRange, qualitativePositive],
    };
    const newer: LabReportSession = {
      session_id: "2",
      current_status: "standardized",
      collection_date: "2026-06-01",
      results: [hemoglobinHigh],
    };
    const map = latestByBiomarker([newer, older]);
    expect(map.get("hemoglobin_blood")?.interpretation.flag).toBe("high");
    expect(map.has("mystery")).toBe(true);
    // Sessions still processing are ignored entirely.
    expect(
      latestByBiomarker([{ ...newer, current_status: "processing" }]).size,
    ).toBe(0);
  });
});
