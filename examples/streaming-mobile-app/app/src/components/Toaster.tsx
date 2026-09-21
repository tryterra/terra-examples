import { CircleAlert, CircleCheck } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';

/**
 * Sonner-style toasts: stacked top-center cards, auto-dismissing.
 * Imperative API — toast.success(title, message?) — so any module can
 * fire one without prop-drilling. <Toaster /> mounts once at the root.
 */

export interface ToastItem {
  id: number;
  tone: 'success' | 'error';
  title: string;
  message?: string;
}

let nextId = 1;
const listeners = new Set<(t: ToastItem) => void>();

function push(tone: ToastItem['tone'], title: string, message?: string): void {
  const item = { id: nextId++, tone, title, message };
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (title: string, message?: string) => push('success', title, message),
  error: (title: string, message?: string) => push('error', title, message),
};

const TOAST_MS = 3500;
const MAX_VISIBLE = 3;

export function Toaster() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), t]);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      {items.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDone={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
        />
      ))}
    </View>
  );
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  // Drop down on enter (springy), hold, then glide back up and fade out.
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => onDone(item.id));
    }, TOAST_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const error = item.tone === 'error';
  const Icon = error ? CircleAlert : CircleCheck;
  const fg = error ? colors.failure : colors.success;

  return (
    <Animated.View
      style={[
        styles.toast,
        error ? styles.errorToast : styles.successToast,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-56, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      <Icon size={17} color={fg} strokeWidth={2.2} />
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.message ? (
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 420,
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  successToast: { borderColor: '#BCE5C8', backgroundColor: colors.successBg },
  errorToast: { borderColor: '#F3C2C7', backgroundColor: colors.failureBg },
  textWrap: { flexShrink: 1 },
  title: { fontSize: 13, fontFamily: fonts.medium },
  message: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMid, marginTop: 1 },
});
