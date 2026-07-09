import type { Icon } from "@phosphor-icons/react";
import { BatteryChargingIcon } from "@phosphor-icons/react/BatteryCharging";
import { BrainIcon } from "@phosphor-icons/react/Brain";
import { FireIcon } from "@phosphor-icons/react/Fire";
import { HeartIcon } from "@phosphor-icons/react/Heart";
import { HeartbeatIcon } from "@phosphor-icons/react/Heartbeat";
import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { MoonIcon } from "@phosphor-icons/react/Moon";
import { PersonSimpleRunIcon } from "@phosphor-icons/react/PersonSimpleRun";
import { PulseIcon } from "@phosphor-icons/react/Pulse";
import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { ShieldIcon } from "@phosphor-icons/react/Shield";
import { SneakerMoveIcon } from "@phosphor-icons/react/SneakerMove";
import { WindIcon } from "@phosphor-icons/react/Wind";
import type { BiomarkerKey } from "@/client/lib/dashboard/types";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export interface MetricConfig {
  title: string;
  icon: Icon;
  unit: string;
  format: (v: number) => string;
  category: "biomarker" | "score";
  hasIntraday: boolean;
  dashboard?: { goodThreshold: (v: number) => boolean };
}

/* -------------------------------------------------------------------------- */
/*                              Unified config                                */
/* -------------------------------------------------------------------------- */

export const METRICS = {
  lastSleep: {
    title: "Sleep duration",
    icon: MoonIcon,
    unit: "hours",
    format: (v: number) => {
      const h = Math.floor(v / 60);
      const m = Math.round(v % 60);
      return `${h}h${m}m`;
    },
    category: "biomarker",
    hasIntraday: false,
    dashboard: { goodThreshold: (v: number) => v >= 420 },
  },
  steps: {
    title: "Steps",
    icon: SneakerMoveIcon,
    unit: "steps",
    format: (v: number) => v.toLocaleString(),
    category: "biomarker",
    hasIntraday: false,
    dashboard: { goodThreshold: (v: number) => v >= 8000 },
  },
  rhr: {
    title: "Resting HR",
    icon: HeartIcon,
    unit: "bpm",
    format: (v: number) => String(Math.round(v)),
    category: "biomarker",
    hasIntraday: true,
    dashboard: { goodThreshold: (v: number) => v <= 70 },
  },
  hrv: {
    title: "HRV",
    icon: HeartbeatIcon,
    unit: "ms",
    format: (v: number) => String(Math.round(v)),
    category: "biomarker",
    hasIntraday: true,
    dashboard: { goodThreshold: (v: number) => v >= 30 },
  },
  vo2Max: {
    title: "VO2 Max",
    icon: PulseIcon,
    unit: "ml/kg/min",
    format: (v: number) => String(Math.round(v)),
    category: "biomarker",
    hasIntraday: false,
    dashboard: { goodThreshold: (v: number) => v >= 40 },
  },
  activeHours: {
    title: "Active hours",
    icon: PersonSimpleRunIcon,
    unit: "hours",
    format: (v: number) => v.toFixed(1),
    category: "biomarker",
    hasIntraday: false,
    dashboard: { goodThreshold: (v: number) => v >= 5 },
  },
  calories: {
    title: "Calories",
    icon: FireIcon,
    unit: "kcal",
    format: (v: number) => Math.round(v).toLocaleString(),
    category: "biomarker",
    hasIntraday: false,
  },
  sleepScore: {
    title: "Sleep",
    icon: MoonIcon,
    unit: "score",
    format: (v: number) => String(Math.round(v)),
    category: "score",
    hasIntraday: false,
  },
  readinessScore: {
    title: "Readiness",
    icon: BatteryChargingIcon,
    unit: "score",
    format: (v: number) => String(Math.round(v)),
    category: "score",
    hasIntraday: false,
  },
  totalStressScore: {
    title: "Stress",
    icon: BrainIcon,
    unit: "score",
    format: (v: number) => String(Math.round(v)),
    category: "score",
    hasIntraday: false,
  },
  strainIndex: {
    title: "Strain",
    icon: LightningIcon,
    unit: "index",
    format: (v: number) => v.toFixed(1),
    category: "score",
    hasIntraday: false,
  },
  resilienceScore: {
    title: "Resilience",
    icon: ShieldCheckIcon,
    unit: "score",
    format: (v: number) => String(Math.round(v)),
    category: "score",
    hasIntraday: false,
  },
  cardiovascularScore: {
    title: "Cardiovascular",
    icon: HeartbeatIcon,
    unit: "score",
    format: (v: number) => String(Math.round(v)),
    category: "score",
    hasIntraday: false,
  },
  immuneIndex: {
    title: "Immune",
    icon: ShieldIcon,
    unit: "index",
    format: (v: number) => v.toFixed(1),
    category: "score",
    hasIntraday: false,
  },
  respiratoryScore: {
    title: "Respiratory",
    icon: WindIcon,
    unit: "score",
    format: (v: number) => String(Math.round(v)),
    category: "score",
    hasIntraday: false,
  },
} as const satisfies Record<string, MetricConfig>;

export type MetricKey = keyof typeof METRICS;

/* -------------------------------------------------------------------------- */
/*                            Dashboard helpers                               */
/* -------------------------------------------------------------------------- */

type DashboardBiomarkerKey = {
  [K in MetricKey]: (typeof METRICS)[K] extends { dashboard: object }
    ? K
    : never;
}[MetricKey];

type _AssertDashboardSubset = DashboardBiomarkerKey extends BiomarkerKey
  ? true
  : never;
const _check: _AssertDashboardSubset = true;
void _check;

export const DASHBOARD_BIOMARKERS: DashboardBiomarkerKey[] = [
  "lastSleep",
  "steps",
  "rhr",
  "hrv",
  "vo2Max",
  "activeHours",
];
