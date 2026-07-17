import { Activity, BluetoothSearching, TriangleAlert, Watch } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { createDemoSession, getSession, hasValidSession, saveSession } from '../auth';
import { Banner } from '../components/Banner';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { toast } from '../components/Toaster';
import { useStreamStalled } from '../hooks/useStreamStalled';
import { useProducer } from '../producer/useProducer';
import { colors, fonts } from '../theme';
import { DispatchMessage, MetricSeries } from '../types';

interface Props {
  /** Navigate to the Pair tab (first launch / expired session). */
  onGoToPair: () => void;
  /** Navigate to the Connect tab (paired but nothing streaming yet). */
  onGoToConnect: () => void;
}

/**
 * The live dashboard: this device's own readings, straight from the local
 * producer feed — zero latency, no round-trip.
 */
export function LiveScreen({ onGoToPair, onGoToConnect }: Props) {
  const producer = useProducer();
  const session = getSession();
  const paired = hasValidSession(); // re-evaluated every render tick
  const stalled = useStreamStalled(producer, session?.demo === true);


  // Local producer series → MetricSeries so MetricCard renders them.
  const ownMetrics = useMemo<MetricSeries[]>(() => {
    const uid = producer.userId ?? session?.userId ?? 'local';
    return Object.entries(producer.series)
      .map(([type, samples]) => {
        const last = samples[samples.length - 1];
        if (!last) return null;
        const latest: DispatchMessage = {
          seq: last.seq,
          uid,
          t: type,
          ts: last.ts,
          val: last.val,
          d: last.d,
        };
        return {
          uid,
          type,
          latest,
          samples,
          lastUpdated: Date.now(),
        } as MetricSeries;
      })
      .filter((m): m is MetricSeries => m !== null)
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [producer.series, producer.userId, session?.userId]);

  const sections = useMemo(() => {
    if (ownMetrics.length === 0) return [];
    const ownUid = producer.userId ?? session?.userId ?? 'local';
    return [
      {
        key: ownUid,
        title: `${producer.referenceId ?? session?.referenceId ?? 'This phone'} (you)`,
        data: ownMetrics,
      },
    ];
  }, [ownMetrics, producer.userId, producer.referenceId, session?.userId, session?.referenceId]);

  const expired = paired === false && session !== null; // had a session, now stale

  // Never paired.
  if (!paired && !expired) {
    return (
      <EmptyState
        icon={Activity}
        title="Get connected"
        text="Scan the pairing QR from your Terra dashboard — the app stays connected automatically from then on."
        buttonTitle="Scan to pair"
        onPress={onGoToPair}
        secondaryTitle="Try the demo"
        onSecondary={() => {
          void saveSession(createDemoSession()).then(() =>
            toast.success('Demo mode', 'Synthetic data — nothing leaves your phone'),
          );
        }}
      />
    );
  }

  // Session expired.
  if (expired) {
    return (
      <EmptyState
        icon={TriangleAlert}
        tone="error"
        title="Session expired"
        text="Your pairing session has ended — scan a new QR code from the Terra dashboard to reconnect this device."
        buttonTitle="Scan to reconnect"
        onPress={onGoToPair}
      />
    );
  }

  return (
    <View style={styles.container}>
      {stalled && ownMetrics.length > 0 && (
        <Banner
          tone="warning"
          busy={!producer.terraSocketConnected}
          text={
            producer.terraSocketConnected
              ? `Streaming to Terra, but ${producer.deviceName ?? 'your device'} isn't sending data — check it's worn and awake.`
              : 'Connection to Terra lost — reconnecting…'
          }
        />
      )}

      <SectionList
        sections={sections}
        keyExtractor={(m) => `${m.uid}|${m.type}`}
        renderItem={({ item }) => <MetricCard series={item} />}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          stalled ? (
            // Stream "running", nothing arriving — blame the right half:
            // Terra link up means the device is the silent party; link
            // down means the SDK is reconnecting to Terra.
            producer.terraSocketConnected ? (
              <EmptyState
                icon={BluetoothSearching}
                title="Streaming to Terra — no data from your device"
                text={`The connection to Terra is live, but ${producer.deviceName ?? 'your device'} hasn't sent any readings. Check it's worn, awake and in range.`}
                buttonTitle="Manage device"
                onPress={onGoToConnect}
              />
            ) : (
              <EmptyState
                icon={TriangleAlert}
                title="Reconnecting to Terra"
                text={`${producer.deviceName ?? 'Your device'} is connected, but the link to Terra dropped. Reconnecting automatically — readings resume when it's back.`}
              />
            )
          ) : (
            // Paired, nothing streaming yet — point at the next step.
            <EmptyState
              icon={Watch}
              title="You're connected"
              text="Readings appear here the moment anything streams. Connect a wearable or use this phone's sensors to get started."
              buttonTitle="Connect a device"
              onPress={onGoToConnect}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  list: { gap: 12, paddingBottom: 18 },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontFamily: fonts.semibold,
    marginTop: 6,
  },
});
