import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { resolveDataType } from '../datatypes';
import { DataTypeDef } from '../datatypes/DataTypeDef';
import { MetricSeries, Sample } from '../types';
import { colors, fonts } from '../theme';
import { CoordsTrace } from './CoordsTrace';
import { LiveChart } from './LiveChart';
import { WaveformChart } from './WaveformChart';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface Props {
  series: MetricSeries;
  /** Dim the card (reconnecting state — data may be stale). */
  dimmed?: boolean;
}

/**
 * Renders any data type via the registry — one card per (user, type).
 * Title is the stat only; the user is named by the section header above.
 */
export function MetricCard({ series, dimmed }: Props) {
  const def = resolveDataType(series.type);
  const now = useNow();
  const ageSec = Math.max(0, Math.round((now - series.lastUpdated) / 1000));
  const stale = ageSec > 15;
  const value = def.getValue(series.latest);
  const color = stale ? colors.textDim : def.color(value);

  return (
    <View style={[styles.card, dimmed && styles.dimmed]}>
      <View style={styles.header}>
        <Text style={styles.label}>{def.label}</Text>
        <Text style={styles.age}>{ageSec === 0 ? 'now' : `${ageSec}s ago`}</Text>
      </View>

      <View style={styles.reading}>
        <Text
          style={[styles.value, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.4}
        >
          {def.format(series.latest)}
        </Text>
        {def.unit ? <Text style={styles.unit}>{def.unit}</Text> : null}
      </View>

      <MetricChart def={def} samples={series.samples} color={color} />

      <Text style={styles.meta} numberOfLines={1}>
        {series.samples.length} samples
      </Text>
    </View>
  );
}

/** Chart renderer selected by the data type's kind. */
function MetricChart({
  def,
  samples,
  color,
}: {
  def: DataTypeDef;
  samples: Sample[];
  color: string;
}) {
  switch (def.kind) {
    case 'vector': {
      // One line, like the dashboard's stat card: sparkline the magnitude.
      const magnitudes = samples.map((s) => ({
        ...s,
        val: s.d ? Math.hypot(...s.d) : undefined,
      }));
      return (
        <LiveChart samples={magnitudes} color={color} unit={def.unit} scale={def.scale} />
      );
    }
    case 'waveform':
      return <WaveformChart samples={samples} color={color} />;
    case 'coords':
      return <CoordsTrace samples={samples} color={color} />;
    case 'scalar':
    default:
      return (
        <LiveChart samples={samples} color={color} unit={def.unit} scale={def.scale} />
      );
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  dimmed: { opacity: 0.45 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { color: colors.text, fontSize: 14, fontFamily: fonts.medium },
  age: { color: colors.textDim, fontSize: 12, fontFamily: fonts.regular },
  reading: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontSize: 38,
    fontFamily: fonts.semibold,
    fontVariant: ['tabular-nums'],
    flexShrink: 1, // long vector/waveform readouts scale down, never push
  },
  unit: { color: colors.textDim, fontSize: 15, fontFamily: fonts.regular, flexShrink: 0 },
  meta: { color: colors.textDim, fontSize: 11, fontFamily: fonts.regular },
});
