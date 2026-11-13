import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing, ViewStyle, Image, UIManager } from 'react-native';
import LottieView from 'lottie-react-native';
import { colors, radii, shadows, gradients } from '../theme';
import { LinearGradient } from './LinearGradient';
import { owlIdle, owlListening, owlThinking, owlSpeaking } from './mascotAnimations';

export type OwlMascotState = 'idle' | 'listening' | 'thinking' | 'speaking';

// Safe check: verify if native Lottie ViewManager is compiled into this APK binary
const isLottieNativeAvailable: boolean = Boolean(
  (UIManager as any)?.getViewManagerConfig?.('LottieAnimationView') ||
  (UIManager as any)?.getViewManagerConfig?.('RCTLottieAnimationView') ||
  (UIManager as any)?.hasViewManagerConfig?.('LottieAnimationView') ||
  (UIManager as any)?.hasViewManagerConfig?.('RCTLottieAnimationView')
);

type Props = {
  state?: OwlMascotState;
  size?: number;
  style?: ViewStyle;
  shape?: 'circle' | 'squircle';
  interactive?: boolean;
};

const ANIMATIONS: Record<OwlMascotState, any> = {
  idle: owlIdle,
  listening: owlListening,
  thinking: owlThinking,
  speaking: owlSpeaking,
};

const STATIC_MASCOT = require('../../assets/App-Icon.jpeg');

export function InteractiveOwl({
  state = 'idle',
  size = 120,
  style,
  shape = 'circle',
}: Props) {
  const [lottieFailed, setLottieFailed] = useState(false);
  const lottieRef = useRef<LottieView>(null);

  // Fallback animation values for pure JS micro-motion
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Lottie state change handler
  useEffect(() => {
    if (!lottieFailed) {
      try {
        lottieRef.current?.reset();
        lottieRef.current?.play();
      } catch {
        setLottieFailed(true);
      }
    }
  }, [state, lottieFailed]);

  // Micro-motion physics (idle floating & reactive talking bounce)
  useEffect(() => {
    // 1. Gentle floating / breathing
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();

    // 2. Reactive scaling on speaking / listening
    if (state === 'speaking') {
      const talkPulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.96,
            duration: 200,
            useNativeDriver: true,
          }),
        ])
      );
      talkPulse.start();
      return () => {
        talkPulse.stop();
        pulseAnim.setValue(1);
      };
    } else if (state === 'listening') {
      Animated.timing(rotateAnim, {
        toValue: 1, // tilt head
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      pulseAnim.setValue(1);
    }

    return () => {
      floatLoop.stop();
    };
  }, [state]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-6deg'],
  });

  const borderRadius = shape === 'circle' ? size / 2 : radii.xl;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          transform: [
            { translateY: floatAnim },
            { scale: pulseAnim },
            { rotate: spin },
          ],
        },
        style,
      ]}
    >
      <LinearGradient
        colors={
          state === 'listening'
            ? gradients.teal.colors
            : state === 'thinking'
            ? [colors.sun, colors.orange]
            : gradients.primary.colors
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
          },
        ]}
      >
        {!lottieFailed && isLottieNativeAvailable ? (
          <LottieView
            ref={lottieRef}
            source={ANIMATIONS[state] || ANIMATIONS.idle}
            autoPlay
            loop
            speed={state === 'speaking' ? 1.2 : 1.0}
            style={{ width: size, height: size }}
            onAnimationFailure={() => setLottieFailed(true)}
          />
        ) : (
          <Image
            source={STATIC_MASCOT}
            style={{
              width: size - 6,
              height: size - 6,
              borderRadius: borderRadius - 3,
            }}
            resizeMode="cover"
          />
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.mascotSplash,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    overflow: 'hidden',
  },
});
