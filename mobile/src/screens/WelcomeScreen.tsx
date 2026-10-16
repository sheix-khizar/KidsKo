import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Mascot,
  Button,
  LinearGradient,
  Bounce,
  FloatStar,
  PressScale,
  useSafeAreaInsets,
} from '../ui';
import { colors, fontFamilies, gradients } from '../theme';

type Props = {
  onStartLearning: () => void;
  onGoToLogin: () => void;
};

export default function WelcomeScreen({ onStartLearning, onGoToLogin }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={gradients.splash.colors}
        start={gradients.splash.start}
        end={gradients.splash.end}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative soft corner circles (no blur per Section 5 spec) */}
      <View style={styles.topRightCircle} pointerEvents="none" />
      <View style={styles.bottomLeftCircle} pointerEvents="none" />

      {/* Floating stars */}
      <FloatStar delay={0} style={styles.starTopLeft}>
        <Text style={styles.starEmoji}>✨</Text>
      </FloatStar>
      <FloatStar delay={400} style={styles.starTopRight}>
        <Text style={styles.starEmoji}>🌟</Text>
      </FloatStar>
      <FloatStar delay={800} style={styles.starMidRight}>
        <Text style={styles.starEmoji}>⭐</Text>
      </FloatStar>

      {/* Center content */}
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 32,
            paddingBottom: Math.max(insets.bottom, 28),
          },
        ]}
      >
        <View style={styles.centerSection}>
          <Bounce>
            <Mascot size="l" />
          </Bounce>
          <Text style={styles.title}>
            Kidsko<Text style={styles.titleAi}>.ai</Text>
          </Text>
          <Text style={styles.tagline}>
            {'Your friendly AI teacher! 🎓\nAsk me anything, anytime!'}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsSection}>
          <PressScale style={styles.buttonScale} onPress={onStartLearning}>
            <Button
              title="🚀 Let's Start Learning!"
              onPress={onStartLearning}
              variant="primary"
            />
          </PressScale>
          <PressScale style={[styles.buttonScale, { marginTop: 14 }]} onPress={onGoToLogin}>
            <Button
              title="I already have an account"
              onPress={onGoToLogin}
              variant="ghost"
            />
          </PressScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topRightCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  bottomLeftCircle: {
    position: 'absolute',
    bottom: 120,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
  },
  starTopLeft: {
    position: 'absolute',
    top: 96,
    left: 28,
    zIndex: 2,
    opacity: 0.8,
  },
  starTopRight: {
    position: 'absolute',
    top: 86,
    right: 44,
    zIndex: 2,
    opacity: 0.8,
  },
  starMidRight: {
    position: 'absolute',
    top: 144,
    right: 24,
    zIndex: 2,
    opacity: 0.8,
  },
  starEmoji: {
    fontSize: 26,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 3,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 42,
    fontFamily: fontFamilies.black,
    color: colors.text,
    letterSpacing: -1,
    lineHeight: 48,
    marginTop: 20,
  },
  titleAi: {
    color: colors.coral,
  },
  tagline: {
    fontSize: 15,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 10,
  },
  actionsSection: {
    width: '100%',
    paddingBottom: 8,
  },
  buttonScale: {
    width: '100%',
  },
});
