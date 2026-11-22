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

export type CompanionState = 'idle' | 'listening' | 'speaking' | 'thinking' | 'celebrate' | 'waving' | 'wave';
export type CompanionSize = 'xs' | 's' | 'm' | 'l' | 'xl';

type Props = {
  state?: CompanionState;
  size?: CompanionSize;
  shape?: 'squircle' | 'circle';
  interactive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  standing?: boolean;
};

const SIZE_CONFIG: Record<CompanionSize, { container: number; radius: number; eyeSize: number; beakSize: number }> = {
  xs: { container: 34, radius: 11, eyeSize: 9, beakSize: 6 },
  s: { container: 48, radius: 16, eyeSize: 14, beakSize: 8 },
  m: { container: 80, radius: 26, eyeSize: 22, beakSize: 12 },
  l: { container: 120, radius: 38, eyeSize: 30, beakSize: 16 },
  xl: { container: 148, radius: 46, eyeSize: 36, beakSize: 20 },
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
}: Props) {
  const reduceMotion = useReduceMotion();
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.m;
  const isWavingState = state === 'waving' || state === 'wave';
  const effectiveRadius = shape === 'circle' ? config.container / 2 : config.radius;
  const isStanding = standing !== undefined ? standing : (size === 'm' || size === 'l' || size === 'xl');

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const mouthAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const pulseRing1 = useRef(new Animated.Value(0)).current;
  const pulseRing2 = useRef(new Animated.Value(0)).current;
  const touchScale = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const gestureAnim = useRef(new Animated.Value(0)).current;

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
          duration: 110,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(mouthAnim, {
          toValue: 0.15,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(mouthAnim, {
          toValue: 0.85,
          duration: 130,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(mouthAnim, {
          toValue: 0.1,
          duration: 100,
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

  // 5. Hand Waving Loop (for greeting / home / celebrate)
  useEffect(() => {
    if (reduceMotion || (!isWavingState && state !== 'celebrate')) {
      waveAnim.setValue(0);
      return;
    }

    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 270,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 270,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    waveLoop.start();
    return () => waveLoop.stop();
  }, [state, isWavingState, reduceMotion]);

  // 6. Speaking Wing Gestures Loop (expressive talking body language)
  useEffect(() => {
    if (reduceMotion || state !== 'speaking') {
      gestureAnim.setValue(0);
      return;
    }

    const gestureLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(gestureAnim, {
          toValue: 1,
          duration: 340,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(gestureAnim, {
          toValue: -1,
          duration: 380,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    gestureLoop.start();
    return () => gestureLoop.stop();
  }, [state, reduceMotion]);

  // 7. Listening Soundwave Ripples
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

  const eyelidTranslateY = blinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-config.eyeSize, 0],
  });

  const ringScale1 = pulseRing1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity1 = pulseRing1.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.3, 0] });

  const ringScale2 = pulseRing2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity2 = pulseRing2.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.3, 0] });

  // Situational Wing Animations
  let leftWingRotate: any;
  let leftWingTranslateY: any = 0;
  let leftWingTranslateX: any = 0;

  if (isWavingState) {
    // Friendly cartoon wave oscillating side-to-side (Home screen greeting)
    leftWingRotate = waveAnim.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '-58deg'] });
    leftWingTranslateY = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [-config.container * 0.18, -config.container * 0.24] });
    leftWingTranslateX = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [-config.container * 0.02, -config.container * 0.05] });
  } else if (state === 'celebrate') {
    // Both wings raised high in victory cheer (\o/)
    leftWingRotate = waveAnim.interpolate({ inputRange: [0, 1], outputRange: ['-42deg', '-68deg'] });
    leftWingTranslateY = -config.container * 0.24;
    leftWingTranslateX = -config.container * 0.04;
  } else if (state === 'speaking') {
    // Conversational talking gesture in sync with speech
    leftWingRotate = gestureAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-14deg', '-28deg', '-42deg'] });
    leftWingTranslateY = gestureAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, -config.container * 0.06, -config.container * 0.12] });
  } else if (state === 'thinking') {
    // Pensive chin-touch pose
    leftWingRotate = '-54deg';
    leftWingTranslateY = -config.container * 0.12;
    leftWingTranslateX = config.container * 0.08;
  } else {
    // Idle & Listening: gentle breathing sway hugging left flank naturally (Duo Image 2 style)
    leftWingRotate = floatAnim.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '12deg'] });
  }

  let rightWingRotate: any;
  let rightWingTranslateY: any = 0;
  let rightWingTranslateX: any = 0;

  if (state === 'celebrate') {
    rightWingRotate = waveAnim.interpolate({ inputRange: [0, 1], outputRange: ['42deg', '68deg'] });
    rightWingTranslateY = -config.container * 0.24;
    rightWingTranslateX = config.container * 0.04;
  } else if (state === 'speaking') {
    // Alternating conversational gesture
    rightWingRotate = gestureAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['38deg', '24deg', '10deg'] });
    rightWingTranslateY = gestureAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-config.container * 0.12, -config.container * 0.06, 0] });
  } else {
    // Idle & Listening: resting naturally against right flank (hugging body curve - Duo Image 2 style)
    rightWingRotate = floatAnim.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '-12deg'] });
  }

  // Duo-Style Beak & Mouth Transforms
  const isMouthOpen = state === 'speaking' || isWavingState || state === 'celebrate';
  let mouthOpenScaleY: any = 1;
  let mouthOpenTranslateY: any = config.beakSize * 0.26;
  let mouthOpenOpacity: any = 1;
  let upperBeakTranslateY: any = 0;

  if (state === 'speaking') {
    // Talking: mouth rhythmically drops open and closed with natural syllable variations
    mouthOpenScaleY = mouthAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1.25] });
    mouthOpenTranslateY = mouthAnim.interpolate({ inputRange: [0, 1], outputRange: [-1, config.beakSize * 0.28] });
    mouthOpenOpacity = mouthAnim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] });
    upperBeakTranslateY = mouthAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });
  } else if (isWavingState || state === 'celebrate') {
    // Radiant open smile showing pink tongue
    mouthOpenScaleY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
    mouthOpenTranslateY = config.beakSize * 0.26;
    mouthOpenOpacity = 1;
    upperBeakTranslateY = -1;
  }

  const shadowScaleX = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.82],
  });
  const shadowOpacity = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 0.45],
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
        {/* Left Wing / Hand (Situational: Waving on home, talking gesture on call, cupping ear on listening, chin-touch on thinking) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.wingL,
              {
                width: config.container * 0.28,
                height: config.container * 0.46,
                borderTopLeftRadius: config.container * 0.18,
                borderTopRightRadius: config.container * 0.14,
                borderBottomLeftRadius: config.container * 0.12,
                borderBottomRightRadius: config.container * 0.14,
                left: -config.container * 0.04,
                top: config.container * 0.38,
                transform: [
                  { translateY: leftWingTranslateY },
                  { translateX: leftWingTranslateX },
                  { rotate: leftWingRotate },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#FF8A80', '#FF5252', '#D63031']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.wingInner,
                {
                  borderTopLeftRadius: config.container * 0.18,
                  borderTopRightRadius: config.container * 0.14,
                  borderBottomLeftRadius: config.container * 0.12,
                  borderBottomRightRadius: config.container * 0.14,
                },
              ]}
            />
          </Animated.View>
        )}

        {/* Right Wing / Hand (Situational: resting at side, or gesturing on speaking/celebrate) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.wingR,
              {
                width: config.container * 0.28,
                height: config.container * 0.46,
                borderTopRightRadius: config.container * 0.18,
                borderTopLeftRadius: config.container * 0.14,
                borderBottomRightRadius: config.container * 0.12,
                borderBottomLeftRadius: config.container * 0.14,
                right: -config.container * 0.04,
                top: config.container * 0.38,
                transform: [
                  { translateY: rightWingTranslateY },
                  { translateX: rightWingTranslateX },
                  { rotate: rightWingRotate },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#FF8A80', '#FF5252', '#D63031']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.wingInner,
                {
                  borderTopRightRadius: config.container * 0.18,
                  borderTopLeftRadius: config.container * 0.14,
                  borderBottomRightRadius: config.container * 0.12,
                  borderBottomLeftRadius: config.container * 0.14,
                },
              ]}
            />
          </Animated.View>
        )}

        <LinearGradient
          colors={['#FF7675', '#E17055']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.avatarBody,
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

            {/* Expressive Duo-style Beak & Mouth */}
            <View style={[styles.mouthContainer, { marginTop: -config.container * 0.02 }]}>
              {/* Smiling Open Mouth Cavity with Tongue (visible when talking, waving, celebrate - Duo Image 1 style) */}
              {isMouthOpen && (
                <Animated.View
                  style={[
                    styles.mouthOpenCavity,
                    {
                      top: config.beakSize * 0.32,
                      width: config.beakSize * 1.18,
                      height: config.beakSize * 0.95,
                      borderBottomLeftRadius: config.beakSize * 0.55,
                      borderBottomRightRadius: config.beakSize * 0.55,
                      transform: [
                        { scaleY: mouthOpenScaleY },
                        { translateY: mouthOpenTranslateY },
                      ],
                      opacity: mouthOpenOpacity,
                    },
                  ]}
                >
                  {/* Deep burgundy mouth throat interior */}
                  <View style={styles.mouthInterior}>
                    {/* Cute pink tongue */}
                    <View
                      style={[
                        styles.mouthTongue,
                        {
                          width: config.beakSize * 0.88,
                          height: config.beakSize * 0.55,
                          borderTopLeftRadius: config.beakSize * 0.3,
                          borderTopRightRadius: config.beakSize * 0.3,
                        },
                      ]}
                    />
                  </View>
                </Animated.View>
              )}

              {/* Upper Beak (Golden dome with specular highlight - Duo style) */}
              <Animated.View
                style={[
                  styles.upperBeak,
                  {
                    width: config.beakSize * 1.36,
                    height: config.beakSize * 0.84,
                    borderTopLeftRadius: config.beakSize * 0.45,
                    borderTopRightRadius: config.beakSize * 0.45,
                    borderBottomLeftRadius: config.beakSize * 0.3,
                    borderBottomRightRadius: config.beakSize * 0.3,
                    transform: [{ translateY: upperBeakTranslateY }],
                  },
                ]}
              >
                {/* Specular 3D Highlight on Upper Beak */}
                <View style={styles.beakHighlight} />
                {/* Lower beak lip contour */}
                <View style={styles.beakLip} />
              </Animated.View>
            </View>
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
  mouthContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 5,
  },
  mouthOpenCavity: {
    position: 'absolute',
    backgroundColor: '#7A0E12',
    borderWidth: 2,
    borderColor: '#FFA000',
    borderTopWidth: 0,
    overflow: 'hidden',
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mouthInterior: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#7A0E12',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mouthTongue: {
    backgroundColor: '#FF7675',
    borderWidth: 1,
    borderColor: '#FFAAAA',
    borderBottomWidth: 0,
    marginBottom: -1,
  },
  upperBeak: {
    backgroundColor: '#FFB300',
    borderWidth: 1.5,
    borderColor: '#E65100',
    borderBottomWidth: 2,
    borderBottomColor: '#D84315',
    zIndex: 3,
    overflow: 'hidden',
    shadowColor: '#E65100',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
    alignItems: 'center',
  },
  beakHighlight: {
    position: 'absolute',
    top: 1.5,
    left: '18%',
    right: '18%',
    height: 3.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  beakLip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#E65100',
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
  },
  wingR: {
    position: 'absolute',
    zIndex: 2,
    shadowColor: '#D63031',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
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
