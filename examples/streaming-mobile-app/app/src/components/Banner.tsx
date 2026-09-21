import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

interface Props {
  text: string;
  tone?: 'info' | 'warning' | 'error';
  /** Show a spinner (reconnecting-style banners). */
  busy?: boolean;
  /** Optional inline action rendered on the right (e.g. "Refresh"). */
  actionTitle?: string;
  onAction?: () => void;
}

/** Tinted status banner — matches the dashboard's Badge/alert styling. */
export function Banner({ text, tone = 'info', busy, actionTitle, onAction }: Props) {
  const palette = {
    info: { bg: colors.hoverBlue, fg: colors.primary },
    warning: { bg: colors.warningBg, fg: colors.warning },
    error: { bg: colors.failureBg, fg: colors.failure },
  }[tone];

  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      {busy ? <ActivityIndicator size="small" color={palette.fg} /> : null}
      <Text style={[styles.text, { color: palette.fg }]}>{text}</Text>
      {actionTitle && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.actionWrap}>
          <Text style={[styles.action, { color: palette.fg }]}>{actionTitle}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: { fontFamily: fonts.medium, fontSize: 13, flexShrink: 1, flexGrow: 1 },
  actionWrap: { marginLeft: 'auto' },
  action: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
