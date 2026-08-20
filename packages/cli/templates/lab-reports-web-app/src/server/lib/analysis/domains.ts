/**
 * The analysis registry: five health domains, each fed by weighted lab
 * biomarkers and wearable metrics. Everything the engine does is declared
 * here — scoring.ts and narrative.ts are generic over this config.
 *
 * `biomarkerKeys` lists canonical Terra slugs, first match wins. These are
 * the single fix-up point: pin them against a real standardized session
 * (several plausible variants are listed until then).
 *
 * Wearable `bands` are piecewise-linear (value, subscore) points sorted by
 * value; values outside the ends clamp to the end subscores. Direction is
 * encoded by the points themselves (descending subscores = lower is better).
 */
import type { MetricKey } from "../wearables";

export interface LabInputConfig {
  /** Canonical biomarker key candidates, most specific first. */
  biomarkerKeys: string[];
  label: string;
  weight: number;
  /**
   * Guideline-cutoff fallback, used ONLY when the report printed no
   * reference range and no flag (common for bare value exports). Applied
   * only when the measurement's units match `bandsUnit`, and surfaced with
   * "guideline cutoffs" provenance so it is never confused with the lab's
   * own range.
   */
  bands?: Array<[value: number, subscore: number]>;
  bandsUnit?: string;
}

export interface WearableInputConfig {
  metric: MetricKey;
  label: string;
  unit: string;
  weight: number;
  bands: Array<[value: number, subscore: number]>;
}

export interface DomainConfig {
  key: string;
  label: string;
  description: string;
  labInputs: LabInputConfig[];
  wearableInputs: WearableInputConfig[];
  /** Contributions needed before a score is shown (default 2). */
  minInputs?: number;
}

