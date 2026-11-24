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
  blinkOnly?: boolean;
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
  blinkOnly = false,
}: Props) {
  const reduceMotion = useReduceMotion();
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.m;
  const effectiveRadius = shape === 'circle' ? config.container / 2 : config.radius;
  const isStanding = standing !== undefined ? standing : (size === 'm' || size === 'l' || size === 'xl');
  const isAvatar = avatarMode ?? (!isStanding && (size === 'xs' || size === 's'));

  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const waveLiftAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const mouthAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;
  const bodyTiltAnim = useRef(new Animated.Value(0)).current;
  const leftWingAngleAnim = useRef(new Animated.Value(-6)).current;
  const rightWingAngleAnim = useRef(new Animated.Value(6)).current;
  const earWiggleAnim = useRef(new Animated.Value(0)).current;
  const lookAnimX = useRef(new Animated.Value(0)).current;
  const lookAnimY = useRef(new Animated.Value(0)).current;
  const bounceHopAnim = useRef(new Animated.Value(0)).current;
  const pulseRing1 = useRef(new Animated.Value(0)).current;
  const pulseRing2 = useRef(new Animated.Value(0)).current;
  const touchScale = useRef(new Animated.Value(1)).current;

  // 1. Idle Hover & Torso Breathing
  useEffect(() => {
    if (reduceMotion || isAvatar || blinkOnly) {
      floatAnim.setValue(0);
      return;
    }

    const hover = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: state === 'celebrate' ? 900 : (isStanding ? 2000 : 1600),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: state === 'celebrate' ? 900 : (isStanding ? 2000 : 1600),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    hover.start();
    return () => hover.stop();
  }, [state, isAvatar, isStanding, blinkOnly, reduceMotion]);

  // 2. Rich Expressive Mascot Animations (periodic wave, curious tilt, ear wiggle, wing flutter, pupil glance)
  useEffect(() => {
    if (reduceMotion || !isStanding || isAvatar || blinkOnly) {
      waveAnim.setValue(0);
      waveLiftAnim.setValue(0);
      leftWingAngleAnim.setValue(-6);
      rightWingAngleAnim.setValue(6);
      bodyTiltAnim.setValue(0);
      earWiggleAnim.setValue(0);
      lookAnimX.setValue(0);
      lookAnimY.setValue(0);
      bounceHopAnim.setValue(0);
      return;
    }

    let isMounted = true;
    let timer: any;

    if (state === 'celebrate') {
      // Gentle cheerful wave loop in celebration state (grounded, calm motion)
      const celebrateLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(leftWingAngleAnim, { toValue: 132, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(rightWingAngleAnim, { toValue: -20, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(waveLiftAnim, { toValue: 0.9, duration: 420, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(leftWingAngleAnim, { toValue: 112, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(rightWingAngleAnim, { toValue: -10, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(waveLiftAnim, { toValue: 0.75, duration: 380, useNativeDriver: true }),
          ]),
        ])
      );
      celebrateLoop.start();
      return () => celebrateLoop.stop();
    }

    let actionIndex = 0;
    const IDLE_ACTIONS = ['wave', 'curiousTilt', 'wingFlutter', 'glanceLook'] as const;

    const scheduleNext = (delayMs: number) => {
      timer = setTimeout(() => {
        if (!isMounted) return;
        const currentAction = IDLE_ACTIONS[actionIndex % IDLE_ACTIONS.length];
        actionIndex++;

        if (currentAction === 'wave') {
          // Action 1: Cheerful Hand Wave with animated motion arcs
          Animated.parallel([
            Animated.sequence([
              // Raise arm to greeting position
              Animated.timing(waveLiftAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
              Animated.delay(1150),
              // Lower arm back to side
              Animated.timing(waveLiftAnim, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.sequence([
              // Wave 1
              Animated.timing(leftWingAngleAnim, { toValue: 132, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(leftWingAngleAnim, { toValue: 112, duration: 190, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              // Wave 2
              Animated.timing(leftWingAngleAnim, { toValue: 136, duration: 190, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(leftWingAngleAnim, { toValue: 112, duration: 190, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              // Wave 3 & return to resting side
              Animated.timing(leftWingAngleAnim, { toValue: 132, duration: 190, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(leftWingAngleAnim, { toValue: -6, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(waveAnim, { toValue: 1, duration: 1850, easing: Easing.linear, useNativeDriver: true }),
              Animated.timing(waveAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(bodyTiltAnim, { toValue: 3.5, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.delay(1100),
              Animated.timing(bodyTiltAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
          ]).start(() => {
            if (!isMounted) return;
            scheduleNext(Math.random() * 2000 + 3500);
          });
        } else if (currentAction === 'curiousTilt') {
          // Action 2: Inquisitive Head Tilt, Ear Wiggle & Pupil Glance
          Animated.parallel([
            Animated.sequence([
              Animated.timing(bodyTiltAnim, { toValue: -5.5, duration: 350, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
              Animated.delay(1200),
              Animated.timing(bodyTiltAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.delay(150),
              Animated.timing(earWiggleAnim, { toValue: 1, duration: 110, useNativeDriver: true }),
              Animated.timing(earWiggleAnim, { toValue: -0.8, duration: 110, useNativeDriver: true }),
              Animated.timing(earWiggleAnim, { toValue: 0.6, duration: 110, useNativeDriver: true }),
              Animated.timing(earWiggleAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(lookAnimX, { toValue: 0.85, duration: 300, useNativeDriver: true }),
              Animated.delay(1200),
              Animated.timing(lookAnimX, { toValue: 0, duration: 350, useNativeDriver: true }),
            ]),
          ]).start(() => {
            if (!isMounted) return;
            scheduleNext(Math.random() * 2000 + 3500);
          });
        } else if (currentAction === 'wingFlutter') {
          // Action 3: Playful Double-Wing Flutter & Happy Micro-Hop
          Animated.parallel([
            Animated.sequence([
              Animated.timing(leftWingAngleAnim, { toValue: 26, duration: 150, useNativeDriver: true }),
              Animated.timing(leftWingAngleAnim, { toValue: -2, duration: 130, useNativeDriver: true }),
              Animated.timing(leftWingAngleAnim, { toValue: 24, duration: 140, useNativeDriver: true }),
              Animated.timing(leftWingAngleAnim, { toValue: -6, duration: 180, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(rightWingAngleAnim, { toValue: -26, duration: 150, useNativeDriver: true }),
              Animated.timing(rightWingAngleAnim, { toValue: 2, duration: 130, useNativeDriver: true }),
              Animated.timing(rightWingAngleAnim, { toValue: -24, duration: 140, useNativeDriver: true }),
              Animated.timing(rightWingAngleAnim, { toValue: 6, duration: 180, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(bounceHopAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(bounceHopAnim, { toValue: 0, duration: 300, easing: Easing.bounce, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(earWiggleAnim, { toValue: 0.8, duration: 130, useNativeDriver: true }),
              Animated.timing(earWiggleAnim, { toValue: -0.6, duration: 130, useNativeDriver: true }),
              Animated.timing(earWiggleAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            ]),
          ]).start(() => {
            if (!isMounted) return;
            scheduleNext(Math.random() * 2000 + 3500);
          });
        } else {
          // Action 4: Curious Glance Around with Eye Pupils & Natural Blink
          Animated.sequence([
            Animated.timing(lookAnimX, { toValue: -0.85, duration: 320, useNativeDriver: true }),
            Animated.delay(700),
            Animated.timing(lookAnimX, { toValue: 0.85, duration: 420, useNativeDriver: true }),
            Animated.delay(600),
            Animated.timing(blinkAnim, { toValue: 1, duration: 70, useNativeDriver: true }),
            Animated.timing(blinkAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
            Animated.timing(lookAnimX, { toValue: 0, duration: 320, useNativeDriver: true }),
          ]).start(() => {
            if (!isMounted) return;
            scheduleNext(Math.random() * 2000 + 3500);
          });
        }
      }, delayMs);
    };

    // First greeting wave starts at 1.2s, then cycles through varied actions
    scheduleNext(1200);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isStanding, isAvatar, blinkOnly, state, reduceMotion]);

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
    if (reduceMotion || state !== 'speaking' || blinkOnly) {
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
      Animated.spring(touchScale, { toValue: 1.08, friction: 3, useNativeDriver: true }),
      Animated.spring(touchScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    // Joyful celebration combo on tap!
    if (isStanding && !isAvatar && state !== 'celebrate') {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(leftWingAngleAnim, { toValue: 28, duration: 140, useNativeDriver: true }),
          Animated.timing(leftWingAngleAnim, { toValue: -2, duration: 120, useNativeDriver: true }),
          Animated.timing(leftWingAngleAnim, { toValue: 24, duration: 130, useNativeDriver: true }),
          Animated.timing(leftWingAngleAnim, { toValue: -6, duration: 160, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rightWingAngleAnim, { toValue: -28, duration: 140, useNativeDriver: true }),
          Animated.timing(rightWingAngleAnim, { toValue: 2, duration: 120, useNativeDriver: true }),
          Animated.timing(rightWingAngleAnim, { toValue: -24, duration: 130, useNativeDriver: true }),
          Animated.timing(rightWingAngleAnim, { toValue: 6, duration: 160, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(bounceHopAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(bounceHopAnim, { toValue: 0, duration: 280, easing: Easing.bounce, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(earWiggleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(earWiggleAnim, { toValue: -0.8, duration: 100, useNativeDriver: true }),
          Animated.timing(earWiggleAnim, { toValue: 0.6, duration: 100, useNativeDriver: true }),
          Animated.timing(earWiggleAnim, { toValue: 0, duration: 110, useNativeDriver: true }),
        ]),
      ]).start();
    }

    onPress?.();
  };

  // Interpolated Transforms
  // When standing idle, translateY is 0 so feet stay firmly anchored on the floor!
  const isStandingAndIdle = isStanding && state !== 'celebrate';

  const hopTranslateY = bounceHopAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const translateY = isAvatar || blinkOnly
    ? 0
    : isStandingAndIdle
    ? hopTranslateY
    : floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, state === 'celebrate' ? -4 : -6],
      });

  // Torso subtle breathing scale (standing character breathes naturally without jumping off floor)
  const torsoScaleY = isStandingAndIdle && !isAvatar && !blinkOnly
    ? floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.022],
      })
    : 1;

  const torsoScaleX = isStandingAndIdle && !isAvatar && !blinkOnly
    ? floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.988],
      })
    : 1;

  const rotate = isAvatar || blinkOnly
    ? '0deg'
    : state === 'thinking'
    ? tiltAnim.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-8deg', '0deg', '8deg'],
      })
    : isStanding
    ? bodyTiltAnim.interpolate({
        inputRange: [-10, 0, 10],
        outputRange: ['-10deg', '0deg', '10deg'],
      })
    : '0deg';

  const mouthScaleY = mouthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });

  const eyelidTranslateY = blinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-config.eyeSize, 0],
  });

  const pupilTranslateX = lookAnimX.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-config.eyeSize * 0.14, 0, config.eyeSize * 0.14],
  });

  const pupilTranslateY = lookAnimY.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-config.eyeSize * 0.10, 0, config.eyeSize * 0.10],
  });

  const earLRotate = earWiggleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-14deg', '-22deg', '-34deg'],
  });

  const earRRotate = earWiggleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['14deg', '22deg', '34deg'],
  });

  const ringScale1 = pulseRing1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity1 = pulseRing1.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.3, 0] });

  const ringScale2 = pulseRing2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity2 = pulseRing2.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.3, 0] });

  // Left wing rotation: hugs flank at rest (-6deg), flutters or waves
  const leftWingRotate = leftWingAngleAnim.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  // Right wing rotation: hugs flank at rest (6deg), flutters
  const rightWingRotate = rightWingAngleAnim.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  // Left wing shoulder translation during wave
  const leftWingTranslateX = waveLiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -config.container * 0.04],
  });
  const leftWingTranslateY = waveLiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -config.container * 0.10],
  });

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

        {/* Left Wing / Hand - Attached flush with torso (ZERO gap) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.wingL,
              {
                width: config.container * 0.22,
                height: config.container * 0.40,
                borderRadius: config.container * 0.11,
                left: -config.container * 0.08,
                top: config.container * 0.38,
                transform: [
                  { translateX: leftWingTranslateX },
                  { translateY: leftWingTranslateY },
                  { rotate: leftWingRotate },
                ],
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

        {/* Right Wing / Hand - Attached flush with torso (ZERO gap) */}
        {isStanding && (
          <Animated.View
            style={[
              styles.wingR,
              {
                width: config.container * 0.22,
                height: config.container * 0.38,
                borderRadius: config.container * 0.11,
                right: -config.container * 0.08,
                top: config.container * 0.40,
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

          {/* Cute Tuft / Ear Accent with animated twitch */}
          <Animated.View
            style={[
              styles.earAccentL,
              {
                width: config.container * 0.12,
                height: config.container * 0.16,
                borderRadius: config.container * 0.08,
                top: -config.container * 0.07,
                left: shape === 'circle' ? '22%' : '18%',
                transform: [{ rotate: earLRotate }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.earAccentR,
              {
                width: config.container * 0.12,
                height: config.container * 0.16,
                borderRadius: config.container * 0.08,
                top: -config.container * 0.07,
                right: shape === 'circle' ? '22%' : '18%',
                transform: [{ rotate: earRRotate }],
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
                {/* Pupil & Specular Sparkle with animated gaze */}
                <Animated.View
                  style={[
                    styles.eyePupil,
                    {
                      transform: [
                        { translateX: pupilTranslateX },
                        { translateY: pupilTranslateY },
                      ],
                    },
                  ]}
                >
                  <View style={styles.eyeSparkle} />
                  <View style={styles.eyeSparkleSub} />
                </Animated.View>

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
                <Animated.View
                  style={[
                    styles.eyePupil,
                    {
                      transform: [
                        { translateX: pupilTranslateX },
                        { translateY: pupilTranslateY },
                      ],
                    },
                  ]}
                >
                  <View style={styles.eyeSparkle} />
                  <View style={styles.eyeSparkleSub} />
                </Animated.View>

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

            {/* Beak / Talking Mouth - tucked cleanly below eyes */}
            <Animated.View
              style={[
                styles.beak,
                {
                  width: config.container * 0.18,
                  height: isAvatar ? config.container * 0.105 : config.container * 0.09,
                  borderRadius: config.container * 0.05,
                  marginTop: isAvatar ? -config.eyeSize * 0.12 : -config.eyeSize * 0.16,
                  borderWidth: Math.max(1, config.container * 0.015),
                  transform: [{ scaleY: blinkOnly ? 1 : state === 'celebrate' ? 1.15 : mouthScaleY }],
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
    zIndex: 0,
  },
  earAccentR: {
    position: 'absolute',
    backgroundColor: '#B85338',
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
  },
  wingR: {
    position: 'absolute',
    zIndex: 0,
    elevation: 0,
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
