import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors, radii, shadows, typography, gradients, fontFamilies } from '../theme';
import { LinearGradient } from './LinearGradient';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isDanger && styles.danger,
        isGhost && styles.ghost,
        isPrimary && !disabled && shadows.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {isPrimary && !disabled && (
        <LinearGradient
          colors={gradients.primary.colors}
          start={gradients.primary.start}
          end={gradients.primary.end}
          style={[StyleSheet.absoluteFill, { borderRadius: radii.lg }]}
        />
      )}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary || isDanger ? colors.white : colors.text}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon ? <Text style={styles.iconText}>{icon}</Text> : null}
          <Text
            style={[
              styles.textBase,
              isPrimary && styles.primaryText,
              isSecondary && styles.secondaryText,
              isDanger && styles.dangerText,
              isGhost && styles.ghostText,
              disabled && styles.disabledText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.lg,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
  },
  iconText: {
    fontSize: 18,
  },
  primary: {
    backgroundColor: colors.coralStrong,
  },
  secondary: {
    backgroundColor: colors.mint,
  },
  danger: {
    backgroundColor: colors.coralStrong,
  },
  ghost: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.25)',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    backgroundColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  textBase: {
    ...typography.label,
    textAlign: 'center',
  },
  primaryText: {
    color: colors.white,
    fontFamily: fontFamilies.black,
    fontSize: 18,
  },
  secondaryText: {
    color: colors.text,
  },
  dangerText: {
    color: colors.white,
  },
  ghostText: {
    color: colors.coral,
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
  },
  disabledText: {
    color: colors.subtext,
  },
});
