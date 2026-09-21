/**
 * The watch SDK prefixes workout-derived samples with the workout type
 * (RUNNING_HEART_RATE, RUNNING_TREADMILL_DISTANCE, ...) and uses a few
 * names the registry spells differently (TOTAL_CALORIES vs CALORIES).
 * Fold both onto the registry's canonical types.
 */

// Longest-first so RUNNING_HEART_RATE_VARIABILITY resolves to HRV, not HEART_RATE.
const BASE_TYPES = [
  'HEART_RATE_VARIABILITY',
  'BASAL_METABOLIC_RATE',
  'FLIGHTS_CLIMBED',
  'TOTAL_CALORIES',
  'HEART_RATE',
  'CALORIES',
  'DISTANCE',
  'DURATION',
  'LOCATION',
  'SPEED',
  'STEPS',
];

const ALIASES: Record<string, string> = {
  TOTAL_CALORIES: 'CALORIES',
  HEART_RATE_VARIABILITY: 'HRV',
  FLIGHTS_CLIMBED: 'FLOORS_CLIMBED',
};

export function normalizeUpdateType(type: string): string {
  const base = BASE_TYPES.find((b) => type === b || type.endsWith(`_${b}`)) ?? type;
  return ALIASES[base] ?? base;
}
