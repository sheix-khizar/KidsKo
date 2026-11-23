import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from '../ui/safeArea';
import { colors, radii, typography, fontFamilies, shadows, gradients } from '../theme';
import { AskieCompanion } from '../ui/AskieCompanion';
import { AskieEmoji } from '../ui/AskieEmoji';
import { triggerAskieReaction } from '../ui/AskieReactions';
import { FadeSlideIn, PressScale, Bounce } from '../ui/motion';
import { getStudentActivity } from '../services/api';
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

  // Gamification state (dynamic, real learning analytics)
  const [streak, setStreak] = useState(0);
  const [stars, setStars] = useState(25);
  const [goalQuestions, setGoalQuestions] = useState(0);
  const goalTotal = 5;

  // Load real student learning analytics and persistent stars
  const loadStudentStats = useCallback(async () => {
    try {
      const [activity, savedStarsStr] = await Promise.all([
        getStudentActivity(student.id).catch(() => null),
        SecureStore.getItemAsync(`@kidsko_stars_${student.id}`).catch(() => null),
      ]);

      if (activity) {
        setStreak(activity.streak || 0);
        setGoalQuestions(activity.questionsToday || 0);
        const baseStars = activity.stars || Math.max(25, ((activity.questionsThisWeek || 0) * 5) + ((activity.streak || 0) * 15));
        const savedStars = savedStarsStr ? parseInt(savedStarsStr, 10) : 0;
        const finalStars = Math.max(baseStars, savedStars);
        setStars(finalStars);
        if (finalStars > savedStars) {
          SecureStore.setItemAsync(`@kidsko_stars_${student.id}`, String(finalStars)).catch(() => {});
        }
      } else if (savedStarsStr) {
        setStars(parseInt(savedStarsStr, 10));
      }
    } catch (err) {
      console.warn('[HomeScreen] Failed to load student stats:', err);
    }
  }, [student.id]);

  useEffect(() => {
    loadStudentStats();
  }, [loadStudentStats]);

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
    setStars((s) => {
      const nextStars = s + 5;
      SecureStore.setItemAsync(`@kidsko_stars_${student.id}`, String(nextStars)).catch(() => {});
      return nextStars;
    });
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
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero Greeting & Interactive Companion ── */}
        <FadeSlideIn delay={60}>
          <View style={styles.heroRow}>
            <Pressable onPress={handleMascotTap} style={styles.mascotTouch}>
              <AskieCompanion size="m" state="idle" interactive={true} onPress={handleMascotTap} standing={true} />
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
              <Pressable
                style={({ pressed }) => [
                  styles.talkBigBtn,
                  pressed && { transform: [{ scale: 0.97 }], borderBottomWidth: 2, marginTop: 4 },
                ]}
                onPress={() => {
                  console.log('[HomeScreen] Talk to me tapped!');
                  onStartVoice();
                }}
                accessibilityRole="button"
                accessibilityLabel="Talk to me"
              >
                <Text style={styles.talkBigEmoji}>🎤</Text>
                <Text style={styles.talkBigTitle}>Talk to me!</Text>
              </Pressable>
            </Animated.View>

            {/* 2. Show me! Button */}
            <Pressable
              style={({ pressed }) => [
                styles.showBigBtn,
                { marginTop: 12 },
                pressed && { transform: [{ scale: 0.97 }], borderBottomWidth: 2, marginTop: 16 },
              ]}
              onPress={() => {
                console.log('[HomeScreen] Show me tapped!');
                onStartCamera();
              }}
              accessibilityRole="button"
              accessibilityLabel="Show me"
            >
              <Text style={styles.showBigEmoji}>📷</Text>
              <Text style={styles.showBigTitle}>Show me!</Text>
            </Pressable>
          </View>
        </FadeSlideIn>

        {/* ── Today's Goal Card ── */}
        <FadeSlideIn delay={180}>
          <View style={styles.goalCard}>
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
                    <Text style={{ fontSize: 14 }}>{done ? '⭐' : '•'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeSlideIn>

        {/* ── Learn Something New Topic Tiles ── */}
        <FadeSlideIn delay={240}>
          <View style={styles.topicsSection}>
            <Text style={styles.sectionHeading}>Learn something new 💡</Text>
            <View style={styles.trow}>
              {TOPICS.map((topic) => (
                <Pressable
                  key={topic.key}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: topic.bg, borderColor: topic.border },
                    pressed && styles.tilePressed,
                  ]}
                  onPress={() => onSelectTopic(topic.prompt)}
                  accessibilityRole="button"
                  accessibilityLabel={topic.title}
                >
                  <Text style={styles.tileEmoji}>{topic.icon}</Text>
                  <Text style={styles.tileTitle}>{topic.title}</Text>
                </Pressable>
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
    width: 105,
    height: 105,
    marginLeft: 10,
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
    justifyContent: 'center',
    backgroundColor: '#FE5150',
    borderRadius: 26,
    height: 76,
    borderWidth: 2,
    borderBottomWidth: 6,
    borderColor: '#D94F4F',
    gap: 12,
    ...shadows.button,
  },
  talkBigEmoji: {
    fontSize: 34,
  },
  talkBigTitle: {
    fontSize: 24,
    fontFamily: fontFamilies.black,
    color: colors.white,
    letterSpacing: -0.3,
  },
  showBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ECDC4',
    borderRadius: 22,
    height: 62,
    borderWidth: 2,
    borderBottomWidth: 6,
    borderColor: '#2FA9A0',
    gap: 10,
    ...shadows.button,
  },
  showBigEmoji: {
    fontSize: 26,
  },
  showBigTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.black,
    color: colors.white,
  },
  goalCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.card,
  },
  goalHeading: {
    fontSize: 16,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5ECDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalDotDone: {
    backgroundColor: '#FFE66D',
    borderWidth: 1.5,
    borderColor: '#FFD08A',
  },
  topicsSection: {
    marginTop: 18,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: fontFamilies.black,
    color: colors.text,
    marginBottom: 4,
  },
  trow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 2,
    borderBottomWidth: 5,
    paddingVertical: 14,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  tileEmoji: {
    fontSize: 34,
    marginBottom: 6,
  },
  tileTitle: {
    fontSize: 13.5,
    fontFamily: fontFamilies.black,
    color: colors.text,
    textAlign: 'center',
  },
  tilePressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
});
