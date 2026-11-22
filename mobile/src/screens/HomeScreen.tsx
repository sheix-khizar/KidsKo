import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from '../ui/safeArea';
import { colors, radii, typography, fontFamilies, shadows, gradients } from '../theme';
import { AskieCompanion } from '../ui/AskieCompanion';
import { AskieEmoji } from '../ui/AskieEmoji';
import { triggerAskieReaction } from '../ui/AskieReactions';
import { FadeSlideIn, PressScale, Bounce } from '../ui/motion';
import { Student } from './MainShellScreen';

type HomeScreenProps = {
  student: Student;
  onStartVoice: () => void;
  onStartCamera: () => void;
  onSelectTopic: (prompt: string) => void;
  onOpenProfile?: () => void;
};

const HERO_MESSAGES = [
  'Ready to learn, {name}? 🎉',
  'Ask me anything in the world! ✨',
  'Tap me, I love saying hello! 🤸',
  'What cool thing shall we explore? 🚀',
  'You are doing awesome today! ⭐',
];

const TOPICS = [
  {
    key: 'science',
    icon: '🔬',
    title: 'Science',
    desc: 'Why do plants need sun?',
    prompt: 'Why do plants need sunlight?',
    bg: '#FFE8E8',
    border: '#FFA8A8',
  },
  {
    key: 'maths',
    icon: '🔢',
    title: 'Maths',
    desc: 'What is a fraction?',
    prompt: 'Can you explain what a fraction is?',
    bg: '#FFF1DC',
    border: '#FFD08A',
  },
  {
    key: 'animals',
    icon: '🦁',
    title: 'Animals',
    desc: 'Who sleeps the most?',
    prompt: 'Which animal sleeps the most?',
    bg: '#E6F8EA',
    border: '#A8E6B8',
  },
  {
    key: 'space',
    icon: '🚀',
    title: 'Space',
    desc: 'Why does Moon change?',
    prompt: 'Why does the Moon change shape?',
    bg: '#EEE8FF',
    border: '#C9B8FF',
  },
];

