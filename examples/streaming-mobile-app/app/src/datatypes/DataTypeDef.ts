import { DispatchMessage } from '../types';

/**
 * How the app understands one Terra data type. To support a new type,
 * export a DataTypeDef and register it in ./index.ts — unknown types fall
 * back to a generic definition, so nothing is ever silently dropped.
 */

/** Selects the card renderer (see components/MetricCard.tsx). */
export type MetricKind = 'scalar' | 'vector' | 'waveform' | 'coords';

export interface DataTypeDef {
  type: string;
  label: string;
  unit?: string;
  /**
   * Display multiplier from the SDK's raw unit to the display unit
   * (e.g. m/s → km/h). Raw samples are stored unconverted.
   */
  scale?: number;
  kind: MetricKind;
  /** Scalar value used for the sparkline; undefined = no chart. */
  getValue(msg: DispatchMessage): number | undefined;
  /** Readout colour, e.g. HR zones. */
  color(value: number | undefined): string;
  /** Human-readable latest value. */
  format(msg: DispatchMessage): string;
  /** Axis labels for vector kinds (defaults to x/y/z). */
  axes?: string[];
}

/** Shared helpers for the simple scalar types. */
export function scalarDef(
  type: string,
  label: string,
  options: {
    unit?: string;
    color: string;
    decimals?: number;
    scale?: number;
  },
): DataTypeDef {
  const scale = options.scale ?? 1;
  return {
    type,
    label,
    unit: options.unit,
    scale,
    kind: 'scalar',
    getValue: (msg) => (msg.val !== undefined ? msg.val * scale : undefined),
    color: () => options.color,
    format: (msg) =>
      msg.val !== undefined
        ? options.decimals !== undefined
          ? (msg.val * scale).toFixed(options.decimals)
          : Math.round(msg.val * scale).toLocaleString()
        : '—',
  };
}
