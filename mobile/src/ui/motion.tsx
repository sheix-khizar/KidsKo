import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AccessibilityInfo,
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Easing,
} from 'react-native';
import { colors } from '../theme';

/**
 * 6.1 Hook to detect if the OS requests reduced motion.
 * Respects user accessibility preferences; falls back to static rendering.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        if (mounted) setReduceMotion(enabled);
      }
    );

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return reduceMotion;
}

/**
 * 6.2 Bounce: Gentle 3s ease in-out loop (up 12px, rotate ±3°).
 * Matches prototype owl mascot motion.
 */
export function Bounce({
  children,
  style,
  disabled = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || disabled) {
      anim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [reduceMotion, disabled]);

  if (reduceMotion || disabled) {
    return <View style={style}>{children}</View>;
  }

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const rotate = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '3deg', '-3deg'],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }, { rotate }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * 6.2 Pulse: Scale and opacity loop (plain: 1.5s, orb: 3s, ring: 2s).
 */
export function Pulse({
  children,
  variant = 'plain',
  style,
}: {
  children?: React.ReactNode;
  variant?: 'plain' | 'orb' | 'ring';
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(0);
      return;
    }

    const duration = variant === 'plain' ? 750 : variant === 'orb' ? 1500 : 1000;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [reduceMotion, variant]);

  if (reduceMotion) {
    return <View style={style}>{children}</View>;
  }

  let scale: Animated.AnimatedInterpolation<number>;
  let opacity: Animated.AnimatedInterpolation<number> | undefined;

  if (variant === 'orb') {
    scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.2],
    });
    opacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 0.4],
    });
  } else if (variant === 'ring') {
    scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.06],
    });
    opacity = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1],
    });
  } else {
    scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.08],
    });
  }

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale }],
          ...(opacity ? { opacity } : {}),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * 6.2 FloatStar: Alternating float (up 8px, rotate 15°) over 2.5s.
 */
export function FloatStar({
  children,
  style,
  delay = 0,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(0);
      return;
    }

    const timer = setTimeout(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 1250,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 1250,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    }, delay);

    return () => clearTimeout(timer);
  }, [reduceMotion, delay]);

  if (reduceMotion) {
    return <View style={style}>{children}</View>;
  }

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '15deg'],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }, { rotate }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * 6.3 FadeSlideIn: Once opacity 0 -> 1 and 10px up with optional delay.
 */
export function FadeSlideIn({
  children,
  style,
  delay = 0,
  duration = 320,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 10)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [reduceMotion, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * 6.3 ScreenCrossFade: 220ms cross-fade wrapper for switching views.
 */
export function ScreenCrossFade({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }

    opacity.setValue(0);
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();

    return () => anim.stop();
  }, [children, reduceMotion]);

  return <Animated.View style={[{ flex: 1, opacity }, style]}>{children}</Animated.View>;
}

/**
 * 6.4 TypingDots: Three dots hopping 5px, staggered by 140ms.
 */
export function TypingDots({
  color = colors.coralStrong,
  size = 7,
  style,
}: {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;

    const createHop = (anim: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 260,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 260,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.delay(300),
          ])
        ),
      ]);
    };

    const anim1 = createHop(dot1, 0);
    const anim2 = createHop(dot2, 140);
    const anim3 = createHop(dot3, 280);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [reduceMotion]);

  const dotStyle = (anim: Animated.Value) => {
    const translateY = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -6],
    });
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      transform: [{ translateY }],
    };
  };

  return (
    <View style={[styles.typingDotsRow, style]}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

/**
 * 6.4 WaveBars: In-call audio activity bars oscillating scaleY (1 -> 0.25).
 */
export function WaveBars({
  count = 4,
  color = '#FFE66D',
  active = true,
  style,
}: {
  count?: number;
  color?: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (reduceMotion || !active) {
      anims.forEach((a) => a.setValue(0.3));
      return;
    }

    const loops = anims.map((anim, index) => {
      const delay = index * 120;
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 280 + index * 40,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.25,
              duration: 280 + index * 40,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        ),
      ]);
    });

    loops.forEach((l) => l.start());

    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, active, count]);

  return (
    <View style={[styles.waveBarsRow, style]}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              backgroundColor: color,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * 6.4 LoadBar: Horizontal loading bar scaling scaleX 0 -> 1 from the left edge.
 */
export function LoadBar({
  duration = 1200,
  color = colors.coralStrong,
  height = 5,
  style,
  onComplete,
}: {
  duration?: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onComplete?: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      onComplete?.();
      return;
    }

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });

    anim.start(({ finished }) => {
      if (finished && onComplete) onComplete();
    });

    return () => anim.stop();
  }, [reduceMotion, duration]);

  // Using translateX shift alongside scaleX to pin the scale to the left edge
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });

  return (
    <View style={[styles.loadBarTrack, { height }, style]}>
      <Animated.View
        style={[
          styles.loadBarFill,
          {
            backgroundColor: color,
            transform: [
              { scaleX: progress },
              { translateX },
            ],
          },
        ]}
      />
    </View>
  );
}

/**
 * 6.4 LiveDot: Smooth loop opacity 1 -> 0.3 for live video and in-call states.
 */
export function LiveDot({
  color = '#00B894',
  size = 8,
  style,
}: {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.25,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: anim,
        },
        style,
      ]}
    />
  );
}

/**
 * 6.5 PressScale: Tactile depression (scale 0.97) with spring return on press.
 */
export function PressScale({
  children,
  onPress,
  scale = 0.97,
  style,
  disabled = false,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  scale?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityRole?: any;
  accessibilityLabel?: string;
  accessibilityState?: any;
}) {
  const reduceMotion = useReduceMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (reduceMotion || disabled) return;
    Animated.spring(scaleAnim, {
      toValue: scale,
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion || disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={[style, { transform: [{ scale: scaleAnim }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    height: 16,
  },
  waveBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveBar: {
    width: 3.5,
    height: 20,
    borderRadius: 2,
  },
  loadBarTrack: {
    width: '100%',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  loadBarFill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
  },
});