export default function HomeScreen({
  student,
  onStartVoice,
  onStartCamera,
  onSelectTopic,
  onOpenProfile,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const firstName = student.student_name ? student.student_name.split(' ')[0] : 'Learner';

  // Gamification state (kid-friendly progression)
  const [streak] = useState(7);
  const [stars, setStars] = useState(120);
  const [goalQuestions, setGoalQuestions] = useState(3);
  const goalTotal = 5;

  // Hero greeting speech bubble rotation
  const [msgIdx, setMsgIdx] = useState(0);
  const bubbleScale = useRef(new Animated.Value(1)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;

  // Pulse animation on the Talk button
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1.025,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ctaPulse]);

  // Rotate hero messages every 6.5s
  useEffect(() => {
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(bubbleScale, {
          toValue: 0.85,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleScale, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start();
      setMsgIdx((prev) => (prev + 1) % HERO_MESSAGES.length);
    }, 6500);

    return () => clearInterval(timer);
  }, [bubbleScale]);

  const handleMascotTap = () => {
    triggerAskieReaction('⭐');
    setStars((s) => s + 5);
    Animated.sequence([
      Animated.timing(bubbleScale, { toValue: 1.15, duration: 120, useNativeDriver: true }),
      Animated.timing(bubbleScale, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const currentMsg = HERO_MESSAGES[msgIdx].replace('{name}', firstName);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* ── Top Gamified Stats Bar ── */}
      <FadeSlideIn delay={0}>
        <View style={styles.statsBar}>
          {/* Day Streak Pill */}
          <View style={styles.streakPill}>
            <Text style={styles.streakFlame}>🔥</Text>
            <Text style={styles.streakCount}>{streak}</Text>
          </View>

          {/* Stars Pill */}
          <View style={styles.starPill}>
            <Text style={styles.starIcon}>⭐</Text>
            <Text style={styles.starCount}>{stars}</Text>
          </View>

          {/* Child Profile Chip */}
          <PressScale style={styles.profileTouch} onPress={onOpenProfile}>
            <View style={styles.profileBadge}>
              <Text style={styles.profileEmoji}>👧</Text>
              <Text style={styles.profileName} numberOfLines={1}>
                {firstName}
              </Text>
            </View>
          </PressScale>
        </View>
      </FadeSlideIn>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Greeting & Interactive Companion ── */}
        <FadeSlideIn delay={60}>
          <View style={styles.heroRow}>
            <Pressable onPress={handleMascotTap} style={styles.mascotTouch}>
              <AskieCompanion size="l" state="idle" interactive={true} onPress={handleMascotTap} />
            </Pressable>

            <Animated.View style={[styles.speechBubble, { transform: [{ scale: bubbleScale }] }]}>
              <View style={styles.speechPointer} />
              <Text style={styles.speechText}>{currentMsg}</Text>
            </Animated.View>
          </View>
        </FadeSlideIn>

        {/* ── 2 HUGE Primary Kid-Friendly CTAs ── */}
        <FadeSlideIn delay={120}>
          <View style={styles.ctaContainer}>
            {/* 1. Talk to me! Button */}
            <Animated.View style={{ transform: [{ scale: ctaPulse }] }}>
              <PressScale onPress={onStartVoice}>
                <Pressable
                  style={styles.talkBigBtn}
                  onPress={onStartVoice}
                  accessibilityRole="button"
                  accessibilityLabel="Talk to me"
                >
                  <Text style={styles.talkBigEmoji}>🎤</Text>
                  <View style={styles.talkBigTextCol}>
                    <Text style={styles.talkBigTitle}>Talk to me!</Text>
                    <Text style={styles.talkBigSub}>Speak naturally like a phone call</Text>
                  </View>
                </Pressable>
              </PressScale>
            </Animated.View>

            {/* 2. Show me! Button */}
            <PressScale onPress={onStartCamera} style={{ marginTop: 12 }}>
              <Pressable
                style={styles.showBigBtn}
                onPress={onStartCamera}
                accessibilityRole="button"
                accessibilityLabel="Show me"
              >
                <Text style={styles.showBigEmoji}>📷</Text>
                <View style={styles.talkBigTextCol}>
                  <Text style={styles.showBigTitle}>Show me!</Text>
                  <Text style={styles.showBigSub}>Camera & AI Vision for homework</Text>
                </View>
              </Pressable>
            </PressScale>
          </View>
        </FadeSlideIn>

        {/* ── Today's Goal Card ── */}
        <FadeSlideIn delay={180}>
          <View style={styles.goalCard}>
            <View style={styles.goalTopRow}>
              <View>
                <Text style={styles.goalHeading}>Today's Goal</Text>
                <Text style={styles.goalSubtitle}>
                  {goalQuestions >= goalTotal
                    ? 'Goal done! 🎉'
                    : `${goalQuestions} of ${goalTotal} questions`}
                </Text>
              </View>
              {/* Star Dots */}
              <View style={styles.goalDotsRow}>
                {Array.from({ length: goalTotal }).map((_, i) => {
                  const done = i < goalQuestions;
                  return (
                    <View key={i} style={[styles.goalDot, done && styles.goalDotDone]}>
                      <Text style={{ fontSize: 13 }}>{done ? '⭐' : '•'}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.goalProgressTrack}>
              <View
                style={[
                  styles.goalProgressFill,
                  { width: `${Math.min(100, (goalQuestions / goalTotal) * 100)}%` },
                ]}
              />
            </View>
          </View>
        </FadeSlideIn>

        {/* ── Learn Something New Topic Tiles ── */}
        <FadeSlideIn delay={240}>
          <View style={styles.topicsSection}>
            <Text style={styles.sectionHeading}>Learn something new 💡</Text>
            <View style={styles.topicsGrid}>
              {TOPICS.map((topic) => (
                <PressScale
                  key={topic.key}
                  style={styles.topicTileScale}
                  onPress={() => onSelectTopic(topic.prompt)}
                >
                  <View
                    style={[
                      styles.topicTile,
                      { backgroundColor: topic.bg, borderColor: topic.border },
                    ]}
                  >
                    <Text style={styles.topicEmoji}>{topic.icon}</Text>
                    <Text style={styles.topicTitle}>{topic.title}</Text>
                    <Text style={styles.topicDesc} numberOfLines={2}>
                      {topic.desc}
                    </Text>
                  </View>
                </PressScale>
              ))}
            </View>
          </View>
        </FadeSlideIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#FFD8A8',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  streakFlame: {
    fontSize: 16,
  },
  streakCount: {
    fontSize: 14,
    fontFamily: fontFamilies.black,
    color: '#E8590C',
  },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBE6',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#FFEFA8',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  starIcon: {
    fontSize: 16,
  },
  starCount: {
    fontSize: 14,
    fontFamily: fontFamilies.black,
    color: '#A67C00',
  },
  profileTouch: {
    marginLeft: 'auto',
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  profileEmoji: {
    fontSize: 16,
  },
  profileName: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    maxWidth: 80,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  mascotTouch: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speechBubble: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
    ...shadows.card,
  },
  speechPointer: {
    position: 'absolute',
    left: -8,
    top: '40%',
    width: 14,
    height: 14,
    backgroundColor: colors.white,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },
  speechText: {
    fontSize: 15,
    fontFamily: fontFamilies.black,
    color: colors.text,
    lineHeight: 20,
  },
  ctaContainer: {
    marginVertical: 10,
  },
  talkBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE5150',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 2,
    borderBottomWidth: 6,
    borderColor: '#D94F4F',
    ...shadows.button,
  },
  talkBigEmoji: {
    fontSize: 34,
    marginRight: 14,
  },
  talkBigTextCol: {
    flex: 1,
  },
  talkBigTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.black,
    color: colors.white,
    letterSpacing: -0.3,
  },
  talkBigSub: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 2,
  },
  showBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ECDC4',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 2,
    borderBottomWidth: 6,
    borderColor: '#2FA9A0',
    ...shadows.button,
  },
  showBigEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  showBigTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.black,
    color: colors.white,
  },
  showBigSub: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 2,
  },
  goalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    padding: 16,
    marginTop: 14,
    ...shadows.card,
  },
  goalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalHeading: {
    fontSize: 15,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  goalSubtitle: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    marginTop: 2,
  },
  goalDotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  goalDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5ECDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalDotDone: {
    backgroundColor: '#FFE66D',
  },
  goalProgressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F5ECDD',
    marginTop: 12,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#FF9F43',
  },
  topicsSection: {
    marginTop: 18,
  },
  sectionHeading: {
    fontSize: 17,
    fontFamily: fontFamilies.black,
    color: colors.text,
    marginBottom: 10,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  topicTileScale: {
    width: '48%',
  },
  topicTile: {
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 5,
    padding: 14,
    alignItems: 'flex-start',
  },
  topicEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  topicTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  topicDesc: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    marginTop: 2,
    lineHeight: 15,
  },
});
