/**
 * Display registry for wearable metrics (the client twin of the server's
 * METRIC_KEYS). One entry per card/chart: label, unit, formatting, and the
 * "Good" threshold used on snapshot badges.
 */
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { BarbellIcon } from "@phosphor-icons/react/Barbell";
import { BatteryChargingIcon } from "@phosphor-icons/react/BatteryCharging";
import { BedIcon } from "@phosphor-icons/react/Bed";
import { DropIcon } from "@phosphor-icons/react/Drop";
import { FlameIcon } from "@phosphor-icons/react/Flame";
import { FootprintsIcon } from "@phosphor-icons/react/Footprints";
import { HeartbeatIcon } from "@phosphor-icons/react/Heartbeat";
import { MoonStarsIcon } from "@phosphor-icons/react/MoonStars";
import { PulseIcon } from "@phosphor-icons/react/Pulse";

export interface MetricConfig {
  key: string;
  label: string;
  unit: string;
  icon: ComponentType<IconProps>;
  format: (value: number) => string;
  /** Good/Poor badge on snapshot cards. */
  good: (value: number) => boolean;
}

const int = (v: number) => String(Math.round(v));
const hours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

/** Headline metrics, in overview display order. */
export const SNAPSHOT_METRICS: MetricConfig[] = [
  {
    key: "restingHr",
    label: "Resting HR",
    unit: "bpm",
    icon: HeartbeatIcon,
    format: int,
    good: (v) => v < 70,
  },
  {
    key: "hrv",
    label: "HRV",
    unit: "ms",
    icon: PulseIcon,
    format: int,
    good: (v) => v >= 40,
  },
  {
    key: "recoveryScore",
    label: "Recovery",
    unit: "%",
    icon: BatteryChargingIcon,
    format: int,
    good: (v) => v >= 66,
  },
  {
    key: "steps",
    label: "Steps",
    unit: "/day",
    icon: FootprintsIcon,
    format: (v) => Math.round(v).toLocaleString("en"),
    good: (v) => v >= 8000,
  },
  {
    key: "sleepDurationMin",
    label: "Sleep",
    unit: "",
    icon: BedIcon,
    format: hours,
    good: (v) => v >= 420,
  },
  {
    key: "sleepScore",
    label: "Sleep score",
    unit: "/100",
    icon: MoonStarsIcon,
    format: int,
    good: (v) => v >= 70,
  },
  {
    key: "glucoseAvg",
    label: "Avg glucose",
    unit: "mg/dL",
    icon: DropIcon,
    format: int,
    good: (v) => v <= 120,
  },
];

/** Workout metrics — derived from workout records (e.g. Whoop). */
export const WORKOUT_METRICS: MetricConfig[] = [
  {
    key: "workoutMinutes",
    label: "Workout time",
    unit: "min/day",
    icon: BarbellIcon,
    format: int,
    good: (v) => v >= 25,
  },
  {
    key: "workoutCalories",
    label: "Workout calories",
    unit: "kcal/day",
    icon: FlameIcon,
    format: int,
    good: (v) => v >= 300,
  },
  {
    key: "workoutAvgHr",
    label: "Workout avg HR",
    unit: "bpm",
    icon: HeartbeatIcon,
    format: int,
    good: () => true,
  },
];

/** Metrics offered on the trends page (superset of the snapshot). */
export const TREND_METRICS: MetricConfig[] = [
  ...SNAPSHOT_METRICS,
  ...WORKOUT_METRICS,
  {
    key: "sleepEfficiency",
    label: "Sleep efficiency",
    unit: "%",
    icon: BedIcon,
    format: int,
    good: (v) => v >= 85,
  },
  {
    key: "glucoseTimeInRange",
    label: "Glucose time in range",
    unit: "%",
    icon: DropIcon,
    format: int,
    good: (v) => v >= 70,
  },
];
