import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Sample } from '../types';

const WIDTH = 300;
const HEIGHT = 70;
const PAD = 2;
const WINDOW = 600; // points rendered (most recent)

interface Props {
  samples: Sample[]; // d = chunk of waveform values (or val = single point)
  color: string;
}

/** Dense windowed polyline for waveform types (ECG). */
export function WaveformChart({ samples, color }: Props) {
  const points: number[] = [];
  for (const s of samples) {
    if (s.d?.length) points.push(...s.d);
    else if (s.val !== undefined) points.push(s.val);
  }
  const windowed = points.slice(-WINDOW);
  if (windowed.length < 2) return null;

  const min = Math.min(...windowed);
  const max = Math.max(...windowed);
  const range = Math.max(max - min, 1e-6);
  const path = windowed
    .map((v, i) => {
      const x = PAD + (i / (windowed.length - 1)) * (WIDTH - PAD * 2);
      const y = PAD + (1 - (v - min) / range) * (HEIGHT - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <View style={styles.wrap}>
      <Svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Polyline
          points={path}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
