import React from 'react';
import { View, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { radii, shadows, gradients } from '../theme';
import { LinearGradient } from './LinearGradient';

export type MascotSize = 'xs' | 's' | 'm' | 'l' | 'xl';
export type MascotShape = 'squircle' | 'circle';

type MascotProps = {
  size?: MascotSize;
  shape?: MascotShape;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

const MASCOT_IMG = require('../../assets/App-Icon.jpeg');

const SIZE_MAP: Record<MascotSize, { container: number; radius: number }> = {
  xs: { container: 34, radius: radii.sm },
  s: { container: 48, radius: radii.md },
  m: { container: 76, radius: radii.lg },
  l: { container: 120, radius: 36 },
  xl: { container: 160, radius: 48 },
};

export function Mascot({ size = 'm', shape = 'squircle', style, imageStyle }: MascotProps) {
  const config = SIZE_MAP[size] || SIZE_MAP.m;
  const borderRadius = shape === 'circle' ? config.container / 2 : config.radius;

  return (
    <View style={[styles.wrapper, size === 'l' || size === 'xl' ? shadows.mascotSplash : shadows.button, style]}>
      <LinearGradient
        colors={gradients.primary.colors}
        start={gradients.primary.start}
        end={gradients.primary.end}
        style={[
          styles.container,
          {
            width: config.container,
            height: config.container,
            borderRadius,
          },
        ]}
      >
        <Image
          source={MASCOT_IMG}
          style={[
            styles.image,
            {
              width: config.container - 4,
              height: config.container - 4,
              borderRadius: borderRadius - 2,
            },
            imageStyle,
          ]}
          resizeMode="cover"
        />
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
    borderColor: 'rgba(255, 255, 255, 0.7)',
    overflow: 'hidden',
  },
  image: {
    overflow: 'hidden',
  },
});
