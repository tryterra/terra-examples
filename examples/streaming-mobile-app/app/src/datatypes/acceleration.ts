import { colors } from '../theme';
import { DataTypeDef } from './DataTypeDef';

// LINEAR acceleration in SI: gravity-compensated m/s² on both platforms
// (Android TYPE_LINEAR_ACCELERATION; iOS userAcceleration × g₀). Vectors
// reduce to the magnitude √(x²+y²+z²) — a resting phone reads ≈0.
const acceleration: DataTypeDef = {
  type: 'ACCELERATION',
  label: 'Acceleration (magnitude)',
  unit: 'm/s²',
  kind: 'vector',
  axes: ['x', 'y', 'z'],
  getValue: (msg) => (msg.d ? Math.hypot(...msg.d) : undefined),
  color: () => colors.blue,
  format: (msg) => (msg.d ? Math.hypot(...msg.d).toFixed(2) : '—'),
};

export default acceleration;
