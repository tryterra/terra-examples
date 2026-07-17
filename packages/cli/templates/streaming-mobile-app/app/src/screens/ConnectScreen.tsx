import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronDown, QrCode, RefreshCw } from 'lucide-react-native';
import { getSession, hasValidSession } from '../auth';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { toast } from '../components/Toaster';
import { useStreamStalled } from '../hooks/useStreamStalled';
import { ConnectionType, DiscoveredDevice, SCANNING_TYPES } from '../producer/ProducerController';
import { useProducer } from '../producer/useProducer';
import { colors, fonts } from '../theme';

// Wear OS is hidden until the companion app ships — re-add
// { id: 'WEAR', label: 'Wear OS' } on Android when it does.
const SOURCES: { id: ConnectionType; label: string }[] = [
  { id: 'BLE', label: 'BLE device' },
  { id: 'PHONE', label: 'Phone sensors' },
  ...(Platform.OS === 'ios' ? [{ id: 'WATCH' as ConnectionType, label: 'Apple Watch' }] : []),
];

/** Row subtitle: the SDK's device type when present, else a MAC stub. */
function deviceMeta(d: DiscoveredDevice): string {
  const raw = d.raw;
  if (raw && typeof raw === 'object' && 'type' in raw) {
    const type = (raw as { type?: unknown }).type;
    if (typeof type === 'string' && type) return type;
  }
  return d.id.slice(0, 17);
}

interface Props {
  /** Navigate to the Pair tab (no session yet / expired). */
  onGoToPair: () => void;
  /** Navigate to the Live tab (streaming started — go see it). */
  onGoToLive: () => void;
}

/**
 * Producer flow: pair gate → identity → device → control surface.
 * Streaming starts automatically when a device connects and always flows
 * to Terra; readings live on the Live tab.
 */