export const DOMAINS: DomainConfig[] = [
  {
    key: "metabolic",
    label: "Metabolic",
    description: "Glucose control and metabolic health",
    labInputs: [
      {
        biomarkerKeys: ["hemoglobin_a1c", "hba1c"],
        label: "HbA1c",
        bands: [[5.6, 100], [6.4, 55], [8, 20]],
        bandsUnit: "%",
        weight: 3,
      },
      {
        biomarkerKeys: [
          "glucose_fasting",
          "glucose_random",
          "glucose_blood",
          "glucose_serum",
          "glucose",
        ],
        label: "Glucose",
        bands: [[99, 100], [125, 60], [180, 20]],
        bandsUnit: "mg/dL",
        weight: 2,
      },
      {
        biomarkerKeys: ["insulin_fasting", "insulin"],
        label: "Fasting insulin",
        bands: [[15, 100], [25, 50]],
        bandsUnit: "uIU/mL",
        weight: 1,
      },
      {
        biomarkerKeys: ["triglycerides"],
        label: "Triglycerides",
        bands: [[150, 100], [200, 60], [500, 10]],
        bandsUnit: "mg/dL",
        weight: 1,
      },
    ],
    wearableInputs: [
      {
        metric: "glucoseAvg",
        label: "Average glucose (CGM)",
        unit: "mg/dL",
        weight: 2,
        bands: [
          [100, 100],
          [126, 60],
          [160, 20],
        ],
      },
      {
        metric: "glucoseTimeInRange",
        label: "Glucose time in range",
        unit: "%",
        weight: 2,
        bands: [
          [50, 20],
          [70, 60],
          [90, 100],
        ],
      },
    ],
  },
  {
    key: "cardiovascular",
    label: "Cardiovascular",
    description: "Lipids, blood pressure and heart fitness",
    labInputs: [
      {
        biomarkerKeys: ["ldl_cholesterol", "cholesterol_ldl"],
        label: "LDL cholesterol",
        bands: [[100, 100], [130, 70], [160, 40], [190, 15]],
        bandsUnit: "mg/dL",
        weight: 3,
      },
      {
        biomarkerKeys: ["hdl_cholesterol", "cholesterol_hdl"],
        label: "HDL cholesterol",
        bands: [[40, 40], [60, 90], [80, 100]],
        bandsUnit: "mg/dL",
        weight: 2,
      },
      {
        biomarkerKeys: ["cholesterol", "cholesterol_total", "total_cholesterol"],
        label: "Total cholesterol",
        bands: [[180, 100], [200, 85], [240, 50], [300, 20]],
        bandsUnit: "mg/dL",
        weight: 1,
      },
      {
        biomarkerKeys: ["apolipoprotein_b", "apo_b"],
        label: "Apolipoprotein B",
        bands: [[90, 100], [110, 70], [130, 40]],
        bandsUnit: "mg/dL",
        weight: 2,
      },
      {
        biomarkerKeys: ["triglycerides"],
        label: "Triglycerides",
        bands: [[150, 100], [200, 60], [500, 10]],
        bandsUnit: "mg/dL",
        weight: 1,
      },
    ],
    wearableInputs: [
      {
        metric: "restingHr",
        label: "Resting heart rate",
        unit: "bpm",
        weight: 2,
        bands: [
          [55, 100],
          [70, 80],
          [85, 30],
        ],
      },
      {
        metric: "bpSystolic",
        label: "Systolic blood pressure",
        unit: "mmHg",
        weight: 2,
        bands: [
          [110, 100],
          [130, 70],
          [150, 30],
        ],
      },
    ],
  },
  {
    key: "inflammation",
    label: "Inflammation",
    description: "Inflammatory and immune markers",
    labInputs: [
      {
        biomarkerKeys: [
          "c_reactive_protein_high_sensitivity",
          "hs_crp",
          "c_reactive_protein",
          "crp",
        ],
        label: "CRP",
        bands: [[1, 100], [3, 70], [10, 30]],
        bandsUnit: "mg/L",
        weight: 3,
      },
      {
        biomarkerKeys: ["wbc_blood", "white_blood_cell_count", "wbc"],
        label: "White blood cells",
        bands: [[3, 40], [4, 100], [10, 100], [12, 50]],
        bandsUnit: "x10^3/uL",
        weight: 2,
      },
      {
        biomarkerKeys: [
          "erythrocyte_sedimentation_rate",
          "esr",
          "sedimentation_rate",
        ],
        label: "ESR",
        weight: 1,
      },
      {
        biomarkerKeys: ["ferritin"],
        label: "Ferritin",
        bands: [[15, 40], [30, 100], [400, 100], [600, 50]],
        bandsUnit: "ng/mL",
        weight: 1,
      },
    ],
    wearableInputs: [],
  },
  {
    key: "recovery",
    label: "Recovery & Sleep",
    description: "Sleep quality and autonomic recovery",
    labInputs: [
      {
        biomarkerKeys: [
          "vitamin_d_25_hydroxy",
          "vitamin_d_25_oh",
          "vitamin_d",
        ],
        label: "Vitamin D",
        bands: [[10, 20], [20, 50], [30, 90], [50, 100]],
        bandsUnit: "ng/mL",
        weight: 1,
      },
      {
        biomarkerKeys: ["cortisol", "cortisol_am", "cortisol_serum"],
        label: "Cortisol",
        weight: 1,
      },
    ],
    wearableInputs: [
      {
        metric: "sleepDurationMin",
        label: "Sleep duration",
        unit: "min",
        weight: 3,
        bands: [
          [300, 30],
          [360, 60],
          [420, 100],
        ],
      },
      {
        metric: "sleepEfficiency",
        label: "Sleep efficiency",
        unit: "%",
        weight: 1,
        bands: [
          [70, 40],
          [85, 90],
          [95, 100],
        ],
      },
      {
        metric: "sleepScore",
        label: "Sleep score",
        unit: "/100",
        weight: 2,
        bands: [
          [0, 0],
          [100, 100],
        ],
      },
      {
        metric: "hrv",
        label: "Heart rate variability",
        unit: "ms",
        weight: 2,
        bands: [
          [20, 30],
          [40, 70],
          [60, 100],
        ],
      },
    ],
  },
  {
    key: "activity",
    label: "Activity",
    description: "Daily movement and training",
    minInputs: 1,
    labInputs: [],
    wearableInputs: [
      {
        metric: "steps",
        label: "Daily steps",
        unit: "/day",
        weight: 1,
        bands: [
          [2000, 10],
          [10000, 100],
        ],
      },
      {
        metric: "workoutMinutes",
        label: "Workout time",
        unit: "min/day",
        weight: 1,
        bands: [
          [10, 30],
          [25, 70],
          [45, 100],
        ],
      },
      {
        metric: "workoutCalories",
        label: "Workout calories",
        unit: "kcal/day",
        weight: 1,
        bands: [
          [100, 30],
          [300, 70],
          [500, 100],
        ],
      },
    ],
  },
];
