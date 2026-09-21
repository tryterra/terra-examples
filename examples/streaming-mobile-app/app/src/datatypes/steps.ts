import { colors } from '../theme';
import { DataTypeDef } from './DataTypeDef';

const steps: DataTypeDef = {
  type: 'STEPS',
  label: 'Steps',
  unit: 'steps',
  kind: 'scalar',
  getValue: (msg) => msg.val,
  color: () => colors.blue,
  format: (msg) =>
    msg.val !== undefined ? Math.round(msg.val).toLocaleString() : '—',
};

export default steps;
