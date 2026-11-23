import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  LinearGradient,
  Button,
  PressScale,
  FadeSlideIn,
  Bounce,
  Mascot,
  AskieEmoji,
  AskieCompanion,
  useSafeAreaInsets,
} from '../ui';
import { colors, fontFamilies, gradients } from '../theme';
import { createStudent, updateStudentMemory } from '../services/api';
import { savePin } from '../services/pinService';

type Props = {
  onFinish: (student: { id: string; student_name: string }) => void;
};

type Step =
  | 'intro'
  | 'c-name'
  | 'c-age'
  | 'c-interest'
  | 'c-pin'
  | 'c-safety'
  | 'perm'
  | 'done'
  | 'tour-choice'
  | 'kid-tour'
  | 'parent-tour'
  | 'workflow'
  | 'finish';

const AVATARS = [
  { colors: ['#FF6B6B', '#FF9F43'] as const, emoji: '👧' },
  { colors: ['#4ECDC4', '#74B9FF'] as const, emoji: '👦' },
  { colors: ['#A78BFA', '#FD79A8'] as const, emoji: '🧒' },
  { colors: ['#95E1A3', '#4ECDC4'] as const, emoji: '👩‍🚀' },
  { colors: ['#FFE66D', '#FF9F43'] as const, emoji: '🦸' },
  { colors: ['#FD79A8', '#A78BFA'] as const, emoji: '🧚' },
];

const INTERESTS = [
  { emoji: '🔬', label: 'Science' },
  { emoji: '🔢', label: 'Maths' },
  { emoji: '🦁', label: 'Animals' },
  { emoji: '🚀', label: 'Space' },
  { emoji: '🦕', label: 'Dinosaurs' },
  { emoji: '🎨', label: 'Art' },
  { emoji: '🎵', label: 'Music' },
  { emoji: '📚', label: 'Stories' },
  { emoji: '⚽', label: 'Sports' },
  { emoji: '💻', label: 'Coding' },
  { emoji: '🌍', label: 'Geography' },
  { emoji: '🧪', label: 'Experiments' },
];

const AGES = [5, 6, 7, 8, 9, 10, 11, 12, 13];
const GRADES = [
  'Kindergarten',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
];

const LIMITS: (number | '∞')[] = [10, 20, 30, 50, '∞'];

