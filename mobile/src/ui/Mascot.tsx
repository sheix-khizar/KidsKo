import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from './LinearGradient';
import { gradients, colors } from '../theme';

type MascotSize = 's' | 'm' | 'l';

type MascotProps = {
  size?: MascotSize;
  style?: ViewStyle;
};

const SIZE_MAP: Record<MascotSize, { container: number; emoji: number; radius: number }> = {
  s: { container: 44, emoji: 24, radius: 15 },
  m: { container: 72, emoji: 40, radius: 24 },
  l: { container: 120, emoji: 64, radius: 40 },
};

export function Mascot({ size = 'm', style }: MascotProps) {
  const config = SIZE_MAP[size];

  return (
    <View style={[styles.wrapper, style]}>
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          {
            width: config.container,
            height: config.container,
            borderRadius: config.radius,
            shadowColor: colors.coral,
            shadowOffset: { width: 0, height: size === 'l' ? 12 : 6 },
            shadowOpacity: 0.45,
            shadowRadius: size === 'l' ? 20 : 10,
            elevation: size === 'l' ? 12 : 6,
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
  },
});

