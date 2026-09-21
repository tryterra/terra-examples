import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Button } from './Button';

interface Props {
  /** A lucide-react-native icon component. */
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  text: string;
  buttonTitle?: string;
  onPress?: () => void;
  /** Optional secondary (ghost) action below the primary. */
  secondaryTitle?: string;
  onSecondary?: () => void;
  /** 'error' tints the icon badge failure-red. */
  tone?: 'default' | 'error';
}

/** Centered empty state with a circular icon badge. */
export function EmptyState({
  icon: Icon,
  title,
  text,
  buttonTitle,
  onPress,
  secondaryTitle,
  onSecondary,
  tone = 'default',
}: Props) {
  const error = tone === 'error';
  return (
    <View style={styles.empty}>
      <View
        style={[
          styles.badge,
          error && { backgroundColor: colors.failureBg, borderColor: '#F3C2C7' },
        ]}
      >
        <Icon
          size={26}
          color={error ? colors.failure : colors.primary}
          strokeWidth={2}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      {buttonTitle && onPress ? (
        <View style={styles.button}>
          <Button title={buttonTitle} onPress={onPress} />
        </View>
      ) : null}
      {secondaryTitle && onSecondary ? (
        <Button title={secondaryTitle} variant="ghost" onPress={onSecondary} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 26,
    paddingVertical: 40,
  },
  badge: {
    width: 58,
    height: 58,
    borderRadius: 99,
    backgroundColor: colors.hoverBlue,
    borderColor: colors.terraBlue,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 16, fontFamily: fonts.semibold, textAlign: 'center' },
  text: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: { marginTop: 6 },
});
