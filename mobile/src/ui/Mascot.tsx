import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, shadows, gradients } from '../theme';
import { LinearGradient } from './LinearGradient';

type MascotSize = 's' | 'm' | 'l';

type MascotProps = {
  size?: MascotSize;
  style?: ViewStyle;
};

const SIZE_MAP: Record<MascotSize, { container: number; emoji: number; radius: number }> = {
  s: { container: 48, emoji: 26, radius: radii.md },
  m: { container: 76, emoji: 42, radius: radii.lg },
  l: { container: 120, emoji: 68, radius: 40 },
};

export function Mascot({ size = 'm', style }: MascotProps) {
  const config = SIZE_MAP[size];

  return (
    <View style={[styles.wrapper, size === 'l' ? shadows.mascotSplash : shadows.button, style]}>
      <LinearGradient
        colors={gradients.primary.colors}
        start={gradients.primary.start}
        end={gradients.primary.end}
        style={[
          styles.container,
          {
            width: config.container,
            height: config.container,
            borderRadius: config.radius,
          },
        ]}
      >
        <Text style={{ fontSize: config.emoji }}>🦉</Text>
      </LinearGradient>
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
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
});
