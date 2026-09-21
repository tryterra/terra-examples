import { colors } from '../theme';
import { DataTypeDef } from './DataTypeDef';

/** ECG — dispatches carry chunks of waveform samples in `d`. */
const ecg: DataTypeDef = {
  type: 'ECG',
  label: 'ECG',
  unit: 'mV',
  kind: 'waveform',
  getValue: (msg) => msg.val,
  color: () => colors.accent,
  format: (msg) => {
    if (msg.d?.length) return `${msg.d.length} samples`;
    if (msg.val !== undefined) return msg.val.toFixed(2);
    return '—';
  },
};

export default ecg;
