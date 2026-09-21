import { colors } from '../theme';
import { DataTypeDef } from './DataTypeDef';

const heartRate: DataTypeDef = {
  type: 'HEART_RATE',
  label: 'Heart rate',
  unit: 'bpm',
  kind: 'scalar',
  getValue: (msg) => msg.val,
  color: (bpm) => {
    if (bpm === undefined) return colors.textDim;
    if (bpm < 60) return colors.blue;
    if (bpm < 100) return colors.green;
    if (bpm < 140) return colors.orange;
    return colors.accent;
  },
  format: (msg) => (msg.val !== undefined ? String(Math.round(msg.val)) : '—'),
};

export default heartRate;
