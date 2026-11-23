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
  xs: { container: 36, radius: 12, eyeSize: 10, beakSize: 6 },
  s: { container: 44, radius: 15, eyeSize: 12.5, beakSize: 7.5 },
  m: { container: 80, radius: 26, eyeSize: 22, beakSize: 13 },
  l: { container: 130, radius: 42, eyeSize: 35, beakSize: 20 },
  xl: { container: 170, radius: 54, eyeSize: 46, beakSize: 26 },
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

  // 1. Idle Hover & Torso Breathing
  useEffect(() => {
    if (reduceMotion || isAvatar) {
      floatAnim.setValue(0);
      return;
    }

    const hover = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: state === 'celebrate' ? 300 : (isStanding ? 2000 : 1600),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: state === 'celebrate' ? 300 : (isStanding ? 2000 : 1600),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    hover.start();
    return () => hover.stop();
  }, [state, isAvatar, isStanding, reduceMotion]);

  // 2. Hand Waving for standing mascot: waves periodically every 5-7 seconds, then rests down at side
  useEffect(() => {
    if (reduceMotion || !isStanding || isAvatar) {
      waveAnim.setValue(0);
      return;
    }

    let isMounted = true;
    let timer: any;

    if (state === 'celebrate') {
      // Joyful fast waving loop in celebration state
      const celebrateLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 0.54, duration: 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 0.85, duration: 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      celebrateLoop.start();
      return () => celebrateLoop.stop();
    }

    const scheduleWave = (delayMs: number) => {
      timer = setTimeout(() => {
        if (!isMounted) return;

        // Wave Cycle (1.75s total):
        // 0 -> 0.20: Arm raises up to greeting position
        // 0.20 -> 0.38: Wave in
        // 0.38 -> 0.54: Wave out
        // 0.54 -> 0.70: Wave in
        // 0.70 -> 0.85: Wave out
        // 0.85 -> 1.00: Arm lowers smoothly back to resting side
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1750,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => {
          if (!isMounted) return;
          waveAnim.setValue(0); // Sits at 0 (arm completely at side) during idle rest

          // Schedule next wave after 5 to 7 seconds
          const nextDelay = Math.random() * 2000 + 5000;
          scheduleWave(nextDelay);
        });
      }, delayMs);
    };

    // Initial greeting wave after 1.5 seconds, then every 5-7 seconds
    scheduleWave(1500);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
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
      Animated.spring(touchScale, { toValue: 0.90, friction: 4, useNativeDriver: true }),
      Animated.spring(touchScale, { toValue: 1.05, friction: 3, useNativeDriver: true }),
      Animated.spring(touchScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    // Trigger immediate joyful greeting wave on tap!
    if (isStanding && !isAvatar && state !== 'celebrate') {
      waveAnim.setValue(0);
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 1750,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        waveAnim.setValue(0);
      });
    }

    onPress?.();
  };

  // Interpolated Transforms
  // When standing idle, translateY is 0 so feet stay firmly anchored on the floor!
  const isStandingAndIdle = isStanding && state !== 'celebrate';

  const translateY = isAvatar || isStandingAndIdle
    ? 0
    : floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, state === 'celebrate' ? -12 : -6],
      });

  // Torso subtle breathing scale (standing character breathes naturally without jumping off floor)
  const torsoScaleY = isStandingAndIdle && !isAvatar
    ? floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.022],
      })
    : 1;

  const torsoScaleX = isStandingAndIdle && !isAvatar
    ? floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.988],
      })
    : 1;

  // Gentle wave body tilt
  const waveBodyTilt = waveAnim.interpolate({
    inputRange: [0, 0.20, 0.85, 1],
    outputRange: ['0deg', '3.5deg', '3.5deg', '0deg'],
  });

  const rotate = isAvatar
    ? '0deg'
    : state === 'thinking'
    ? tiltAnim.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-8deg', '0deg', '8deg'],
      })
    : isStanding
    ? waveBodyTilt
    : '0deg';

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

  // Left wing (Viewer's left = Mascot's right): Waving Hand (matching video example)
  // At rest (0): hangs down naturally alongside left body flank (18deg)
  // During wave (0.2 -> 0.85): raises and waves hello
  // At 1.0: lowers smoothly back to resting side (18deg)
  const leftWingRotate = isStanding
    ? (state === 'celebrate'
        ? waveAnim.interpolate({
            inputRange: [0, 0.54, 0.85, 1],
            outputRange: ['18deg', '120deg', '155deg', '18deg'],
          })
        : waveAnim.interpolate({
            inputRange: [0, 0.20, 0.38, 0.54, 0.70, 0.85, 1],
            outputRange: ['18deg', '138deg', '118deg', '142deg', '118deg', '142deg', '18deg'],
          }))
    : '-12deg';

  // Right wing (Viewer's right = Mascot's left): Resting Hand (matching video example)
  // Rests naturally downwards along the right side of the body
  const rightWingRotate = isStanding
    ? (state === 'celebrate'
        ? waveAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['-18deg', '-55deg'],
          })
        : '-18deg')
    : '12deg';

  // Waving motion arcs: ONLY visible when arm is raised and actively waving!
  const waveArcsOpacity = waveAnim.interpolate({
    inputRange: [0, 0.18, 0.24, 0.82, 0.88, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });
  const waveArcsScale = waveAnim.interpolate({
    inputRange: [0, 0.2, 0.5, 0.85, 1],
    outputRange: [0.8, 1.0, 1.1, 1.0, 0.8],
  });

  const shadowScaleX = isStandingAndIdle
    ? 1
    : floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.88],
      });
  const shadowOpacity = isStandingAndIdle
    ? 0.9
    : floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.9, 0.6],
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
            { scaleY: torsoScaleY },
            { scaleX: torsoScaleX },
          ],
        }}
      >
        {/* Cartoon Waving Motion Arcs (Matching user reference) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.waveArcsContainer,
              {
                left: -config.container * 0.42,
                top: config.container * 0.08,
                opacity: waveArcsOpacity,
                transform: [{ scale: waveArcsScale }],
              },
            ]}
            pointerEvents="none"
          >
            {/* Upper Arc */}
            <View
              style={[
                styles.waveArcLine,
                {
                  width: config.container * 0.14,
                  height: config.container * 0.16,
                  borderRadius: config.container * 0.10,
                  borderLeftWidth: Math.max(2, config.container * 0.024),
                  borderTopWidth: Math.max(1.5, config.container * 0.018),
                  top: 0,
                  left: config.container * 0.05,
                },
              ]}
            />
            {/* Middle Main Arc */}
            <View
              style={[
                styles.waveArcLine,
                {
                  width: config.container * 0.18,
                  height: config.container * 0.22,
                  borderRadius: config.container * 0.13,
                  borderLeftWidth: Math.max(2.2, config.container * 0.028),
                  borderTopWidth: Math.max(1.5, config.container * 0.02),
                  top: config.container * 0.08,
                  left: 0,
                },
              ]}
            />
            {/* Lower Arc */}
            <View
              style={[
                styles.waveArcLine,
                {
                  width: config.container * 0.13,
                  height: config.container * 0.16,
                  borderRadius: config.container * 0.09,
                  borderLeftWidth: Math.max(2, config.container * 0.024),
                  borderTopWidth: Math.max(1.2, config.container * 0.016),
                  top: config.container * 0.18,
                  left: config.container * 0.04,
                },
              ]}
            />
          </Animated.View>
        )}

        {/* Left Wing / Hand - Waving Hand (Viewer's left = Mascot's right hand) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.wingL,
              {
                width: config.container * 0.22,
                height: config.container * 0.42,
                borderRadius: config.container * 0.11,
                left: -config.container * 0.18,
                top: config.container * 0.40,
                transform: [{ rotate: leftWingRotate }],
              },
            ]}
          >
            <LinearGradient
              colors={['#FF7675', '#E17055']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.wingInner, { borderRadius: config.container * 0.11 }]}
            />
          </Animated.View>
        )}

        {/* Right Wing / Hand - Resting Hand (Viewer's right = Mascot's left hand) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.wingR,
              {
                width: config.container * 0.22,
                height: config.container * 0.40,
                borderRadius: config.container * 0.11,
                right: -config.container * 0.14,
                top: config.container * 0.42,
                transform: [{ rotate: rightWingRotate }],
              },
            ]}
          >
            <LinearGradient
              colors={['#FF7675', '#E17055']}
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
          <View
            style={[
              styles.avatarSheen,
              {
                borderTopLeftRadius: Math.max(0, effectiveRadius - 1),
                borderTopRightRadius: Math.max(0, effectiveRadius - 1),
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              },
            ]}
          />

          {/* Cute Tuft / Ear Accent */}
          <View
            style={[
              styles.earAccentL,
              {
                width: config.container * 0.12,
                height: config.container * 0.16,
                borderRadius: config.container * 0.08,
                top: -config.container * 0.07,
                left: shape === 'circle' ? '22%' : '18%',
              },
            ]}
          />
          <View
            style={[
              styles.earAccentR,
              {
                width: config.container * 0.12,
                height: config.container * 0.16,
                borderRadius: config.container * 0.08,
                top: -config.container * 0.07,
                right: shape === 'circle' ? '22%' : '18%',
              },
            ]}
          />

          {/* Facial Features Container */}
          <View style={[styles.faceContainer, { paddingTop: isAvatar ? 0 : '3%' }]}>
            {/* Rosy Cheeks - behind eyes so eye orbs remain bright pure white */}
            <View
              style={[
                styles.cheeksRow,
                {
                  width: '84%',
                  top: config.eyeSize * 0.38,
                },
              ]}
            >
              <View
                style={[
                  styles.cheek,
                  {
                    width: config.eyeSize * 0.50,
                    height: config.eyeSize * 0.28,
                    borderRadius: config.eyeSize * 0.25,
                  },
                ]}
              />
              <View
                style={[
                  styles.cheek,
                  {
                    width: config.eyeSize * 0.50,
                    height: config.eyeSize * 0.28,
                    borderRadius: config.eyeSize * 0.25,
                  },
                ]}
              />
            </View>

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
                  <View style={styles.eyeSparkleSub} />
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
                  <View style={styles.eyeSparkleSub} />
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

            {/* Beak / Talking Mouth - tucked between bottom of eyes */}
            <Animated.View
              style={[
                styles.beak,
                {
                  width: config.container * 0.18,
                  height: config.container * 0.09,
                  borderRadius: config.container * 0.045,
                  marginTop: -config.eyeSize * 0.20,
                  borderWidth: Math.max(1, config.container * 0.015),
                  transform: [{ scaleY: state === 'celebrate' ? 1.4 : mouthScaleY }],
                },
              ]}
            >
              <View style={styles.beakHighlight} />
            </Animated.View>
          </View>

          {/* Cute Belly Patch with feather marks (matching video example) */}
          {!isAvatar && isStanding && (
            <View
              style={[
                styles.bellyPatch,
                {
                  width: config.container * 0.58,
                  height: config.container * 0.33,
                  borderRadius: config.container * 0.29,
                  bottom: config.container * 0.04,
                },
              ]}
              pointerEvents="none"
            >
              <View style={styles.scallopRow}>
                <View style={[styles.featherScallop, { width: config.container * 0.085, height: config.container * 0.045 }]} />
                <View style={[styles.featherScallop, { width: config.container * 0.085, height: config.container * 0.045 }]} />
                <View style={[styles.featherScallop, { width: config.container * 0.085, height: config.container * 0.045 }]} />
              </View>
              <View style={[styles.scallopRow, { marginTop: 2 }]}>
                <View style={[styles.featherScallop, { width: config.container * 0.085, height: config.container * 0.045 }]} />
                <View style={[styles.featherScallop, { width: config.container * 0.085, height: config.container * 0.045 }]} />
              </View>
            </View>
          )}

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

        {/* Cute 3-Toed Chick/Owl Feet (grounded, matching video example) */}
        {isStanding && (
          <View style={styles.feetRow} pointerEvents="none">
            {/* Left Foot (Viewer's left) */}
            <View
              style={[
                styles.threeToedFoot,
                {
                  left: config.container * 0.17,
                  bottom: -config.container * 0.05,
                },
              ]}
            >
              <View
                style={[
                  styles.toeBump,
                  {
                    width: config.container * 0.08,
                    height: config.container * 0.078,
                  },
                ]}
              />
              <View
                style={[
                  styles.toeBump,
                  styles.toeBumpMid,
                  {
                    width: config.container * 0.092,
                    height: config.container * 0.090,
                  },
                ]}
              />
              <View
                style={[
                  styles.toeBump,
                  {
                    width: config.container * 0.08,
                    height: config.container * 0.078,
                  },
                ]}
              />
            </View>

            {/* Right Foot (Viewer's right) */}
            <View
              style={[
                styles.threeToedFoot,
                {
                  right: config.container * 0.17,
                  bottom: -config.container * 0.05,
                },
              ]}
            >
              <View
                style={[
                  styles.toeBump,
                  {
                    width: config.container * 0.08,
                    height: config.container * 0.078,
                  },
                ]}
              />
              <View
                style={[
                  styles.toeBump,
                  styles.toeBumpMid,
                  {
                    width: config.container * 0.092,
                    height: config.container * 0.090,
                  },
                ]}
              />
              <View
                style={[
                  styles.toeBump,
                  {
                    width: config.container * 0.08,
                    height: config.container * 0.078,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </Animated.View>

      {/* Ground Floor Contact Shadow underneath standing character (flush against toes) */}
      {isStanding && (
        <Animated.View
          style={[
            styles.groundShadow,
            {
              width: config.container * 0.78,
              height: Math.max(7, config.container * 0.085),
              borderRadius: config.container * 0.39,
              marginTop: -config.container * 0.035,
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
    zIndex: 1,
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
    backgroundColor: '#FF7675',
    transform: [{ rotate: '-22deg' }],
    zIndex: 0,
  },
  earAccentR: {
    position: 'absolute',
    backgroundColor: '#B85338',
    transform: [{ rotate: '22deg' }],
    zIndex: 0,
  },
  faceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  eyesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '62%',
    alignItems: 'center',
    zIndex: 2,
  },
  eyeOrb: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  eyePupil: {
    width: '68%',
    height: '68%',
    borderRadius: 100,
    backgroundColor: '#1E272E',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: '10%',
    paddingRight: '10%',
  },
  eyeSparkle: {
    width: '40%',
    height: '40%',
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
  },
  eyelid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF6B6B',
    borderBottomWidth: 2.5,
    borderBottomColor: '#E65555',
    zIndex: 5,
  },
  cheeksRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  cheek: {
    backgroundColor: 'rgba(255, 118, 117, 0.35)',
  },
  beak: {
    backgroundColor: '#FDCB6E',
    borderColor: '#E17055',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  beakHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(255, 255, 255, 0.40)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
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
    zIndex: 0,
    elevation: 0,
    transformOrigin: 'top right' as any,
  },
  wingR: {
    position: 'absolute',
    zIndex: 0,
    elevation: 0,
    transformOrigin: 'top left' as any,
  },
  wingInner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  waveArcsContainer: {
    position: 'absolute',
    zIndex: 3,
  },
  waveArcLine: {
    position: 'absolute',
    borderColor: '#FF7675',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-32deg' }],
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
  feetRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 2,
    elevation: 3,
  },
  threeToedFoot: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 2,
  },
  eyeSparkleSub: {
    position: 'absolute',
    bottom: '12%',
    left: '14%',
    width: '22%',
    height: '22%',
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  toeBump: {
    backgroundColor: '#FFB800',
    borderWidth: 1.4,
    borderColor: '#E69500',
    borderBottomWidth: 2.4,
    borderBottomColor: '#CC7A00',
    borderRadius: 999,
    marginHorizontal: -1,
  },
  toeBumpMid: {
    backgroundColor: '#FFC81A',
    zIndex: 3,
  },
  bellyPatch: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#FFE3E8',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    zIndex: 1,
  },
  scallopRow: {
    flexDirection: 'row',
    gap: 4,
  },
  featherScallop: {
    borderBottomWidth: 1.8,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderTopWidth: 0,
    borderColor: '#FF9EAF',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  groundShadow: {
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    alignSelf: 'center',
  },
});
