import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  clearSession,
  getSession,
  parsePairingPayload,
  saveSession,
} from '../auth';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { toast } from '../components/Toaster';

// expo-camera is a native module — require lazily and degrade gracefully
// if the running binary predates it.
declare const require: (id: string) => any;

let cameraModule: any | null | undefined;
function getCamera(): any | null {
  if (cameraModule === undefined) {
    try {
      // The JS export exists even when the native module isn't in the
      // binary — rendering CameraView then crashes. Verify the native
      // side is present before offering the camera at all.
      const { requireOptionalNativeModule } = require('expo-modules-core');
      const native = requireOptionalNativeModule?.('ExpoCamera');
      const mod = require('expo-camera');
      cameraModule = native && mod?.CameraView ? mod : null;
    } catch {
      cameraModule = null;
    }
  }
  return cameraModule;
}

const RETICLE = 210;

interface Props {
  /** Only mount the camera while this tab is on screen. */
  active: boolean;
  /** Called after a session has been saved. */
  onPaired: () => void;
}

/**
 * Full-bleed QR scanner. The Terra dashboard shows a QR carrying a
 * reusable rt. token + identity; one scan pairs this phone for the
 * token's lifetime — reconnects and re-streams included.
 */
export function PairScreen({ active, onPaired }: Props) {
  const camera = getCamera();
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown',
  );
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!active) {
      handledRef.current = false;
      setError(null);
      return;
    }
    if (camera?.Camera?.requestCameraPermissionsAsync) {
      void camera.Camera.requestCameraPermissionsAsync().then((r: any) =>
        setPermission(r?.granted ? 'granted' : 'denied'),
      );
    }
  }, [active, camera]);

  const accept = (raw: string) => {
    if (handledRef.current) return;
    const session = parsePairingPayload(raw);
    if (!session) {
      setError("That doesn't look like a Terra pairing code — try again.");
      toast.error("That doesn't look like a Terra pairing code");
      return;
    }
    handledRef.current = true;
    void saveSession(session).then(() => {
      toast.success(
        'Paired with Terra',
        session.referenceId ? `Streaming as ${session.referenceId}` : undefined,
      );
      onPaired();
    });
  };

  const CameraView = camera?.CameraView;
  const showCamera = active && CameraView && permission === 'granted';

  return (
    <View style={styles.container}>
      {showCamera ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(e: any) => accept(String(e?.data ?? ''))}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cameraFallback]}>
          <Text style={styles.fallbackText}>
            {camera == null
              ? 'Camera module not in this build — rebuild the app to scan the pairing QR.'
              : permission === 'denied'
                ? 'Camera access is needed to scan the pairing QR — enable it in Settings.'
                : 'Starting camera…'}
          </Text>
        </View>
      )}

      {/* Dimmed overlay with a clear reticle window */}
      <View pointerEvents="none" style={styles.overlay}>
        <Text style={styles.title}>
          {getSession() ? 'Scan to re-pair' : 'Pair with Terra'}
        </Text>
        <Text style={styles.subtitle}>
          Point at the QR code in the Terra dashboard
        </Text>
        <View style={styles.reticle}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </View>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {getSession() ? (
          <Button
            title="Unpair this phone"
            variant="ghost"
            onPress={() => {
              handledRef.current = false;
              void clearSession().then(() =>
                toast.success('Unpaired', 'Streaming stopped and session cleared'),
              );
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#10151D' },
  cameraFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  fallbackText: {
    color: '#C8D2E0',
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 19,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: fonts.semibold,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  subtitle: {
    color: '#C8D2E0',
    fontSize: 13,
    fontFamily: fonts.regular,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  reticle: { width: RETICLE, height: RETICLE },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: colors.primary,
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    gap: 8,
  },
  error: {
    color: '#FFB4BB',
    fontSize: 12,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
});
