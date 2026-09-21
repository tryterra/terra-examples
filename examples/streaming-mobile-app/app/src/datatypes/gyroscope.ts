import { colors } from '../theme';
import { DataTypeDef } from './DataTypeDef';

// SI units: both platforms emit rad/s natively (CoreMotion rotationRate and
// Android's gyroscope SensorEvent). Vectors reduce to the magnitude.
const gyroscope: DataTypeDef = {
  type: 'GYROSCOPE',
  label: 'Gyroscope (magnitude)',
  unit: 'rad/s',
  kind: 'vector',
  axes: ['x', 'y', 'z'],
  getValue: (msg) => (msg.d ? Math.hypot(...msg.d) : undefined),
  color: () => colors.purple,
  format: (msg) => (msg.d ? Math.hypot(...msg.d).toFixed(2) : '—'),
};

export default gyroscope;
