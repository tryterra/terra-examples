import { describe, expect, it } from "vitest";
import { prettyUnit } from "./units";

describe("prettyUnit", () => {
  it.each([
    ["Cel", "°C"],
    ["[degF]", "°F"],
    ["10*3/uL", "×10³/µL"],
    ["10*6/uL", "×10⁶/µL"],
    ["10^9/L", "×10⁹/L"],
    ["kg/m2", "kg/m²"],
    ["kg/m^2", "kg/m²"],
    ["mL/min/1.73m2", "mL/min/1.73m²"],
    ["mm[Hg]", "mmHg"],
    ["[lb_av]", "lb"],
    ["umol/L", "µmol/L"],
    ["uIU/mL", "µIU/mL"],
    ["ug/dL", "µg/dL"],
    ["mg/dL", "mg/dL"],
    ["g/dL", "g/dL"],
    ["%", "%"],
    ["U/L", "U/L"],
    ["mg/{total}", "mg"],
  ])("%s -> %s", (raw, pretty) => {
    expect(prettyUnit(raw)).toBe(pretty);
  });

  it("reads per-minute counts as bpm only on heart rate", () => {
    expect(prettyUnit("/min", { heartRate: true })).toBe("bpm");
    expect(prettyUnit("{beats}/min")).toBe("bpm");
    expect(prettyUnit("/min")).toBe("/min");
  });

  it("drops pure annotations and empty units", () => {
    expect(prettyUnit("{cells}")).toBeNull();
    expect(prettyUnit("")).toBeNull();
    expect(prettyUnit(null)).toBeNull();
  });

  it("leaves unknown units alone", () => {
    expect(prettyUnit("tablet")).toBe("tablet");
    expect(prettyUnit("cm[H2O]")).toBe("cmH2O");
  });
});
