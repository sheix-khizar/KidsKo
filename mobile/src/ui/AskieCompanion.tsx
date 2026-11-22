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
export type CompanionSize = 'xs' | 's' | 'm' | 'l' | 'xl';

type Props = {
  state?: CompanionState;
  size?: CompanionSize;
  shape?: 'squircle' | 'circle';
  interactive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  standing?: boolean;
  avatarMode?: boolean;
};

const SIZE_CONFIG: Record<CompanionSize, { container: number; radius: number; eyeSize: number; beakSize: number }> = {
  xs: { container: 36, radius: 13, eyeSize: 11, beakSize: 7 },
  s: { container: 44, radius: 15, eyeSize: 13, beakSize: 8 },
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
  shape = 'squircle',
  interactive = true,
  onPress,
  style,
  standing,
  avatarMode,
}: Props) {
  const reduceMotion = useReduceMotion();
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.m;
  const effectiveRadius = shape === 'circle' ? config.container / 2 : config.radius;
  const isStanding = standing !== undefined ? standing : (size === 'm' || size === 'l' || size === 'xl');
  const isAvatar = avatarMode ?? (!isStanding && (size === 'xs' || size === 's'));

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const mouthAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const pulseRing1 = useRef(new Animated.Value(0)).current;
  const pulseRing2 = useRef(new Animated.Value(0)).current;
  const touchScale = useRef(new Animated.Value(1)).current;

  // 1. Idle Hover & Breathing (disabled for avatars so they stay still)
  useEffect(() => {
    if (reduceMotion || isAvatar) {
      floatAnim.setValue(0);
      return;
    }

    const hover = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: state === 'celebrate' ? 300 : (isStanding ? 1800 : 1600),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: state === 'celebrate' ? 300 : (isStanding ? 1800 : 1600),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    hover.start();
    return () => hover.stop();
  }, [state, isAvatar, isStanding, reduceMotion]);

  // 2. Hand Waving for standing mascot (Image 3)
  useEffect(() => {
    if (reduceMotion || !isStanding || isAvatar) {
      waveAnim.setValue(0);
      return;
    }

    let isMounted = true;
    let timer: any;

    const runWaveCycle = () => {
      if (!isMounted) return;

      if (state === 'celebrate') {
        // Joyful fast waving / celebration flap
        Animated.loop(
          Animated.sequence([
            Animated.timing(waveAnim, { toValue: 1, duration: 150, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(waveAnim, { toValue: 0.2, duration: 150, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          { iterations: 8 }
        ).start(() => {
          if (isMounted) timer = setTimeout(runWaveCycle, 800);
        });
        return;
      }

      // Friendly cartoon hand waving sequence:
      // Lifts hand up -> waves hello 3 times -> lowers to rest -> waits ~2s
      Animated.sequence([
        // Raise hand up to greet
        Animated.timing(waveAnim, {
          toValue: 0.6,
          duration: 320,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        // Wave 1: out -> in
        Animated.timing(waveAnim, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0.35, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        // Wave 2: out -> in
        Animated.timing(waveAnim, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0.35, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        // Wave 3: out -> in
        Animated.timing(waveAnim, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0.5, duration: 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        // Return hand gently back to side
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!isMounted) return;
        timer = setTimeout(runWaveCycle, 2200);
      });
    };

    timer = setTimeout(runWaveCycle, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isStanding, isAvatar, state, reduceMotion]);

  // 3. Natural Blinking Loop (every ~3.5 seconds)
  useEffect(() => {
    if (reduceMotion) return;

    let timer: any;
    let isMounted = true;

    const doBlink = () => {
      if (!isMounted) return;
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 0, duration: 110, useNativeDriver: true }),
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
  const translateY = isAvatar
    ? 0
    : floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, isStanding ? -3 : (state === 'celebrate' ? -14 : -7)],
      });

  const rotate = isAvatar
    ? '0deg'
    : tiltAnim.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-8deg', '0deg', '8deg'],
      });

  const mouthScaleY = mouthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });

  const eyelidTranslateY = blinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-config.eyeSize, 0],
  });

  const ringScale1 = pulseRing1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity1 = pulseRing1.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.3, 0] });

  const ringScale2 = pulseRing2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity2 = pulseRing2.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.3, 0] });

  // Right wing waving rotation (Image 3)
  const rightWingRotate = isStanding
    ? waveAnim.interpolate({
        inputRange: [0, 0.35, 0.6, 1],
        outputRange: ['12deg', '-28deg', '-48deg', '-72deg'],
      })
    : '12deg';

  // Left wing rotation (natural gentle idle breathing or celebration flap)
  const leftWingRotate = isStanding
    ? (state === 'celebrate'
        ? waveAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['-12deg', '48deg'],
          })
        : floatAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['-10deg', '-18deg'],
          }))
    : '-12deg';

  const shadowScaleX = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });
  const shadowOpacity = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 0.55],
  });

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
        {/* Left Wing / Hand (Cute animated cartoon wing) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.wingL,
              {
                width: config.container * 0.22,
                height: config.container * 0.38,
                borderRadius: config.container * 0.11,
                left: -config.container * 0.1,
                top: config.container * 0.36,
                transform: [{ rotate: leftWingRotate }],
              },
            ]}
          >
            <LinearGradient
              colors={['#FF6B6B', '#D63031']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.wingInner, { borderRadius: config.container * 0.11 }]}
            />
          </Animated.View>
        )}

        {/* Right Wing / Hand (Cute animated cartoon wing) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.wingR,
              {
                width: config.container * 0.22,
                height: config.container * 0.38,
                borderRadius: config.container * 0.11,
                right: -config.container * 0.1,
                top: config.container * 0.36,
                transform: [{ rotate: rightWingRotate }],
              },
            ]}
          >
            <LinearGradient
              colors={['#FF6B6B', '#D63031']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.wingInner, { borderRadius: config.container * 0.11 }]}
            />
          </Animated.View>
        )}

        <LinearGradient
          colors={['#FF7675', '#E17055']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.avatarBody,
            isAvatar && styles.avatarBodyAvatar,
            {
              width: config.container,
              height: config.container,
              borderRadius: effectiveRadius,
            },
          ]}
        >
          {/* 3D Specular Lighting / Sheen */}
          <View style={[styles.avatarSheen, { borderRadius: effectiveRadius - 2 }]} />

          {/* Cute Tuft / Ear Accent */}
          <View style={[styles.earAccentL, { top: -config.container * 0.08 }]} />
          <View style={[styles.earAccentR, { top: -config.container * 0.08 }]} />

          {/* Facial Features Container */}
          <View style={styles.faceContainer}>
            {/* Eyes Row */}
            <View style={styles.eyesRow}>
              {/* Left Eye */}
              <View
                style={[
                  styles.eyeOrb,
                  {
                    width: config.eyeSize,
                    height: config.eyeSize,
                    borderRadius: config.eyeSize / 2,
                    overflow: 'hidden',
                  },
                ]}
              >
                {/* Pupil & Specular Sparkle */}
                <View style={styles.eyePupil}>
                  <View style={styles.eyeSparkle} />
                </View>

                {/* Animated Eyelid - clean downward slide without pupil deformation */}
                <Animated.View
                  style={[
                    styles.eyelid,
                    {
                      height: config.eyeSize,
                      transform: [{ translateY: eyelidTranslateY }],
                    },
                  ]}
                />
              </View>

              {/* Right Eye */}
              <View
                style={[
                  styles.eyeOrb,
                  {
                    width: config.eyeSize,
                    height: config.eyeSize,
                    borderRadius: config.eyeSize / 2,
                    overflow: 'hidden',
                  },
                ]}
              >
                <View style={styles.eyePupil}>
                  <View style={styles.eyeSparkle} />
                </View>

                {/* Animated Eyelid */}
                <Animated.View
                  style={[
                    styles.eyelid,
                    {
                      height: config.eyeSize,
                      transform: [{ translateY: eyelidTranslateY }],
                    },
                  ]}
                />
              </View>
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
                  transform: [{ scaleY: state === 'celebrate' ? 1.4 : mouthScaleY }],
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

        {/* Small Cute Feet (standing character) */}
        {isStanding && (
          <>
            <View
              style={[
                styles.foot,
                {
                  width: config.container * 0.22,
                  height: config.container * 0.1,
                  borderRadius: config.container * 0.05,
                  bottom: -config.container * 0.05,
                  left: config.container * 0.22,
                },
              ]}
            />
            <View
              style={[
                styles.foot,
                {
                  width: config.container * 0.22,
                  height: config.container * 0.1,
                  borderRadius: config.container * 0.05,
                  bottom: -config.container * 0.05,
                  right: config.container * 0.22,
                },
              ]}
            />
          </>
        )}
      </Animated.View>

      {/* Ground Floor Shadow underneath standing character */}
      {isStanding && (
        <Animated.View
          style={[
            styles.groundShadow,
            {
              width: config.container * 0.72,
              height: Math.max(7, config.container * 0.1),
              borderRadius: config.container * 0.36,
              marginTop: config.container * 0.07,
              transform: [{ scaleX: shadowScaleX }],
              opacity: shadowOpacity,
            },
          ]}
        />
      )}
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
  avatarBodyAvatar: {
    borderWidth: 1.5,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
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
  eyelid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF6B6B',
    borderBottomWidth: 3,
    borderBottomColor: '#E65555',
    zIndex: 5,
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
  wingL: {
    position: 'absolute',
    zIndex: 2,
    shadowColor: '#D63031',
    shadowOffset: { width: -2, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    transformOrigin: 'top right' as any,
  },
  wingR: {
    position: 'absolute',
    zIndex: 2,
    shadowColor: '#D63031',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    transformOrigin: 'top left' as any,
  },
  wingInner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  foot: {
    position: 'absolute',
    backgroundColor: '#FFD54F',
    borderWidth: 1.5,
    borderColor: '#E6A100',
    borderBottomWidth: 3.5,
    zIndex: 2,
    shadowColor: '#E6A100',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  groundShadow: {
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
  },
});
