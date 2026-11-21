import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native';
import { LinearGradient } from './LinearGradient';
import { useReduceMotion } from './motion';

export type AskieEmojiEffect = 'float' | 'pulse' | 'wiggle' | 'bounce' | 'glow' | 'none';

type Props = {
  emoji: string;
  size?: number;
  effect?: AskieEmojiEffect;
  badge?: boolean;
  badgeGradient?: readonly [string, string];
  interactive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

// Curated 3D-friendly vibrant gradient pairings matching Askie's pastel 3D cards
const GRADIENT_PRESETS: Record<string, readonly [string, string]> = {
  '🚀': ['#FF8A7A', '#FF5252'],
  '💻': ['#6C5CE7', '#8E44AD'],
  '🦁': ['#FDCB6E', '#E17055'],
  '📐': ['#00CEC9', '#0984E3'],
  '🔬': ['#55EFC4', '#00B894'],
  '🎨': ['#FD79A8', '#E84393'],
  '🌍': ['#74B9FF', '#0984E3'],
  '📚': ['#A29BFE', '#6C5CE7'],
  '🦕': ['#81ECEC', '#00CEC9'],
  '🎵': ['#FAB1A0', '#FF7675'],
  '🔒': ['#2D3436', '#636E72'],
  '🔑': ['#FFEAA7', '#FDCB6E'],
  '📧': ['#74B9FF', '#0984E3'],
  '📬': ['#55EFC4', '#00CEC9'],
  '🌟': ['#FFEAA7', '#FDCB6E'],
  '🔥': ['#FF7675', '#D63031'],
  'default': ['#FFE3D8', '#FF6B6B'],
};

/**
 * AskieEmoji: High-fidelity animated 3D emoji with spring physics and tactile card glow.
 */
export function AskieEmoji({
  emoji,
  size = 32,
  effect = 'float',
  badge = false,
  badgeGradient,
  interactive = false,
  onPress,
  style,
  textStyle,
}: Props) {
  const reduceMotion = useReduceMotion();
  const animValue = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion || effect === 'none') {
      animValue.setValue(0);
      return;
    }

    let loop: Animated.CompositeAnimation;

    switch (effect) {
      case 'float':
        // Smooth vertical hover loop (up 6px)
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 1400,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 1400,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        );
        break;

      case 'pulse':
        // Heartbeat / glow pulse: scale 1.0 -> 1.15
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 650,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 650,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        );
        break;

      case 'wiggle':
        // Playful tilt: -10deg to +10deg with pause
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 200,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: -1,
              duration: 350,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 200,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.delay(1200),
          ])
        );
        break;

      case 'bounce':
        // Squishy vertical bounce
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 400,
              easing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 400,
              easing: Easing.quad,
              useNativeDriver: true,
            }),
            Animated.delay(800),
          ])
        );
        break;

      case 'glow':
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        break;
    }

    loop.start();
    return () => loop.stop();
  }, [effect, reduceMotion]);

  const handlePressIn = () => {
    if (!interactive) return;
    Animated.spring(pressScale, {
      toValue: 0.86,
      useNativeDriver: true,
      friction: 5,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    if (!interactive) return;
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
      tension: 120,
    }).start();
  };

  // Interpolations
  const translateY =
    effect === 'float'
      ? animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -6] })
      : effect === 'bounce'
      ? animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -10] })
      : 0;

  const rotate =
    effect === 'wiggle'
      ? animValue.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: ['-12deg', '0deg', '12deg'],
        })
      : '0deg';

  const scale =
    effect === 'pulse'
      ? animValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] })
      : effect === 'glow'
      ? animValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] })
      : 1;

  const gradientColors = badgeGradient || GRADIENT_PRESETS[emoji] || GRADIENT_PRESETS.default;
  const badgeSize = Math.round(size * 1.65);
  const badgeRadius = Math.round(badgeSize * 0.32);

  const emojiContent = (
    <Animated.View
      style={{
        transform: [
          { scale: Animated.multiply(scale as any, pressScale) },
          { translateY },
          { rotate },
        ],
      }}
    >
      <Text
        style={[
          {
            fontSize: size,
            textAlign: 'center',
            textShadowColor: 'rgba(0,0,0,0.14)',
            textShadowOffset: { width: 0, height: 3 },
            textShadowRadius: 4,
          },
          textStyle,
        ]}
      >
        {emoji}
      </Text>
    </Animated.View>
  );

  if (badge) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!interactive && !onPress}
        style={[styles.badgeShadow, style]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.badgeSquircle,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeRadius,
            },
          ]}
        >
          {/* Specular highlight rim */}
          <View style={[styles.innerHighlight, { borderRadius: badgeRadius - 1 }]} />
          {emojiContent}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!interactive && !onPress}
      style={[{ alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {emojiContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badgeShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
  badgeSquircle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    overflow: 'hidden',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
