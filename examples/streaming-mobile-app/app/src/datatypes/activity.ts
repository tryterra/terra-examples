import { colors } from '../theme';
import { DataTypeDef } from './DataTypeDef';

/** Activity state — an enum-like scalar; shown as a labelled state, no chart. */
const activity: DataTypeDef = {
  type: 'ACTIVITY',
  label: 'Activity',
  kind: 'scalar',
  getValue: () => undefined, // no sparkline for a state value
  color: () => colors.green,
  format: (msg) => (msg.val !== undefined ? `state ${msg.val}` : '—'),
};

export default activity;
