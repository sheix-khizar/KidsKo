import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../theme';

type MascotSize = 's' | 'm' | 'l';

type MascotProps = {
  size?: MascotSize;
  style?: ViewStyle;
};

const SIZE_MAP: Record<MascotSize, { container: number; emoji: number; radius: number }> = {
  s: { container: 44, emoji: 24, radius: radii.md },
  m: { container: 72, emoji: 40, radius: radii.lg },
  l: { container: 110, emoji: 64, radius: radii.xl },
};

export function Mascot({ size = 'm', style }: MascotProps) {
  const config = SIZE_MAP[size];

  return (
    <View style={[styles.wrapper, shadows.card, style]}>
      <View
        style={[
          styles.container,
          {
            width: config.container,
            height: config.container,
            borderRadius: config.radius,
            backgroundColor: colors.sun,
          },
        ]}
      >
        <Text style={{ fontSize: config.emoji }}>🦉</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
});
