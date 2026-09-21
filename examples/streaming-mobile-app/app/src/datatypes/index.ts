import { DispatchMessage } from '../types';
import { colors } from '../theme';
import { DataTypeDef, scalarDef } from './DataTypeDef';
import acceleration from './acceleration';
import activity from './activity';
import ecg from './ecg';
import gyroscope from './gyroscope';
import heartRate from './heartRate';
import location from './location';
import steps from './steps';

/** Register new data types here — one entry per supported type. */
export const REGISTRY: DataTypeDef[] = [
  heartRate,
  steps,
  scalarDef('HRV', 'Heart rate variability', { unit: 'ms', color: colors.purple }),
  scalarDef('RR_INTERVAL', 'R-R interval', { unit: 'ms', color: colors.purple }),
  scalarDef('CALORIES', 'Calories', { unit: 'kcal', color: colors.orange }),
  scalarDef('DISTANCE', 'Distance', { unit: 'm', color: colors.blue }),
  // Values arrive already in display units — label them, don't convert.
  scalarDef('SPEED', 'Speed', { unit: 'km/h', color: colors.blue, decimals: 1 }),
  scalarDef('STEPS_CADENCE', 'Step cadence', { unit: 'spm', color: colors.blue }),
  scalarDef('BIKE_CADENCE', 'Bike cadence', { unit: 'rpm', color: colors.blue }),
  scalarDef('POWER', 'Power', { unit: 'W', color: colors.yellow }),
  scalarDef('FLOORS_CLIMBED', 'Floors climbed', { unit: 'floors', color: colors.blue }),
  scalarDef('MET', 'Metabolic equivalent', { unit: 'MET', color: colors.orange, decimals: 1 }),
  scalarDef('DURATION', 'Workout duration', { unit: 's', color: colors.blue }),
  scalarDef('BASAL_METABOLIC_RATE', 'Basal energy', { unit: 'kcal', color: colors.orange }),
  activity,
  acceleration,
  gyroscope,
  ecg,
  location,
];

const byType = new Map(REGISTRY.map((def) => [def.type, def]));

/** Fallback so unknown types still render instead of vanishing. */
function generic(type: string): DataTypeDef {
  const label = type
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
  return {
    type,
    label,
    kind: 'scalar',
    getValue: (msg: DispatchMessage) => msg.val,
    color: () => colors.purple,
    format: (msg: DispatchMessage) => {
      if (msg.val !== undefined) return String(msg.val);
      if (msg.d) return `[${msg.d.map((n) => n.toFixed(2)).join(', ')}]`;
      return '—';
    },
  };
}

export function resolveDataType(type: string): DataTypeDef {
  return byType.get(type) ?? generic(type);
}