export default function OnboardingScreen({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('intro');

  // Form State
  const [consent, setConsent] = useState(false);
  const [childName, setChildName] = useState('');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [age, setAge] = useState<number | null>(7);
  const [grade, setGrade] = useState('Grade 2');
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    new Set(['Space', 'Animals', 'Science'])
  );

  // PIN Setup State
  const [pinBuf, setPinBuf] = useState('');
  const [pinTemp, setPinTemp] = useState('');
  const [pinStage, setPinStage] = useState<'create' | 'confirm'>('create');
  const [pinError, setPinError] = useState('');
  const [confirmedPin, setConfirmedPin] = useState('');

  // Safety & Limits State
  const [dailyLimit, setDailyLimit] = useState<number | '∞'>(30);
  const [strictFilter, setStrictFilter] = useState(true);
  const [studyHours, setStudyHours] = useState(false);
  const [dailyReport, setDailyReport] = useState(true);

  // Permissions State
  const [permMic, setPermMic] = useState(false);
  const [permCam, setPermCam] = useState(false);
  const [permNotif, setPermNotif] = useState(false);

  // Tours State
  const [kidTourIndex, setKidTourIndex] = useState(0);
  const [parentTourIndex, setParentTourIndex] = useState(0);
  const [kidTourDone, setKidTourDone] = useState(false);
  const [parentTourDone, setParentTourDone] = useState(false);

  // Saving / Finalizing State
  const [saving, setSaving] = useState(false);

  const firstName = childName.trim().split(' ')[0] || 'your child';

  const toggleInterest = (label: string) => {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const handlePickAge = (a: number) => {
    setAge(a);
    const gIndex = Math.max(0, Math.min(GRADES.length - 1, a - 5));
    setGrade(GRADES[gIndex]);
  };

  // PIN Keypad Handlers
  const handlePinKey = (d: string) => {
    if (pinBuf.length >= 4) return;
    const nextPin = pinBuf + d;
    setPinBuf(nextPin);
    setPinError('');

    if (nextPin.length === 4) {
      setTimeout(() => processPin(nextPin), 150);
    }
  };

  const handlePinBack = () => {
    setPinBuf((prev) => prev.slice(0, -1));
    setPinError('');
  };

  const processPin = (entered: string) => {
    if (pinStage === 'create') {
      // Check for trivial pins like 1111, 2222
      if (/^(\d)\1{3}$/.test(entered)) {
        setPinError('Too easy to guess. Choose a stronger PIN.');
        setPinBuf('');
        return;
      }
      setPinTemp(entered);
      setPinBuf('');
      setPinStage('confirm');
      setPinError('');
    } else {
      if (entered === pinTemp) {
        setConfirmedPin(entered);
        setStep('c-safety');
      } else {
        setPinError("PINs don't match. Let's start again.");
        setPinBuf('');
        setPinTemp('');
        setPinStage('create');
      }
    }
  };

  // Final submission and student creation
  const handleSaveAndOpenApp = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // 1. Save Parent PIN locally in SecureStore
      if (confirmedPin) {
        await savePin(confirmedPin);
      } else {
        await savePin('1234');
      }

      // 2. Create the child profile on the backend
      const finalName = childName.trim() || 'My Child';
      const student = await createStudent(finalName);

      // 3. Save memory facts (age, grade, avatar, interests, limit)
      const facts = [
        `Age: ${age || 7}`,
        `Grade: ${grade}`,
        `Avatar: ${AVATARS[avatarIndex].emoji}`,
        `Interests: ${Array.from(selectedInterests).join(', ')}`,
        `Daily Question Limit: ${dailyLimit === '∞' ? 'Unlimited' : dailyLimit + ' questions'}`,
        `Safety Filter: ${strictFilter ? 'Strict' : 'Standard'}`,
      ];

      try {
        await updateStudentMemory(student.id, {
          enabled: true,
          preferredName: finalName,
          facts,
        });
      } catch (memErr) {
        console.warn('[Onboarding Memory Warning]:', memErr);
      }

      // 4. Return finished student to App shell
      onFinish(student);
    } catch (err: any) {
      Alert.alert('Setup Error', err?.message || 'Could not save student profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------
  // RENDER STEP 0: INTRO
  // ----------------------------------------------------
  if (step === 'intro') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <FadeSlideIn delay={40}>
            <View style={styles.mascotBubbleRow}>
              <AskieCompanion size="s" state="idle" style={{ marginRight: 10 }} />
              <View style={styles.mascotBubble}>
                <Text style={styles.mascotBubbleText}>Hi, grown-up! Let's set up Kidsko for your child.</Text>
              </View>
            </View>

            <Text style={styles.title}>Quick setup</Text>
            <Text style={styles.subtext}>
              It takes about 2 minutes. You can change everything later in the Parents area.
            </Text>

            <View style={styles.card}>
              <View style={styles.stepRow}>
                <View style={[styles.stepIcon, { backgroundColor: '#FFE8E8' }]}>
                  <Text style={styles.stepIconEmoji}>👧</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Child profile</Text>
                  <Text style={styles.stepDesc}>Name and avatar</Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={[styles.stepIcon, { backgroundColor: '#FFF4E0' }]}>
                  <Text style={styles.stepIconEmoji}>🎂</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Age and grade</Text>
                  <Text style={styles.stepDesc}>So answers match their level</Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={[styles.stepIcon, { backgroundColor: '#E0FAFB' }]}>
                  <Text style={styles.stepIconEmoji}>🚀</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Interests</Text>
                  <Text style={styles.stepDesc}>Topics they love learning about</Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={[styles.stepIcon, { backgroundColor: '#EBF5FB' }]}>
                  <Text style={styles.stepIconEmoji}>🔒</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Parent PIN</Text>
                  <Text style={styles.stepDesc}>Keeps the Parents area private</Text>
                </View>
              </View>

              <View style={[styles.stepRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.stepIcon, { backgroundColor: '#E8F8F0' }]}>
                  <Text style={styles.stepIconEmoji}>🛡️</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Safety and limits</Text>
                  <Text style={styles.stepDesc}>Daily limit and content filter</Text>
                </View>
              </View>
            </View>

            <Pressable
              style={styles.consentBox}
              onPress={() => setConsent((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
            >
              <View style={[styles.checkbox, consent && styles.checkboxActive]}>
                {consent && <Text style={styles.checkIcon}>✓</Text>}
              </View>
              <Text style={styles.consentLabel}>
                I'm a <Text style={styles.boldText}>parent or legal guardian</Text> and I agree to the{' '}
                <Text style={styles.boldText}>Terms</Text> and <Text style={styles.boldText}>Privacy Policy</Text>.
              </Text>
            </Pressable>
          </FadeSlideIn>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            title="Start setup →"
            onPress={() => setStep('c-name')}
            disabled={!consent}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP 1: CHILD NAME & AVATAR
  // ----------------------------------------------------
  if (step === 'c-name') {
    const isNameValid = childName.trim().length >= 2;
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerProgressRow}>
          <Pressable onPress={() => setStep('intro')} style={styles.backCircle}>
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '20%' }]} />
          </View>
          <Text style={styles.stepCounterText}>1/5</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollPad} keyboardShouldPersistTaps="handled">
            <FadeSlideIn delay={40}>
              <View style={styles.mascotBubbleRow}>
                <AskieCompanion size="s" state="speaking" style={{ marginRight: 10 }} />
                <View style={styles.mascotBubble}>
                  <Text style={styles.mascotBubbleText}>
                    {isNameValid ? `Nice to meet you, ${firstName}! 🎉` : "What's your child's name?"}
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Child's first name</Text>
              <TextInput
                style={styles.nameTextInput}
                placeholder="e.g. Aisha"
                placeholderTextColor={colors.subtext}
                value={childName}
                onChangeText={setChildName}
                maxLength={24}
                autoFocus
              />

              <Text style={[styles.fieldLabel, { marginTop: 24 }]}>Pick an avatar</Text>
              <View style={styles.avatarGrid}>
                {AVATARS.map((item, idx) => {
                  const isSel = avatarIndex === idx;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => setAvatarIndex(idx)}
                      style={[styles.avatarCard, isSel && styles.avatarCardSelected]}
                    >
                      <LinearGradient
                        colors={item.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatarGradient}
                      >
                        <Text style={styles.avatarEmoji}>{item.emoji}</Text>
                        {isSel && (
                          <View style={styles.checkBadge}>
                            <Text style={styles.checkBadgeText}>✓</Text>
                          </View>
                        )}
                      </LinearGradient>
                    </Pressable>
                  );
                })}
              </View>
            </FadeSlideIn>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footerBar}>
          <Button
            title="Next →"
            onPress={() => setStep('c-age')}
            disabled={!isNameValid}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP 2: AGE & GRADE
  // ----------------------------------------------------
  if (step === 'c-age') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerProgressRow}>
          <Pressable onPress={() => setStep('c-name')} style={styles.backCircle}>
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '40%' }]} />
          </View>
          <Text style={styles.stepCounterText}>2/5</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollPad}>
          <FadeSlideIn delay={40}>
            <View style={styles.mascotBubbleRow}>
              <AskieCompanion size="s" state="speaking" style={{ marginRight: 10 }} />
              <View style={styles.mascotBubble}>
                <Text style={styles.mascotBubbleText}>How old is {firstName}?</Text>
              </View>
            </View>

            <View style={styles.ageGrid}>
              {AGES.map((a) => {
                const isSel = age === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => handlePickAge(a)}
                    style={[styles.ageBox, isSel && styles.ageBoxSelected]}
                  >
                    <Text style={[styles.ageNumber, isSel && styles.ageNumberSelected]}>{a}</Text>
                    <Text style={[styles.ageUnit, isSel && styles.ageUnitSelected]}>years</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Grade / Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              {GRADES.map((g) => {
                const isSel = grade === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGrade(g)}
                    style={[styles.gradeChip, isSel && styles.gradeChipSelected]}
                  >
                    <Text style={[styles.gradeChipText, isSel && styles.gradeChipTextSelected]}>{g}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.tipCard}>
              <Text style={{ fontSize: 26, marginRight: 12 }}>💡</Text>
              <Text style={styles.tipText}>
                Kidsko chooses simpler words and shorter answers for younger children, and richer explanations for older kids.
              </Text>
            </View>
          </FadeSlideIn>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            title="Next →"
            onPress={() => setStep('c-interest')}
            disabled={!age}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP 3: INTERESTS
  // ----------------------------------------------------
  if (step === 'c-interest') {
    const count = selectedInterests.size;
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerProgressRow}>
          <Pressable onPress={() => setStep('c-age')} style={styles.backCircle}>
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '60%' }]} />
          </View>
          <Text style={styles.stepCounterText}>3/5</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollPad}>
          <FadeSlideIn delay={40}>
            <View style={styles.mascotBubbleRow}>
              <AskieCompanion size="s" state="speaking" style={{ marginRight: 10 }} />
              <View style={styles.mascotBubble}>
                <Text style={styles.mascotBubbleText}>What does {firstName} love learning about?</Text>
              </View>
            </View>

            <Text style={styles.subtext}>
              Pick as many as you like. Kidsko will suggest fun questions and examples tailored to these topics.
            </Text>

            <View style={styles.chipWrap}>
              {INTERESTS.map((item) => {
                const isSel = selectedInterests.has(item.label);
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => toggleInterest(item.label)}
                    style={[styles.interestChip, isSel && styles.interestChipSelected]}
                  >
                    <AskieEmoji emoji={item.emoji} size={20} effect={isSel ? 'bounce' : 'none'} style={{ marginRight: 6 }} />
                    <Text style={[styles.interestChipLabel, isSel && styles.interestChipLabelSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </FadeSlideIn>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            title={count === 0 ? 'Pick at least 1 topic' : `Next · ${count} selected →`}
            onPress={() => setStep('c-pin')}
            disabled={count === 0}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP 4: PARENT PIN
  // ----------------------------------------------------
  if (step === 'c-pin') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerProgressRow}>
          <Pressable
            onPress={() => {
              setPinBuf('');
              setPinTemp('');
              setPinStage('create');
              setStep('c-interest');
            }}
            style={styles.backCircle}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '80%' }]} />
          </View>
          <Text style={styles.stepCounterText}>4/5</Text>
        </View>

        <ScrollView contentContainerStyle={[styles.scrollPad, { alignItems: 'center' }]}>
          <FadeSlideIn delay={40}>
            <View style={styles.pinShieldBadge}>
              <Text style={{ fontSize: 40 }}>🔐</Text>
            </View>

            <Text style={[styles.title, { textAlign: 'center' }]}>
              {pinStage === 'create' ? 'Create a parent PIN' : 'Confirm your PIN'}
            </Text>
            <Text style={[styles.subtext, { textAlign: 'center', marginBottom: 20 }]}>
              {pinStage === 'create'
                ? "You'll need this 4-digit PIN to open the Parents area. Keep it secret from the kids!"
                : 'Enter the same 4 digits again to confirm.'}
            </Text>

            {/* 4 PIN Dots */}
            <View style={styles.pinDotsRow}>
              {[0, 1, 2, 3].map((i) => {
                const isFilled = i < pinBuf.length;
                return (
                  <View
                    key={i}
                    style={[styles.pinDot, isFilled && styles.pinDotFilled]}
                  />
                );
              })}
            </View>

            {pinError ? <Text style={styles.pinErrorText}>{pinError}</Text> : null}

            {/* Numeric Keypad */}
            <View style={styles.keypadGrid}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, idx) => {
                if (k === '') {
                  return <View key={idx} style={styles.keyEmpty} />;
                }
                const isBack = k === '⌫';
                return (
                  <Pressable
                    key={idx}
                    onPress={() => (isBack ? handlePinBack() : handlePinKey(k))}
                    style={({ pressed }) => [styles.keyBtn, pressed && styles.keyBtnPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={isBack ? 'Backspace' : k}
                  >
                    <Text style={[styles.keyBtnText, isBack && { fontSize: 22 }]}>{k}</Text>
                  </Pressable>
                );
              })}
            </View>
          </FadeSlideIn>
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP 5: SAFETY & LIMITS
  // ----------------------------------------------------
  if (step === 'c-safety') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerProgressRow}>
          <Pressable onPress={() => setStep('c-pin')} style={styles.backCircle}>
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '100%' }]} />
          </View>
          <Text style={styles.stepCounterText}>5/5</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollPad}>
          <FadeSlideIn delay={40}>
            <Text style={styles.title}>Safety and limits</Text>
            <Text style={styles.subtext}>
              Set healthy boundaries for how {firstName} uses Kidsko.
            </Text>

            {/* Weekly limit card */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Weekly question limit</Text>
              <Text style={styles.cardSectionSub}>Kidsko pauses politely when the limit is reached.</Text>
              <View style={styles.limitRow}>
                {LIMITS.map((lim) => {
                  const isSel = dailyLimit === lim;
                  return (
                    <Pressable
                      key={lim}
                      onPress={() => setDailyLimit(lim)}
                      style={[styles.limitChip, isSel && styles.limitChipSelected]}
                    >
                      <Text style={[styles.limitChipText, isSel && styles.limitChipTextSelected]}>
                        {lim}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Toggles */}
            <View style={[styles.card, { marginTop: 14 }]}>
              <View style={styles.toggleRow}>
                <View style={[styles.stepIcon, { backgroundColor: '#FFE8E8' }]}>
                  <Text style={{ fontSize: 20 }}>🚫</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Strict content filter</Text>
                  <Text style={styles.stepDesc}>Blocks unsafe topics and language</Text>
                </View>
                <Pressable
                  onPress={() => setStrictFilter((v) => !v)}
                  style={[styles.toggleSwitch, strictFilter && styles.toggleSwitchOn]}
                >
                  <View style={[styles.toggleThumb, strictFilter && styles.toggleThumbOn]} />
                </Pressable>
              </View>

              <View style={styles.toggleRow}>
                <View style={[styles.stepIcon, { backgroundColor: '#FFF4E0' }]}>
                  <Text style={{ fontSize: 20 }}>⏰</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Study hours only</Text>
                  <Text style={styles.stepDesc}>8am–3pm and 5pm–7pm</Text>
                </View>
                <Pressable
                  onPress={() => setStudyHours((v) => !v)}
                  style={[styles.toggleSwitch, studyHours && styles.toggleSwitchOn]}
                >
                  <View style={[styles.toggleThumb, studyHours && styles.toggleThumbOn]} />
                </Pressable>
              </View>

              <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.stepIcon, { backgroundColor: '#E8F8F0' }]}>
                  <Text style={{ fontSize: 20 }}>📊</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Daily learning summary</Text>
                  <Text style={styles.stepDesc}>Summary sent every evening</Text>
                </View>
                <Pressable
                  onPress={() => setDailyReport((v) => !v)}
                  style={[styles.toggleSwitch, dailyReport && styles.toggleSwitchOn]}
                >
                  <View style={[styles.toggleThumb, dailyReport && styles.toggleThumbOn]} />
                </Pressable>
              </View>
            </View>
          </FadeSlideIn>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            title="Save and continue →"
            onPress={() => setStep('perm')}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP: PERMISSIONS
  // ----------------------------------------------------
  if (step === 'perm') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerProgressRow}>
          <Pressable onPress={() => setStep('c-safety')} style={styles.backCircle}>
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollPad}>
          <FadeSlideIn delay={40}>
            <View style={styles.mascotBubbleRow}>
              <AskieCompanion size="s" state="speaking" style={{ marginRight: 10 }} />
              <View style={styles.mascotBubble}>
                <Text style={styles.mascotBubbleText}>I need a few permissions to help in all the ways!</Text>
              </View>
            </View>

            <Text style={styles.title}>Allow access</Text>
            <Text style={styles.subtext}>You can change these anytime in phone settings.</Text>

            <View style={[styles.card, { marginTop: 16 }]}>
              <View style={styles.toggleRow}>
                <View style={[styles.stepIcon, { backgroundColor: '#FFE8E8' }]}>
                  <Text style={{ fontSize: 20 }}>🎤</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Microphone</Text>
                  <Text style={styles.stepDesc}>For real-time voice calls with Kidsko</Text>
                </View>
                <Pressable
                  onPress={() => setPermMic((v) => !v)}
                  style={[styles.permBtn, permMic && styles.permBtnAllowed]}
                >
                  <Text style={[styles.permBtnText, permMic && styles.permBtnTextAllowed]}>
                    {permMic ? 'Allowed ✓' : 'Allow'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.toggleRow}>
                <View style={[styles.stepIcon, { backgroundColor: '#E0FAFB' }]}>
                  <Text style={{ fontSize: 20 }}>📷</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Camera</Text>
                  <Text style={styles.stepDesc}>For homework scanning with AI Vision</Text>
                </View>
                <Pressable
                  onPress={() => setPermCam((v) => !v)}
                  style={[styles.permBtn, permCam && styles.permBtnAllowed]}
                >
                  <Text style={[styles.permBtnText, permCam && styles.permBtnTextAllowed]}>
                    {permCam ? 'Allowed ✓' : 'Allow'}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.stepIcon, { backgroundColor: '#FFF4E0' }]}>
                  <Text style={{ fontSize: 20 }}>🔔</Text>
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepTitle}>Notifications</Text>
                  <Text style={styles.stepDesc}>Daily reports and study reminders</Text>
                </View>
                <Pressable
                  onPress={() => setPermNotif((v) => !v)}
                  style={[styles.permBtn, permNotif && styles.permBtnAllowed]}
                >
                  <Text style={[styles.permBtnText, permNotif && styles.permBtnTextAllowed]}>
                    {permNotif ? 'Allowed ✓' : 'Allow'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.privacyGuaranteeText}>
              🔒 Safe & Private: Camera and microphone are only activated while a call is active. Nothing is ever sold or recorded for ads.
            </Text>
          </FadeSlideIn>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            title="Continue →"
            onPress={() => setStep('done')}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP: DONE / SUMMARY
  // ----------------------------------------------------
  if (step === 'done') {
    const chosenAvatar = AVATARS[avatarIndex];
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <ScrollView contentContainerStyle={[styles.scrollPad, { alignItems: 'center' }]}>
          <FadeSlideIn delay={40}>
            <Bounce>
              <View style={[styles.doneMascotBox, { backgroundColor: 'transparent', borderWidth: 0 }]}>
                <AskieCompanion size="l" state="celebrate" />
              </View>
            </Bounce>

            <Text style={[styles.title, { textAlign: 'center', marginTop: 12 }]}>All set! 🎉</Text>
            <Text style={[styles.subtext, { textAlign: 'center' }]}>{firstName}'s Kidsko is ready.</Text>

            <View style={[styles.card, { width: '100%', marginTop: 20 }]}>
              <View style={styles.summaryTopRow}>
                <LinearGradient
                  colors={chosenAvatar.colors}
                  style={styles.summaryAvatarCircle}
                >
                  <Text style={{ fontSize: 32 }}>{chosenAvatar.emoji}</Text>
                </LinearGradient>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.summaryName}>{childName.trim() || 'My Child'}</Text>
                  <Text style={styles.summaryMeta}>Age {age} · {grade}</Text>
                </View>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Loves</Text>
                <Text style={styles.summaryDetailValue}>
                  {Array.from(selectedInterests).slice(0, 5).join(' · ')}
                </Text>
              </View>

              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Weekly limit</Text>
                <Text style={styles.summaryDetailValue}>
                  {dailyLimit === '∞' ? 'Unlimited' : `${dailyLimit} questions`}
                </Text>
              </View>

              <View style={styles.summaryDetailRow}>
                <Text style={styles.summaryDetailLabel}>Parent PIN</Text>
                <Text style={[styles.summaryDetailValue, { letterSpacing: 4 }]}>••••</Text>
              </View>
            </View>
          </FadeSlideIn>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            title="Take a quick tour 🚀"
            onPress={() => setStep('tour-choice')}
            variant="primary"
          />
          <Pressable
            onPress={handleSaveAndOpenApp}
            style={{ alignItems: 'center', marginTop: 14 }}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.coralStrong} />
            ) : (
              <Text style={styles.skipTourText}>Skip the tour and open app →</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP: TOUR CHOICE
  // ----------------------------------------------------
  if (step === 'tour-choice') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerProgressRow}>
          <Pressable onPress={() => setStep('done')} style={styles.backCircle}>
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollPad}>
          <FadeSlideIn delay={40}>
            <Text style={styles.title}>Who's taking the tour?</Text>
            <Text style={styles.subtext}>Each tour takes about 1 minute.</Text>

            {/* Kid's tour card */}
            <Pressable
              onPress={() => setStep('kid-tour')}
              style={[styles.tourCard, { borderColor: 'rgba(255, 107, 107, 0.4)' }]}
            >
              <View style={[styles.tourCardIcon, { backgroundColor: 'transparent' }]}>
                <AskieCompanion size="s" state="idle" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tourCardTitle}>{firstName}'s tour</Text>
                <Text style={styles.tourCardDesc}>
                  Hand over the phone! Kidsko shows how to chat, call, and use AI Vision.
                </Text>
              </View>
              <Text style={{ fontSize: 20 }}>{kidTourDone ? '✅' : '›'}</Text>
            </Pressable>

            {/* Parent's tour card */}
            <Pressable
              onPress={() => setStep('parent-tour')}
              style={[styles.tourCard, { borderColor: 'rgba(41, 128, 185, 0.4)', marginTop: 14 }]}
            >
              <View style={[styles.tourCardIcon, { backgroundColor: '#EBF5FB' }]}>
                <Text style={{ fontSize: 32 }}>👨‍👩‍👧</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tourCardTitle}>Parent guide</Text>
                <Text style={styles.tourCardDesc}>
                  Learn how the dashboard, limits, and safety controls protect your child.
                </Text>
              </View>
              <Text style={{ fontSize: 20 }}>{parentTourDone ? '✅' : '›'}</Text>
            </Pressable>
          </FadeSlideIn>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            title={kidTourDone || parentTourDone ? 'Finish setup →' : 'Skip for now'}
            onPress={() => setStep('finish')}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP: KID TOUR (CAROUSEL)
  // ----------------------------------------------------
  if (step === 'kid-tour') {
    const slides = [
      {
        isMascot: true,
        emoji: '✨',
        title: `Hi ${firstName}! I'm Kidsko!`,
        desc: "I'm your friendly AI teacher. Ask me anything and I'll explain it in a fun, easy way.",
      },
      {
        emoji: '💬',
        title: 'Chat with me',
        desc: 'Type your question, or tap 📷 to snap a picture of your homework.',
      },
      {
        emoji: '📞',
        title: 'Talk to me',
        desc: 'Tap Call and just speak. I answer out loud, just like talking on the phone!',
      },
      {
        emoji: '👁️',
        title: 'AI Vision',
        desc: 'Point the camera at anything and I will identify it and tell you cool facts about it!',
      },
      {
        emoji: '🔒',
        title: 'Grown-ups only',
        desc: 'The Parents button requires a secret PIN to protect your learning space.',
      },
    ];

    const cur = slides[kidTourIndex];
    const isLast = kidTourIndex === slides.length - 1;

    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.carouselHeader}>
          <Pressable
            onPress={() => {
              setKidTourDone(true);
              setStep('tour-choice');
            }}
          >
            <Text style={styles.carouselSkipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.carouselStage}>
          <FadeSlideIn key={kidTourIndex} delay={0}>
            <View style={[styles.tourMascotCard, cur.isMascot && { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 }]}>
              {cur.isMascot ? (
                <AskieCompanion size="xl" state="celebrate" />
              ) : (
                <AskieEmoji emoji={cur.emoji} size={72} effect="bounce" />
              )}
            </View>
            <Text style={styles.tourSlideTitle}>{cur.title}</Text>
            <Text style={styles.tourSlideDesc}>{cur.desc}</Text>
          </FadeSlideIn>
        </View>

        {/* Carousel Dots */}
        <View style={styles.carouselDotsRow}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.cDot, i === kidTourIndex && styles.cDotActive]} />
          ))}
        </View>

        <View style={styles.footerRow}>
          {kidTourIndex > 0 ? (
            <Pressable
              onPress={() => setKidTourIndex((prev) => prev - 1)}
              style={styles.tourBackBtn}
            >
              <Text style={styles.tourBackBtnText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              if (isLast) {
                setKidTourDone(true);
                setStep('tour-choice');
              } else {
                setKidTourIndex((prev) => prev + 1);
              }
            }}
            style={[styles.tourNextBtn, { flex: 1 }]}
          >
            <Text style={styles.tourNextBtnText}>{isLast ? "Let's go! 🚀" : 'Next →'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP: PARENT TOUR (CAROUSEL)
  // ----------------------------------------------------
  if (step === 'parent-tour') {
    const slides = [
      {
        emoji: '📊',
        title: 'See what they learn',
        desc: 'The Parents Dashboard shows questions asked, time spent, topics explored, and complete chat transcripts.',
      },
      {
        emoji: '⏰',
        title: 'Set healthy limits',
        desc: 'Set daily question limits and study hours. Kidsko pauses automatically when time is up.',
      },
      {
        emoji: '👨‍👩‍👧',
        title: 'One account, many children',
        desc: 'Add multiple children. Each child gets their own personalized AI memory, history, and limits.',
      },
      {
        emoji: '🛡️',
        title: 'Safe by design',
        desc: 'Every single question is safety-checked. No ads, no data selling, and protected by your secret PIN.',
      },
    ];

    const cur = slides[parentTourIndex];
    const isLast = parentTourIndex === slides.length - 1;

    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.carouselHeader}>
          <Pressable
            onPress={() => {
              setParentTourDone(true);
              setStep('workflow');
            }}
          >
            <Text style={styles.carouselSkipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.carouselStage}>
          <FadeSlideIn key={parentTourIndex} delay={0}>
            <View style={[styles.tourMascotCard, { backgroundColor: '#EBF5FB' }]}>
              <Text style={{ fontSize: 90 }}>{cur.emoji}</Text>
            </View>
            <Text style={styles.tourSlideTitle}>{cur.title}</Text>
            <Text style={styles.tourSlideDesc}>{cur.desc}</Text>
          </FadeSlideIn>
        </View>

        {/* Carousel Dots */}
        <View style={styles.carouselDotsRow}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.cDot,
                i === parentTourIndex && [styles.cDotActive, { backgroundColor: '#1E3A5F' }],
              ]}
            />
          ))}
        </View>

        <View style={styles.footerRow}>
          {parentTourIndex > 0 ? (
            <Pressable
              onPress={() => setParentTourIndex((prev) => prev - 1)}
              style={styles.tourBackBtn}
            >
              <Text style={styles.tourBackBtnText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              if (isLast) {
                setParentTourDone(true);
                setStep('workflow');
              } else {
                setParentTourIndex((prev) => prev + 1);
              }
            }}
            style={[styles.tourNextBtn, { flex: 1, backgroundColor: '#1E3A5F' }]}
          >
            <Text style={styles.tourNextBtnText}>
              {isLast ? 'See how it works →' : 'Next →'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP: WORKFLOW (HOW KIDSKO WORKS)
  // ----------------------------------------------------
  if (step === 'workflow') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.headerProgressRow}>
          <Pressable onPress={() => setStep('parent-tour')} style={styles.backCircle}>
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollPad}>
          <FadeSlideIn delay={40}>
            <Text style={styles.title}>How Kidsko works</Text>
            <Text style={styles.subtext}>From question to answer, with you in full control.</Text>

            <View style={{ marginTop: 20 }}>
              <View style={styles.workflowStep}>
                <View style={[styles.workflowBadge, { backgroundColor: '#FFE8E8' }]}>
                  <Text style={{ fontSize: 24 }}>🙋</Text>
                </View>
                <View style={styles.workflowContent}>
                  <Text style={styles.workflowTitle}>1. Your child asks</Text>
                  <Text style={styles.workflowDesc}>
                    By typing in chat, speaking in a live voice call, or showing homework with AI Vision.
                  </Text>
                </View>
              </View>

              <View style={styles.workflowStep}>
                <View style={[styles.workflowBadge, { backgroundColor: '#E0FAFB' }]}>
                  <Text style={{ fontSize: 24 }}>🛡️</Text>
                </View>
                <View style={styles.workflowContent}>
                  <Text style={styles.workflowTitle}>2. Safety check</Text>
                  <Text style={styles.workflowDesc}>
                    Kidsko checks the question against strict children's filters and blocks any harmful or adult topic.
                  </Text>
                </View>
              </View>

              <View style={styles.workflowStep}>
                <View style={[styles.workflowBadge, { backgroundColor: 'transparent' }]}>
                  <AskieCompanion size="s" state="speaking" />
                </View>
                <View style={styles.workflowContent}>
                  <Text style={styles.workflowTitle}>3. Kidsko explains</Text>
                  <Text style={styles.workflowDesc}>
                    The AI creates a personalized answer matching {firstName}'s age ({age}) and grade ({grade}).
                  </Text>
                </View>
              </View>

              <View style={[styles.workflowStep, { marginBottom: 0 }]}>
                <View style={[styles.workflowBadge, { backgroundColor: '#EBF5FB' }]}>
                  <Text style={{ fontSize: 24 }}>📊</Text>
                </View>
                <View style={styles.workflowContent}>
                  <Text style={styles.workflowTitle}>4. You stay informed</Text>
                  <Text style={styles.workflowDesc}>
                    Open the Parents area anytime with your secret 4-digit PIN to review topics, questions, and usage.
                  </Text>
                </View>
              </View>
            </View>
          </FadeSlideIn>
        </ScrollView>

        <View style={styles.footerBar}>
          <Button
            title="Got it →"
            onPress={() => setStep('finish')}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER STEP: FINISH
  // ----------------------------------------------------
  return (
    <View style={[styles.container, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView contentContainerStyle={[styles.scrollPad, { alignItems: 'center' }]}>
        <FadeSlideIn delay={40}>
          <View style={styles.finishMascotBadge}>
            <Text style={{ fontSize: 50 }}>🎉</Text>
          </View>

          <Text style={[styles.title, { textAlign: 'center', marginTop: 14 }]}>Ready to learn!</Text>
          <Text style={[styles.subtext, { textAlign: 'center' }]}>
            {firstName} can start asking questions right now.
          </Text>

          <View style={[styles.card, { width: '100%', marginTop: 22 }]}>
            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: '#FFE8E8' }]}>
                <Text style={{ fontSize: 20 }}>👧</Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>{childName.trim() || 'Child'}'s profile</Text>
                <Text style={styles.stepDesc}>Age {age} · {grade}</Text>
              </View>
              <Text style={styles.checkGreen}>✓</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: '#EBF5FB' }]}>
                <Text style={{ fontSize: 20 }}>🔐</Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>Parent PIN</Text>
                <Text style={styles.stepDesc}>Set and ready</Text>
              </View>
              <Text style={styles.checkGreen}>✓</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: '#E8F8F0' }]}>
                <Text style={{ fontSize: 20 }}>🛡️</Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>Safety and limits</Text>
                <Text style={styles.stepDesc}>
                  {dailyLimit === '∞' ? 'No limit' : `${dailyLimit} questions / day`}
                </Text>
              </View>
              <Text style={styles.checkGreen}>✓</Text>
            </View>

            <View style={[styles.stepRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.stepIcon, { backgroundColor: '#FFF4E0' }]}>
                <Text style={{ fontSize: 20 }}>🧭</Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>Tutorials</Text>
                <Text style={styles.stepDesc}>
                  {kidTourDone || parentTourDone ? 'Completed' : 'Available anytime in Parents Area'}
                </Text>
              </View>
              <Text style={styles.checkGreen}>✓</Text>
            </View>
          </View>
        </FadeSlideIn>
      </ScrollView>

      <View style={styles.footerBar}>
        <Button
          title={saving ? 'Setting up...' : 'Open Kidsko 🚀'}
          onPress={handleSaveAndOpenApp}
          loading={saving}
          variant="primary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  scrollPad: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontFamily: fontFamilies.black,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtext: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    lineHeight: 20,
    marginTop: 6,
  },
  headerProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backCircleText: {
    fontSize: 24,
    fontFamily: fontFamilies.black,
    color: colors.text,
    marginTop: -2,
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#F0E6D3',
    borderRadius: 5,
    marginHorizontal: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.coralStrong,
    borderRadius: 5,
  },
  stepCounterText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    minWidth: 26,
  },
  mascotBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 18,
  },
  mascotBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.coralStrong,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.coralStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mascotEmoji: {
    fontSize: 30,
  },
  mascotBubble: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#F0E6D3',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mascotBubbleText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFE6',
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIconEmoji: {
    fontSize: 20,
  },
  stepInfo: {
    flex: 1,
    marginLeft: 12,
  },
  stepTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  stepDesc: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginTop: 2,
  },
  consentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#F0E6D3',
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D8CDBB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: colors.coralStrong,
    borderColor: colors.coralStrong,
  },
  checkIcon: {
    color: colors.white,
    fontSize: 14,
    fontFamily: fontFamilies.black,
  },
  consentLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    lineHeight: 18,
  },
  boldText: {
    color: colors.text,
    fontFamily: fontFamilies.bold,
  },
  footerBar: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    marginBottom: 8,
  },
  nameTextInput: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#F0E6D3',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 20,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarCardSelected: {
    borderColor: colors.text,
    transform: [{ scale: 1.05 }],
  },
  avatarGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: fontFamilies.black,
  },
  ageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  ageBox: {
    width: '31%',
    height: 74,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#F0E6D3',
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageBoxSelected: {
    borderColor: colors.coralStrong,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    transform: [{ scale: 1.04 }],
  },
  ageNumber: {
    fontSize: 28,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  ageNumberSelected: {
    color: colors.coralStrong,
  },
  ageUnit: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  ageUnitSelected: {
    color: colors.coralStrong,
  },
  gradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F0E6D3',
    backgroundColor: colors.white,
    marginRight: 8,
  },
  gradeChipSelected: {
    borderColor: colors.coralStrong,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  gradeChipText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  gradeChipTextSelected: {
    color: colors.coralStrong,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0FAFB',
    borderRadius: 18,
    padding: 14,
    marginTop: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    color: colors.text,
    lineHeight: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#F0E6D3',
    backgroundColor: colors.white,
    gap: 8,
  },
  interestChipSelected: {
    borderColor: colors.coralStrong,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  interestChipEmoji: {
    fontSize: 18,
  },
  interestChipLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  interestChipLabelSelected: {
    color: colors.coralStrong,
  },
  pinShieldBadge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 16,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E0D6C6',
  },
  pinDotFilled: {
    backgroundColor: colors.coralStrong,
    shadowColor: colors.coralStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  pinErrorText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: '#EF4444',
    marginBottom: 10,
    textAlign: 'center',
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    gap: 12,
    marginTop: 6,
  },
  keyBtn: {
    width: 76,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  keyBtnPressed: {
    backgroundColor: '#F5EFE6',
    transform: [{ scale: 0.95 }],
  },
  keyBtnText: {
    fontSize: 24,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  keyEmpty: {
    width: 76,
    height: 60,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  cardSectionSub: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginTop: 2,
  },
  limitRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  limitChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#F0E6D3',
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitChipSelected: {
    borderColor: colors.coralStrong,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  limitChipText: {
    fontSize: 15,
    fontFamily: fontFamilies.black,
    color: colors.subtext,
  },
  limitChipTextSelected: {
    color: colors.coralStrong,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFE6',
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleSwitchOn: {
    backgroundColor: '#4ECDC4',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  permBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.coralStrong,
  },
  permBtnAllowed: {
    backgroundColor: '#E8F8F0',
  },
  permBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.white,
  },
  permBtnTextAllowed: {
    color: '#00B894',
  },
  privacyGuaranteeText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  doneMascotBox: {
    width: 100,
    height: 100,
    borderRadius: 32,
    backgroundColor: colors.coralStrong,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.coralStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryAvatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryName: {
    fontSize: 18,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  summaryMeta: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F0E6D3',
    marginVertical: 14,
  },
  summaryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryDetailLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  summaryDetailValue: {
    fontSize: 13,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  skipTourText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  tourCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 2.5,
    padding: 16,
    gap: 14,
  },
  tourCardIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tourCardTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  tourCardDesc: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    lineHeight: 16,
    marginTop: 3,
  },
  carouselHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 22,
    height: 36,
  },
  carouselSkipText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  carouselStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  tourMascotCard: {
    width: 220,
    height: 200,
    borderRadius: 30,
    backgroundColor: '#FFE8E8',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  tourSlideTitle: {
    fontSize: 24,
    fontFamily: fontFamilies.black,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  tourSlideDesc: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  carouselDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  cDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0D6C6',
  },
  cDotActive: {
    width: 24,
    backgroundColor: colors.coralStrong,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
  },
  tourBackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tourBackBtnText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  tourNextBtn: {
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.coralStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tourNextBtnText: {
    fontSize: 16,
    fontFamily: fontFamilies.black,
    color: colors.white,
  },
  workflowStep: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  workflowBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workflowContent: {
    flex: 1,
  },
  workflowTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  workflowDesc: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    lineHeight: 16,
    marginTop: 2,
  },
  finishMascotBadge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#95E1A3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkGreen: {
    fontSize: 18,
    fontFamily: fontFamilies.black,
    color: '#00B894',
    marginLeft: 8,
  },
});
