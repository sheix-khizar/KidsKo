import React, { useState } from 'react';
import { View, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { radii, shadows, gradients } from '../theme';
import { LinearGradient } from './LinearGradient';
import { useVideoPlayer, VideoView } from 'expo-video';

export type MascotSize = 'xs' | 's' | 'm' | 'l' | 'xl';
export type MascotShape = 'squircle' | 'circle';

type MascotProps = {
  size?: MascotSize;
  shape?: MascotShape;
  animated?: boolean;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

const MASCOT_IMG = require('../../assets/App-Icon.jpeg');
const MASCOT_VID = require('../../assets/vid2.mp4');

const SIZE_MAP: Record<MascotSize, { container: number; radius: number }> = {
  xs: { container: 34, radius: radii.sm },
  s: { container: 48, radius: radii.md },
  m: { container: 76, radius: radii.lg },
  l: { container: 120, radius: 36 },
  xl: { container: 160, radius: 48 },
};

class VideoErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: any) {
    console.log('[Mascot] Video playback not available, using 3D image fallback:', err?.message || err);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function MascotVideo({ size, borderRadius }: { size: number; borderRadius: number }) {
  const player = useVideoPlayer(MASCOT_VID, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: 'hidden',
      }}
      allowsPictureInPicture={false}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export function Mascot({ size = 'm', shape = 'squircle', animated = true, style, imageStyle }: MascotProps) {
  const config = SIZE_MAP[size] || SIZE_MAP.m;
  const borderRadius = shape === 'circle' ? config.container / 2 : config.radius;
  const innerSize = config.container - 4;
  const innerRadius = Math.max(0, borderRadius - 2);

  const fallbackImage = (
    <Image
      source={MASCOT_IMG}
      style={[
        styles.image,
        {
          width: innerSize,
          height: innerSize,
          borderRadius: innerRadius,
        },
        imageStyle,
      ]}
      resizeMode="cover"
    />
  );

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
        {animated && (size === 'm' || size === 'l' || size === 'xl') ? (
          <VideoErrorBoundary fallback={fallbackImage}>
            <MascotVideo size={innerSize} borderRadius={innerRadius} />
          </VideoErrorBoundary>
        ) : (
          fallbackImage
        )}
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
