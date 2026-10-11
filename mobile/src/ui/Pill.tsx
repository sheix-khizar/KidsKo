import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, radii, typography } from '../theme';

type PillProps = {
  label: string;
  icon?: string;
  color?: string;
  textColor?: string;
  borderColor?: string;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function Pill({
  label,
  icon,
  color = colors.cardBgMuted,
  textColor = colors.text,
  borderColor = colors.border,
  onPress,
  style,
  textStyle,
}: PillProps) {
  const content = (
    <View
      style={[
        styles.pill,
        { backgroundColor: color, borderColor },
        style,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.text, { color: textColor }, textStyle]}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
    gap: 6,
  },
  icon: {
    fontSize: 14,
  },
  text: {
    ...typography.caption,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
