import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  StyleSheet,
  ViewStyle,
  Text,
  Pressable,
} from 'react-native';
import { LinearGradient } from './LinearGradient';
import { useReduceMotion } from './motion';

export type CompanionState = 'idle' | 'listening' | 'speaking' | 'thinking' | 'celebrate';
export type CompanionSize = 's' | 'm' | 'l' | 'xl';

type Props = {
  state?: CompanionState;
  size?: CompanionSize;
  interactive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

const SIZE_CONFIG: Record<CompanionSize, { container: number; radius: number; eyeSize: number; beakSize: number }> = {
  s: { container: 48, radius: 16, eyeSize: 14, beakSize: 8 },
  m: { container: 80, radius: 26, eyeSize: 22, beakSize: 12 },
  l: { container: 130, radius: 42, eyeSize: 34, beakSize: 18 },
  xl: { container: 170, radius: 54, eyeSize: 44, beakSize: 24 },
};

/**
 * AskieCompanion: The expressive 3D AI companion that blinks, speaks, listens,
 * and reacts with fluid 60fps animations — just like Askie's animated avatar!
 */
export function AskieCompanion({
  state = 'idle',
  size = 'm',
  interactive = true,
  onPress,
  style,
}: Props) {
  const reduceMotion = useReduceMotion();
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.m;

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const mouthAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const pulseRing1 = useRef(new Animated.Value(0)).current;
  const pulseRing2 = useRef(new Animated.Value(0)).current;
  const touchScale = useRef(new Animated.Value(1)).current;

  // 1. Idle Hover & Breathing
  useEffect(() => {
    if (reduceMotion) return;

    const hover = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: state === 'celebrate' ? 300 : 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: state === 'celebrate' ? 300 : 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    hover.start();
    return () => hover.stop();
  }, [state, reduceMotion]);

  // 2. Natural Blinking Loop (every ~3.5 seconds)
  useEffect(() => {
    if (reduceMotion) return;

    let timer: any;
    let isMounted = true;

    const doBlink = () => {
      if (!isMounted) return;
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.1, duration: 90, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 110, useNativeDriver: true }),
      ]).start(() => {
        if (!isMounted) return;
        const nextBlink = Math.random() * 2500 + 2500;
        timer = setTimeout(doBlink, nextBlink);
      });
    };

    timer = setTimeout(doBlink, 2000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [reduceMotion]);

  // 3. Speaking Mouth Movement
  useEffect(() => {
    if (reduceMotion || state !== 'speaking') {
      mouthAnim.setValue(0);
      return;
    }

    const mouthLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mouthAnim, {
          toValue: 1,
          duration: 130,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(mouthAnim, {
          toValue: 0.2,
          duration: 110,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(mouthAnim, {
          toValue: 0.8,
          duration: 150,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(mouthAnim, {
          toValue: 0,
          duration: 120,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    mouthLoop.start();
    return () => mouthLoop.stop();
  }, [state, reduceMotion]);

  // 4. Thinking Head Tilt
  useEffect(() => {
    if (reduceMotion || state !== 'thinking') {
      tiltAnim.setValue(0);
      return;
    }

    const tiltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tiltAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(tiltAnim, {
          toValue: -1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    tiltLoop.start();
    return () => tiltLoop.stop();
  }, [state, reduceMotion]);

  // 5. Listening Soundwave Ripples
  useEffect(() => {
    if (reduceMotion || state !== 'listening') {
      pulseRing1.setValue(0);
      pulseRing2.setValue(0);
      return;
    }

    const r1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing1, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRing1, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );

    const r2 = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(pulseRing2, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRing2, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );

    r1.start();
    r2.start();
    return () => {
      r1.stop();
      r2.stop();
    };
  }, [state, reduceMotion]);

  const handlePress = () => {
    if (!interactive) return;
    Animated.sequence([
      Animated.spring(touchScale, { toValue: 0.88, friction: 4, useNativeDriver: true }),
      Animated.spring(touchScale, { toValue: 1.05, friction: 3, useNativeDriver: true }),
      Animated.spring(touchScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  // Interpolated Transforms
  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, state === 'celebrate' ? -14 : -7],
  });

  const rotate = tiltAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  const mouthScaleY = mouthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });

  const ringScale1 = pulseRing1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity1 = pulseRing1.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.3, 0] });

  const ringScale2 = pulseRing2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity2 = pulseRing2.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.3, 0] });

  return (
    <Pressable
      onPress={handlePress}
      disabled={!interactive && !onPress}
      style={[{ alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {/* Listening Soundwave Rings */}
      {state === 'listening' ? (
        <>
          <Animated.View
            style={[
              styles.soundRing,
              {
                width: config.container,
                height: config.container,
                borderRadius: config.radius * 1.5,
                borderColor: '#4ECDC4',
                transform: [{ scale: ringScale1 }],
                opacity: ringOpacity1,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.soundRing,
              {
                width: config.container,
                height: config.container,
                borderRadius: config.radius * 1.5,
                borderColor: '#74B9FF',
                transform: [{ scale: ringScale2 }],
                opacity: ringOpacity2,
              },
            ]}
          />
        </>
      ) : null}

      {/* Main Avatar Character Body */}
      <Animated.View
        style={{
          transform: [
            { translateY },
            { rotate },
            { scale: touchScale },
          ],
        }}
      >
        <LinearGradient
          colors={['#FF7675', '#E17055']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.avatarBody,
            {
              width: config.container,
              height: config.container,
              borderRadius: config.radius,
            },
          ]}
        >
          {/* 3D Specular Lighting / Sheen */}
          <View style={[styles.avatarSheen, { borderRadius: config.radius - 2 }]} />

          {/* Cute Tuft / Ear Accent */}
          <View style={[styles.earAccentL, { top: -config.container * 0.08 }]} />
          <View style={[styles.earAccentR, { top: -config.container * 0.08 }]} />

          {/* Facial Features Container */}
          <View style={styles.faceContainer}>
            {/* Eyes Row */}
            <View style={styles.eyesRow}>
              {/* Left Eye */}
              <Animated.View
                style={[
                  styles.eyeOrb,
                  {
                    width: config.eyeSize,
                    height: config.eyeSize,
                    borderRadius: config.eyeSize / 2,
                    transform: [{ scaleY: state === 'celebrate' ? 0.2 : blinkAnim }],
                  },
                ]}
              >
                {/* Pupil & Specular Sparkle */}
                <View style={styles.eyePupil}>
                  <View style={styles.eyeSparkle} />
                </View>
              </Animated.View>

              {/* Right Eye */}
              <Animated.View
                style={[
                  styles.eyeOrb,
                  {
                    width: config.eyeSize,
                    height: config.eyeSize,
                    borderRadius: config.eyeSize / 2,
                    transform: [{ scaleY: state === 'celebrate' ? 0.2 : blinkAnim }],
                  },
                ]}
              >
                <View style={styles.eyePupil}>
                  <View style={styles.eyeSparkle} />
                </View>
              </Animated.View>
            </View>

            {/* Rosy Cheeks */}
            <View style={styles.cheeksRow}>
              <View style={[styles.cheek, { width: config.eyeSize * 0.6, height: config.eyeSize * 0.35 }]} />
              <View style={[styles.cheek, { width: config.eyeSize * 0.6, height: config.eyeSize * 0.35 }]} />
            </View>

            {/* Beak / Talking Mouth */}
            <Animated.View
              style={[
                styles.beak,
                {
                  width: config.beakSize * 1.3,
                  height: config.beakSize * 0.85,
                  borderRadius: config.beakSize * 0.4,
                  transform: [{ scaleY: mouthScaleY }],
                },
              ]}
            >
              <View style={styles.beakHighlight} />
            </Animated.View>
          </View>

          {/* Thinking Lightbulb / Question Balloon */}
          {state === 'thinking' ? (
            <View style={styles.thinkingBalloon}>
              <Text style={{ fontSize: config.eyeSize * 0.9 }}>💡</Text>
            </View>
          ) : null}

          {/* Celebrate Stars */}
          {state === 'celebrate' ? (
            <View style={styles.celebrateBalloon}>
              <Text style={{ fontSize: config.eyeSize * 0.8 }}>✨</Text>
            </View>
          ) : null}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  soundRing: {
    position: 'absolute',
    borderWidth: 2.5,
    pointerEvents: 'none',
  },
  avatarBody: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    shadowColor: '#D63031',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    position: 'relative',
  },
  avatarSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: 'rgba(255, 255, 255, 0.26)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  earAccentL: {
    position: 'absolute',
    left: '18%',
    width: 14,
    height: 18,
    borderRadius: 7,
    backgroundColor: '#FF7675',
    transform: [{ rotate: '-25deg' }],
  },
  earAccentR: {
    position: 'absolute',
    right: '18%',
    width: 14,
    height: 18,
    borderRadius: 7,
    backgroundColor: '#E17055',
    transform: [{ rotate: '25deg' }],
  },
  faceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: '6%',
  },
  eyesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '56%',
    alignItems: 'center',
  },
  eyeOrb: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  eyePupil: {
    width: '64%',
    height: '64%',
    borderRadius: 100,
    backgroundColor: '#1E272E',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: '12%',
    paddingRight: '12%',
  },
  eyeSparkle: {
    width: '38%',
    height: '38%',
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
  },
  cheeksRow: {
    position: 'absolute',
    top: '38%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '74%',
  },
  cheek: {
    backgroundColor: 'rgba(255, 118, 117, 0.45)',
    borderRadius: 12,
  },
  beak: {
    backgroundColor: '#FDCB6E',
    marginTop: -2,
    borderWidth: 1,
    borderColor: '#E17055',
    overflow: 'hidden',
    position: 'relative',
  },
  beakHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  thinkingBalloon: {
    position: 'absolute',
    top: -12,
    right: -10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 5,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  celebrateBalloon: {
    position: 'absolute',
    top: -12,
    right: -8,
    backgroundColor: '#FFEAA7',
    borderRadius: 16,
    paddingHorizontal: 5,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
});
