import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { Sample } from '../types';
import { colors } from '../theme';

const WIDTH = 300;
const HEIGHT = 72;
const PAD = 4;

interface Props {
  samples: Sample[];
  color: string;
  unit?: string;
  /** Display multiplier from raw to display units (DataTypeDef.scale). */
  scale?: number;
}

/** Axis labels: whole numbers for big values, one decimal for small. */
function axisLabel(v: number): string {
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Number(v.toFixed(1)));
}

/** Lightweight sparkline on react-native-svg — no chart library needed. */
export function LiveChart({ samples, color, unit, scale = 1 }: Props) {
  const scalar = samples.filter((s) => typeof s.val === 'number');
  if (scalar.length < 2) return null;

  const values = scalar.map((s) => (s.val as number) * scale);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((v, i) => {
      const x = PAD + (i / (values.length - 1)) * (WIDTH - PAD * 2);
      const y = PAD + (1 - (v - min) / range) * (HEIGHT - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <View style={styles.chart}>
      <Svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Line
          x1={0}
          y1={HEIGHT / 2}
          x2={WIDTH}
          y2={HEIGHT / 2}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.axis}>
        <Text style={styles.axisText}>
          {axisLabel(min)} {unit ?? ''}
        </Text>
        <Text style={styles.axisText}>
          {axisLabel(max)} {unit ?? ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { width: '100%' },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  axisText: { color: colors.textDim, fontSize: 10 },
});
