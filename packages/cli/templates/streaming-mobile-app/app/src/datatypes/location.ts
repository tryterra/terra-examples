import { colors } from '../theme';
import { DataTypeDef } from './DataTypeDef';

/** Location — `d` is [latitude, longitude]. */
const location: DataTypeDef = {
  type: 'LOCATION',
  label: 'Location',
  kind: 'coords',
  getValue: () => undefined,
  color: () => colors.green,
  format: (msg) =>
    msg.d && msg.d.length >= 2
      ? `${msg.d[0].toFixed(5)}, ${msg.d[1].toFixed(5)}`
      : '—',
};

export default location;
