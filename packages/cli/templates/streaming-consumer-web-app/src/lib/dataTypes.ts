// Data-type registry: how each Terra streaming type is labeled, formatted,
// and reduced to a chartable number. Unknown types fall back to a generic
// definition so new types render instead of vanishing.

import type { DispatchMessage } from "./protocol";

export interface DataTypeDef {
  type: string;
  label: string;
  unit?: string;
  /** Decimal places for the default formatter (default 0). */
  decimals?: number;
  /**
   * Reduce a reading to one chartable number. Default: `val` for scalars,
   * vector magnitude for `d` arrays. Return undefined for unchartable types
   * (LOCATION, ACTIVITY) — they still show a formatted latest value.
   */
  getValue?: (msg: DispatchMessage) => number | undefined;
  /** Render the big stat-card value (without the unit). */
  format?: (msg: DispatchMessage) => string;
}

/** `val` if present, else the magnitude of the `d` vector (√Σd²). */
export function extractValue(msg: DispatchMessage): number | undefined {
  if (typeof msg.val === "number") return msg.val;
  if (msg.d && msg.d.length > 0) {
    return Math.sqrt(msg.d.reduce((acc, n) => acc + n * n, 0));
  }
  return undefined;
}

const REGISTRY: DataTypeDef[] = [
  { type: "HEART_RATE", label: "Heart Rate", unit: "bpm" },
  { type: "STEPS", label: "Steps", unit: "steps" },
  { type: "HRV", label: "HRV", unit: "ms" },
  { type: "RR_INTERVAL", label: "RR Interval", unit: "ms" },
  { type: "CALORIES", label: "Calories", unit: "kcal" },
  { type: "DISTANCE", label: "Distance", unit: "m" },
  { type: "SPEED", label: "Speed", unit: "km/h", decimals: 1 },
  { type: "POWER", label: "Power", unit: "W" },
  { type: "STEPS_CADENCE", label: "Steps Cadence", unit: "spm" },
  { type: "BIKE_CADENCE", label: "Bike Cadence", unit: "rpm" },
  { type: "FLOORS_CLIMBED", label: "Floors Climbed", unit: "floors" },
  { type: "MET", label: "MET", decimals: 1 },
  // Vector types render as a single magnitude (units are magnitude units).
  { type: "ACCELERATION", label: "Acceleration (magnitude)", unit: "m/s²", decimals: 2 },
  { type: "GYROSCOPE", label: "Gyroscope (magnitude)", unit: "rad/s", decimals: 2 },
  // ECG dispatches carry a chunk of waveform samples; chart the latest one.
  {
    type: "ECG",
    label: "ECG",
    unit: "mV",
    decimals: 2,
    getValue: (msg) => (msg.d && msg.d.length > 0 ? msg.d[msg.d.length - 1] : msg.val),
  },
  // Coordinates aren't a time series — show them, don't chart them.
  {
    type: "LOCATION",
    label: "Location",
    getValue: () => undefined,
    format: (msg) =>
      msg.d && msg.d.length >= 2 ? `${msg.d[0].toFixed(4)}, ${msg.d[1].toFixed(4)}` : "—",
  },
  {
    type: "ACTIVITY",
    label: "Activity",
    getValue: () => undefined,
    format: (msg) => (typeof msg.val === "number" ? String(msg.val) : "—"),
  },
];

const BY_TYPE = new Map(REGISTRY.map((def) => [def.type, def]));

/** Generic fallback: title-cased label, raw value — unknown types still render. */
function generic(type: string): DataTypeDef {
  const label = type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { type, label };
}

export function resolveDataType(type: string): DataTypeDef {
  return BY_TYPE.get(type) ?? generic(type);
}

/** The chartable value of a reading under its type's definition. */
export function valueOf(def: DataTypeDef, msg: DispatchMessage): number | undefined {
  return def.getValue ? def.getValue(msg) : extractValue(msg);
}

/** The stat-card display string of a reading (unit rendered separately). */
export function formatValue(def: DataTypeDef, msg: DispatchMessage): string {
  if (def.format) return def.format(msg);
  const value = valueOf(def, msg);
  if (value === undefined) {
    // No chartable number — degrade to JSON so the data is still visible.
    return msg.d ? JSON.stringify(msg.d) : "—";
  }
  return value.toFixed(def.decimals ?? 0);
}
