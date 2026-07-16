import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Activity, QrCode, Watch } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  getSession,
  hasValidSession,
  loadSession,
  onSessionChange,
  parsePairingPayload,
  saveSession,
} from './src/auth';
import { toast, Toaster } from './src/components/Toaster';
import { useProducer } from './src/producer/useProducer';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { LiveScreen } from './src/screens/LiveScreen';
import { PairScreen } from './src/screens/PairScreen';
import { colors, fonts } from './src/theme';

type Tab = 'live' | 'connect' | 'pair';

const TABS: { id: Tab; label: string; Icon: typeof Activity }[] = [
  { id: 'live', label: 'Live', Icon: Activity },
  { id: 'connect', label: 'Connect', Icon: Watch },
  { id: 'pair', label: 'Pair', Icon: QrCode },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

function AppInner() {
  // Core SafeAreaView is iOS-only; insets cover Android edge-to-edge too.
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });
  const [tab, setTab] = useState<Tab>('live');
  // Tab to return to after a successful pairing.
  const returnTabRef = useRef<Tab>('live');
  const producer = useProducer();

  const goToPair = (from: Tab) => {
    returnTabRef.current = from;
    setTab('pair');
  };

  // Hydrate the persisted session on launch.
  useEffect(() => {
    void loadSession();
  }, []);

  // Deep-link pairing: the QR encodes terrastreaming://pair?p=<payload>,
  // so scanning with the native camera app pairs directly. Handles both
  // cold starts (initial URL) and warm opens.
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const session = parsePairingPayload(url);
      if (!session) return;
      void saveSession(session).then(() => {
        toast.success(
          'Paired with Terra',
          session.referenceId ? `Streaming as ${session.referenceId}` : undefined,
        );
        setTab('live');
      });
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  // The session store isn't reactive — re-render on session changes.
  const [, setSessionTick] = useState(0);
  useEffect(
    () => onSessionChange(() => setSessionTick((n) => n + 1)),
    [],
  );

  // Android background streaming (iOS gets bluetooth-central for free):
  // the SDK manages the foreground service itself; this effect only
  // customizes the notification and offers the battery-saver exemption.
  const isStreaming = producer.phase === 'streaming';
  const batteryPromptShown = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (getSession()?.demo) return; // synthetic stream: no service, no prompts
    if (isStreaming) {
      const rt = require('terra-rt');
      void rt
        .startForegroundService('Terra Grip', 'Streaming live data to Terra')
        .catch(() => undefined);

      // Aggressive OEM battery managers (MIUI et al.) kill even foreground
      // services — offer the one-tap exemption dialog, once per app run.
      if (!batteryPromptShown.current) {
        void rt.isIgnoringBatteryOptimizations().then((exempt: boolean) => {
          if (exempt || batteryPromptShown.current) return;
          batteryPromptShown.current = true;
          Alert.alert(
            'Keep streaming with the screen off?',
            "Your phone's battery saver can pause streaming when the screen locks. Allow Terra Grip to run unrestricted while it streams.",
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Allow',
                onPress: () =>
                  void rt.requestIgnoreBatteryOptimizations().catch(() => undefined),
              },
            ],
          );
        });
      }
    }
  }, [isStreaming]);

  // Session expiry is passive — no event fires when the clock runs out.
  // Poll for the valid → invalid transition and tear everything down.
  const [, setExpiryTick] = useState(0);
  const wasValidRef = useRef(false);
  useEffect(() => {
    const check = () => {
      const valid = hasValidSession();
      if (!valid && wasValidRef.current) {
        const c = producer.controller;
        const phase = c.getSnapshot().phase;
        if (phase === 'scanning') void c.cancelScan();
        else void c.resetDevice();
        setExpiryTick((n) => n + 1); // force the gate/expired screens to render
      }
      wasValidRef.current = valid;
    };
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fontsLoaded) return null; // one frame at most; avoids font swap flash

  const isPair = tab === 'pair';

  return (
    <View style={[styles.root, isPair && styles.rootDark]}>
      <StatusBar
        barStyle={isPair ? 'light-content' : 'dark-content'}
        backgroundColor={isPair ? '#10151D' : colors.background}
      />
      {/* Status-bar inset spacer (transparent — root paints behind it). */}
      <View style={{ height: insets.top }} />

      {isPair ? (
        <PairScreen active={isPair} onPaired={() => setTab(returnTabRef.current)} />
      ) : (
        <View style={styles.content}>
          {tab === 'live' && (
            <LiveScreen
              onGoToPair={() => goToPair('live')}
              onGoToConnect={() => setTab('connect')}
            />
          )}
          {tab === 'connect' && (
            <ConnectScreen
              onGoToPair={() => goToPair('connect')}
              onGoToLive={() => setTab('live')}
            />
          )}
        </View>
      )}

      {/* The tab bar's background extends through the home-indicator /
          gesture-bar inset to the screen edge on both platforms. */}
      <View
        style={[
          styles.tabSafe,
          { paddingBottom: insets.bottom },
          isPair && styles.tabBarDark,
        ]}
      >
        <View style={styles.tabBar}>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            const color = active
              ? colors.primary
              : isPair
                ? '#7A8699'
                : colors.textDim;
            return (
              <Pressable
                key={id}
                style={styles.tab}
                onPress={() => {
                  // Tapping Pair directly remembers the tab you were on.
                  if (id === 'pair' && tab !== 'pair') returnTabRef.current = tab;
                  setTab(id);
                }}
              >
                <Icon size={20} color={color} strokeWidth={active ? 2.4 : 2} />
                <Text style={[styles.tabLabel, { color }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Toaster />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rootDark: { backgroundColor: '#10151D' },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  tabSafe: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  tabBar: { flexDirection: 'row' },
  tabBarDark: {
    backgroundColor: '#161D28',
    borderTopColor: '#232C3A',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  tabLabel: { fontSize: 11, fontFamily: fonts.medium },
});
