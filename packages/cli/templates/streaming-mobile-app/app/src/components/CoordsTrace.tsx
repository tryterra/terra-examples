import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Sample } from '../types';
import { colors } from '../theme';

const SIZE = 120;
const PAD = 8;

interface Props {
  samples: Sample[]; // d = [lat, lng]
  color: string;
}

/** Relative path trace of recent coordinates — no map dependency. */
export function CoordsTrace({ samples, color }: Props) {
  const coords = samples
    .filter((s) => s.d && s.d.length >= 2)
    .map((s) => ({ lat: s.d![0], lng: s.d![1] }));
  if (coords.length < 2) return null;

  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const latRange = Math.max(Math.max(...lats) - Math.min(...lats), 1e-9);
  const lngRange = Math.max(Math.max(...lngs) - Math.min(...lngs), 1e-9);
  const minLat = Math.min(...lats);
  const minLng = Math.min(...lngs);

  const toXY = (c: { lat: number; lng: number }) => ({
    x: PAD + ((c.lng - minLng) / lngRange) * (SIZE - PAD * 2),
    y: PAD + (1 - (c.lat - minLat) / latRange) * (SIZE - PAD * 2),
  });

  const points = coords
    .map((c) => {
      const { x, y } = toXY(c);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const last = toXY(coords[coords.length - 1]);

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Polyline
          points={points}
          fill="none"
          stroke={colors.border}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Circle cx={last.x} cy={last.y} r={4} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