export function ConnectScreen({ onGoToPair, onGoToLive }: Props) {
  const producer = useProducer();
  const { phase, error, devices, deviceName, connectionType, terraSocketConnected } =
    producer;
  const c = producer.controller;
  const session = getSession();
  const stalled = useStreamStalled(producer, session?.demo === true);
  const [selected, setSelected] = useState<DiscoveredDevice | null>(null);
  const [showIdentity, setShowIdentity] = useState(false); // Back from step 2
  const scanKicked = useRef(false);
  // Scroll affordance for the device list: show a chevron while there's
  // more below the fold.
  const [listViewportH, setListViewportH] = useState(0);
  const [listContentH, setListContentH] = useState(0);
  const [listAtEnd, setListAtEnd] = useState(false);
  const listOverflows = listContentH > listViewportH + 1;

  // Identity ships with the rt token — nothing to type here. Register
  // silently with the QR's reference_id and go straight to device
  // selection; errors pause the loop for a manual retry / re-pair.
  useEffect(() => {
    if (producer.phase === 'idle' && !producer.error && hasValidSession()) {
      void c.setup(session?.referenceId?.trim() || 'demo-user');
    }
  }, [producer.phase, producer.error, c, session?.referenceId]);

  // Scanning starts the moment the device step appears — there is no
  // "find devices" button. Kicked once per entry/source switch so a
  // failed scan doesn't loop.
  useEffect(() => {
    if (
      producer.phase === 'ready' &&
      SCANNING_TYPES.includes(producer.connectionType) &&
      !showIdentity &&
      !scanKicked.current
    ) {
      scanKicked.current = true;
      void c.connectDevice();
    }
    if (!['ready', 'scanning', 'connectingDevice'].includes(producer.phase)) {
      scanKicked.current = false;
    }
  }, [producer.phase, producer.connectionType, showIdentity, c]);

  // Toast the streaming lifecycle: started (auto, after device connect),
  // stopped, and new producer errors.
  const prevPhase = useRef(producer.phase);
  const prevError = useRef(producer.error);
  useEffect(() => {
    if (producer.phase === 'streaming' && prevPhase.current !== 'streaming') {
      toast.success('Streaming started', `${producer.deviceName ?? 'Device'} → Terra`);
    }
    if (producer.phase === 'deviceConnected' && prevPhase.current === 'streaming') {
      toast.success('Streaming stopped');
    }
    if (producer.error && producer.error !== prevError.current) {
      toast.error('Something went wrong', producer.error);
    }
    prevPhase.current = producer.phase;
    prevError.current = producer.error;
  }, [producer.phase, producer.error, producer.deviceName]);

  const switchSource = (id: ConnectionType) => {
    if (id === producer.connectionType) return;
    setSelected(null);
    scanKicked.current = false;
    void (async () => {
      if (producer.phase === 'scanning') await c.cancelScan();
      c.setConnectionType(id);
    })();
  };

  // Not paired yet — everything below needs the rt. token.
  if (!hasValidSession()) {
    return (
      <EmptyState
        icon={QrCode}
        title="Pair to get started"
        text="Connect this device to your Terra dashboard first — scan the pairing QR and everything else takes care of itself."
        buttonTitle="Scan to pair"
        onPress={onGoToPair}
      />
    );
  }

  if (phase === 'unavailable') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No developer ID</Text>
          <Text style={styles.body}>
            This pairing didn't include a dev ID. Scan a fresh QR code from
            the Terra dashboard to connect this device.
          </Text>
        </View>
      </View>
    );
  }

  const streaming = phase === 'streaming' || phase === 'starting';
  const connected = phase === 'deviceConnected' || streaming;
  const scans = SCANNING_TYPES.includes(connectionType);

  return (
    // A plain View, deliberately: the device list is the screen's ONE
    // scroller — nesting it in a screen ScrollView gives it unbounded
    // height, so it never overflows and never scrolls.
    <View style={styles.container}>
      {/* Identity confirmation (Back from step 2) — read-only: identity is
          set when the QR is minted, not here. */}
      {showIdentity && !['idle', 'settingUp'].includes(phase) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Who's streaming?</Text>
          <Text style={styles.body}>
            Streaming as "{producer.referenceId}" — the name comes from the
            dashboard QR; re-pair with a new code to change it.
          </Text>
          <Button title="Continue" onPress={() => setShowIdentity(false)} />
        </View>
      )}

      {/* Registering with Terra (auto — identity ships with the QR). */}
      {phase === 'settingUp' && (
        <View style={styles.card}>
          <View style={styles.scanHeader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.body}>
              Registering as "{session?.referenceId ?? 'demo-user'}"…
            </Text>
          </View>
        </View>
      )}

      {/* Registration failed — pause the auto-retry loop for a human. */}
      {phase === 'idle' && error ? (
        <View style={styles.card}>
          <Banner text={error} tone="error" />
          <Text style={styles.hint}>
            Setup keeps failing? Your pairing session may have been revoked —
            scan a fresh QR code from the dashboard.
          </Text>
          <View style={styles.footerRow}>
            <Button title="Re-pair" variant="secondary" onPress={onGoToPair} />
            <View style={styles.footerGrow}>
              <Button
                title="Try again"
                onPress={() => void c.setup(session?.referenceId?.trim() || 'demo-user')}
              />
            </View>
          </View>
        </View>
      ) : null}

      {/* Choose source & device */}
      {!showIdentity &&
        (phase === 'ready' || phase === 'scanning' || phase === 'connectingDevice') && (
          <View style={[styles.card, scans && styles.cardFill]}>
            <Text style={styles.cardTitle}>Choose your data source</Text>

            <View style={styles.chipRow}>
              {SOURCES.map((s) => {
                const active = connectionType === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => switchSource(s.id)}
                    disabled={phase === 'connectingDevice'}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {scans ? (
              <View style={styles.deviceBox}>
                <View style={styles.deviceBoxHeader}>
                  <Text style={styles.deviceBoxTitle}>Nearby devices</Text>
                  <View style={styles.deviceBoxActions}>
                    {phase === 'scanning' && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                    {/* BLE scans can wedge and find nothing — restart without
                        the switch-source-and-back dance. */}
                    {['scanning', 'ready'].includes(phase) && (
                      <Pressable
                        onPress={() => {
                          setSelected(null);
                          if (phase === 'scanning') {
                            scanKicked.current = false; // auto-kick rescans after cancel
                            void c.cancelScan();
                          } else {
                            scanKicked.current = true;
                            void c.connectDevice();
                          }
                        }}
                        hitSlop={10}
                      >
                        <RefreshCw size={15} color={colors.primary} strokeWidth={2.2} />
                      </Pressable>
                    )}
                  </View>
                </View>
                <View style={styles.deviceScrollWrap}>
                  <ScrollView
                    style={styles.deviceScroll}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    scrollEventThrottle={100}
                    onLayout={(e) => setListViewportH(e.nativeEvent.layout.height)}
                    onContentSizeChange={(_w, h) => setListContentH(h)}
                    onScroll={(e) => {
                      const { contentOffset, layoutMeasurement, contentSize } =
                        e.nativeEvent;
                      setListAtEnd(
                        contentOffset.y + layoutMeasurement.height >=
                          contentSize.height - 8,
                      );
                    }}
                  >
                    {devices.map((d) => {
                      const isSelected = selected?.id === d.id;
                      return (
                        <Pressable
                          key={d.id}
                          style={[styles.deviceRow, isSelected && styles.deviceRowSelected]}
                          onPress={() => setSelected(d)}
                          disabled={phase === 'connectingDevice'}
                        >
                          <Text style={styles.deviceName}>{d.name}</Text>
                          <Text style={styles.deviceMeta}>{deviceMeta(d)}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {listOverflows && !listAtEnd && (
                    <View pointerEvents="none" style={styles.scrollMore}>
                      <ChevronDown size={14} color={colors.textDim} />
                    </View>
                  )}
                </View>
                <Text style={styles.deviceBoxHint}>
                  Put your device in pairing mode if it isn't listed.
                </Text>
              </View>
            ) : (
              <Text style={styles.body}>
                {connectionType === 'WATCH'
                  ? 'Open Terra Grip on your Apple Watch, then continue — pairing happens over WatchConnectivity.'
                  : "Streams this phone's own motion sensors — nothing to pair."}
              </Text>
            )}

            {error ? (
              <>
                <Banner text={error} tone="error" />
                {scans && phase === 'ready' && (
                  <Button
                    title="Scan again"
                    variant="secondary"
                    onPress={() => {
                      scanKicked.current = false;
                      void c.connectDevice();
                    }}
                  />
                )}
              </>
            ) : null}

            <View style={styles.footerRow}>
              <Button
                title="Back"
                variant="ghost"
                onPress={() => {
                  if (phase === 'scanning') void c.cancelScan();
                  setShowIdentity(true);
                }}
                disabled={phase === 'connectingDevice'}
              />
              <View style={styles.footerGrow}>
                {phase === 'connectingDevice' ? (
                  // BLE connects can hang indefinitely — always leave the
                  // user a way out.
                  <Button
                    title="Cancel connecting"
                    variant="secondary"
                    onPress={() => {
                      setSelected(null);
                      scanKicked.current = false; // auto-rescan on return
                      void c.cancelConnect();
                    }}
                  />
                ) : (
                  <Button
                    title="Continue"
                    onPress={() => {
                      if (!scans) void c.connectDevice();
                      else if (selected) void c.connectToDevice(selected);
                    }}
                    disabled={scans && !selected}
                  />
                )}
              </View>
            </View>
          </View>
        )}

      {/* Control surface — the data itself lives on the Live tab */}
      {connected && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{deviceName ?? 'Device connected'}</Text>
          {phase === 'starting' ? (
            <View style={styles.scanHeader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.body}>Starting the stream…</Text>
            </View>
          ) : phase === 'streaming' ? (
            stalled ? (
              // Connected and "streaming", but the device has sent nothing.
              // The unfiltered BLE scan means connectable ≠ useful: this is
              // what connecting to headphones/a TV looks like.
              <Banner
                tone="warning"
                text={`Connected, but no data received. ${deviceName ?? 'This device'} may not provide supported readings (heart rate, motion…) — try a different device.`}
              />
            ) : (
              <Banner
                text={
                  terraSocketConnected
                    ? 'Streaming to Terra'
                    : 'Streaming — connecting to Terra…'
                }
                tone="info"
                busy={!terraSocketConnected}
              />
            )
          ) : (
            <Banner text={error ?? 'Stream stopped'} tone={error ? 'error' : 'warning'} />
          )}
          <View style={styles.buttonRow}>
            {phase === 'streaming' ? (
              <>
                <Button title="View live data" onPress={onGoToLive} />
                <Button
                  title="Stop streaming"
                  variant="destructive"
                  onPress={() => void c.stopStreaming()}
                />
              </>
            ) : phase === 'deviceConnected' ? (
              <Button
                title="Resume streaming"
                onPress={() => void c.startStreaming()}
              />
            ) : null}
            <Button
              title="Connect a different device"
              variant="ghost"
              onPress={() => void c.resetDevice()}
              disabled={phase === 'starting'}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 18, flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.semibold },
  body: {
    color: colors.textMid,
    fontSize: 13,
    fontFamily: fonts.regular,
    lineHeight: 19,
    flexShrink: 1,
  },
  hint: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: fonts.regular,
    lineHeight: 16,
  },
  cardFill: { flexGrow: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.hoverBlue },
  chipText: { color: colors.textMid, fontSize: 12, fontFamily: fonts.medium },
  chipTextActive: { color: colors.primary },
  deviceBox: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    flex: 1,
  },
  deviceScrollWrap: { flex: 1 },
  deviceScroll: { flex: 1 },
  scrollMore: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deviceBoxActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  deviceBoxTitle: { color: colors.textDim, fontSize: 11, fontFamily: fonts.regular },
  deviceRow: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomColor: colors.ghostBg,
    borderBottomWidth: 1,
    gap: 2,
  },
  deviceRowSelected: { backgroundColor: colors.hoverBlue },
  deviceName: { color: colors.text, fontSize: 13, fontFamily: fonts.medium },
  deviceMeta: { color: colors.textDim, fontSize: 11, fontFamily: fonts.regular },
  deviceBoxHint: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: fonts.regular,
    padding: 11,
    lineHeight: 16,
  },
  scanHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  footerGrow: { flex: 1 },
  buttonRow: { gap: 8 },
});
