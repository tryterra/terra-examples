import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  /** Mirrors the Terra dashboard's button variants. */
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text
        style={[styles.text, styles[`${variant}Text` as const]]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  destructive: { backgroundColor: colors.failure },
  ghost: { backgroundColor: 'transparent' },
  dimmed: { opacity: 0.6 },
  text: { fontFamily: fonts.medium, fontSize: 14 },
  primaryText: { color: '#FFFFFF' },
  secondaryText: { color: colors.text },
  destructiveText: { color: '#FFFFFF' },
  ghostText: { color: colors.primary },
});
