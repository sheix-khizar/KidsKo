import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Student } from '../screens/MainShellScreen';
import {
  getStudentMemory,
  updateStudentMemory,
  createStudent,
  StudentMemoryData,
} from '../services/api';
import { isPremiumActive } from '../services/billing';
import { colors, radii, spacing, typography, fontFamilies, gradients, shadows } from '../theme';
import { LinearGradient } from '../ui/LinearGradient';
import { PressScale, FadeSlideIn } from '../ui/motion';

type Props = {
  students: Student[];
  activeStudent: Student | null;
  onSelectStudent: (student: Student) => void;
  onRefreshStudents: () => Promise<void>;
  onOpenTranscript: (student: Student) => void;
  onOpenPaywall: () => void;
  onRequestLogout: () => void;
  billingVersion?: number;
};

export default function ParentsHub({
  students,
  activeStudent,
  onSelectStudent,
  onRefreshStudents,
  onOpenTranscript,
  onOpenPaywall,
  onRequestLogout,
  billingVersion = 0,
}: Props) {
  // Add child state
  const [showAddInput, setShowAddInput] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [addChildError, setAddChildError] = useState<string | null>(null);

  // Memory state for active student
  const [memory, setMemory] = useState<StudentMemoryData | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [updatingMemory, setUpdatingMemory] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  // Plan state
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    (async () => {
      const premium = await isPremiumActive();
      setIsPremium(premium);
    })();
  }, [billingVersion]);

  const fetchMemory = async (studentId: string) => {
    setLoadingMemory(true);
    setMemoryError(null);
    try {
      const data = await getStudentMemory(studentId);
      setMemory(data);
    } catch (err: any) {
      console.warn('Failed to load memory:', err.message);
      setMemory(null);
      setMemoryError(err.message || 'Could not load learning preferences');
    } finally {
      setLoadingMemory(false);
    }
  };

  useEffect(() => {
    if (activeStudent) {
      fetchMemory(activeStudent.id);
    } else {
      setMemory(null);
    }
  }, [activeStudent?.id]);

  // Handle adding child
  const handleAddChild = async () => {
    const trimmed = newChildName.trim();
    if (!trimmed) {
      setAddChildError('Please enter a name');
      return;
    }
    setAddingChild(true);
    setAddChildError(null);
    try {
      await createStudent(trimmed);
      setNewChildName('');
      setShowAddInput(false);
      await onRefreshStudents();
    } catch (err: any) {
      setAddChildError(err.message || 'Could not add child');
    } finally {
      setAddingChild(false);
    }
  };

  // Toggle memory switch
  const handleToggleMemory = async (val: boolean) => {
    if (!activeStudent || !memory) return;
    setUpdatingMemory(true);
    try {
      const updated = await updateStudentMemory(activeStudent.id, { enabled: val });
      setMemory(updated);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update memory setting');
    } finally {
      setUpdatingMemory(false);
    }
  };

  // Remove single fact chip
  const handleRemoveFact = async (indexToRemove: number) => {
    if (!activeStudent || !memory) return;
    const newFacts = memory.facts.filter((_, idx) => idx !== indexToRemove);
    setUpdatingMemory(true);
    try {
      const updated = await updateStudentMemory(activeStudent.id, { facts: newFacts });
      setMemory(updated);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove fact');
    } finally {
      setUpdatingMemory(false);
    }
  };

  // Clear preferred name
  const handleClearPreferredName = async () => {
    if (!activeStudent || !memory) return;
    setUpdatingMemory(true);
    try {
      const updated = await updateStudentMemory(activeStudent.id, { preferredName: null });
      setMemory(updated);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove preferred name');
    } finally {
      setUpdatingMemory(false);
    }
  };

  // Forget everything
  const handleForgetEverything = () => {
    if (!activeStudent) return;
    Alert.alert(
      'Forget everything?',
      `Are you sure you want to erase all remembered facts and preferences for ${activeStudent.student_name}? Kidsko will start fresh.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget Everything',
          style: 'destructive',
          onPress: async () => {
            setUpdatingMemory(true);
            try {
              await updateStudentMemory(activeStudent.id, {
                facts: [],
                preferredName: null,
              });
              await fetchMemory(activeStudent.id);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to reset memory');
            } finally {
              setUpdatingMemory(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Prototype Navy Gradient Header */}
      <LinearGradient
        colors={gradients.parents.colors}
        start={gradients.parents.start}
        end={gradients.parents.end}
        style={styles.navyHeader}
      >
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerEmoji}>🧑‍🤝‍🧑</Text>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Parent Dashboard</Text>
            <Text style={styles.headerSubtitle}>Manage your children's learning</Text>
          </View>
        </View>

        {/* Children squircle avatars list */}
        <View style={styles.childrenAvatarsRow}>
          {students.map((st) => {
            const isSelected = activeStudent?.id === st.id;
            return (
              <PressScale
                key={st.id}
                onPress={() => onSelectStudent(st)}
                accessibilityRole="button"
                accessibilityLabel={`Select child ${st.student_name}`}
              >
                <View style={styles.childAvatarCol}>
                  <View
                    style={[
                      styles.childAvatarSquircle,
                      isSelected && styles.childAvatarSquircleActive,
                    ]}
                  >
                    <Text style={styles.childAvatarEmoji}>🧒</Text>
                    {isSelected && (
                      <View style={styles.activeChildBadge}>
                        <Text style={styles.activeChildBadgeCheck}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.childAvatarName,
                      isSelected && styles.childAvatarNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {st.student_name}
                  </Text>
                </View>
              </PressScale>
            );
          })}

          {/* Add Child Squircle */}
          <PressScale
            onPress={() => setShowAddInput((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Add another child"
          >
            <View style={styles.childAvatarCol}>
              <View
                style={[
                  styles.addChildSquircle,
                  showAddInput && styles.addChildSquircleActive,
                ]}
              >
                <Text style={styles.addChildPlus}>{showAddInput ? '✕' : '+'}</Text>
              </View>
              <Text style={styles.childAvatarName}>Add</Text>
            </View>
          </PressScale>
        </View>

        {/* Inline Add Child Input */}
        {showAddInput && (
          <FadeSlideIn duration={180}>
            <View style={styles.inlineAddRow}>
              <TextInput
                style={styles.inlineAddInput}
                placeholder="Child's name"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={newChildName}
                onChangeText={(txt) => {
                  setNewChildName(txt);
                  if (addChildError) setAddChildError(null);
                }}
                maxLength={30}
                autoFocus
              />
              <PressScale onPress={handleAddChild} disabled={addingChild}>
                <View style={styles.inlineAddBtn}>
                  {addingChild ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.inlineAddBtnText}>Save</Text>
                  )}
                </View>
              </PressScale>
            </View>
            {addChildError && (
              <Text style={styles.inlineErrorText}>{addChildError}</Text>
            )}
          </FadeSlideIn>
        )}
      </LinearGradient>

      {/* 2. What Kidsko Remembers Section */}
      {activeStudent && (
        <View style={styles.sectionCard}>
          <View style={styles.memoryHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeading}>What Kidsko Remembers</Text>
              <Text style={styles.sectionSub}>
                Learning preferences Kidsko picked up from chats with {activeStudent.student_name}.
              </Text>
            </View>
            {!memoryError && (
              <View style={styles.switchCol}>
                <Switch
                  value={memory?.enabled ?? true}
                  onValueChange={handleToggleMemory}
                  trackColor={{ false: colors.borderLight, true: colors.green }}
                  thumbColor={colors.white}
                  disabled={loadingMemory || updatingMemory}
                  accessibilityRole="switch"
                  accessibilityLabel="Enable learning memory"
                  accessibilityState={{ checked: !!memory?.enabled }}
                />
                <Text style={styles.switchLabel}>
                  {memory?.enabled ? 'Active' : 'Off'}
                </Text>
              </View>
            )}
          </View>

          {loadingMemory ? (
            <ActivityIndicator style={{ paddingVertical: 16 }} color={colors.coralStrong} />
          ) : memoryError ? (
            <View style={styles.memoryErrorContainer}>
              <Text style={styles.memoryErrorText}>⚠️ {memoryError}</Text>
              <PressScale onPress={() => fetchMemory(activeStudent.id)}>
                <View style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </View>
              </PressScale>
            </View>
          ) : (
            <>
              {/* Preferred Name Tag */}
              {memory?.preferredName && (
                <View style={styles.preferredNameRow}>
                  <Text style={styles.preferredNameLabel}>
                    Name to call {activeStudent.student_name}:
                  </Text>
                  <View style={styles.nameBadge}>
                    <Text style={styles.nameBadgeText}>{memory.preferredName}</Text>
                    <Pressable
                      style={styles.nameBadgeRemoveBtn}
                      onPress={handleClearPreferredName}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="button"
                      accessibilityLabel="Remove preferred name"
                    >
                      <Text style={styles.nameBadgeRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Facts Chips */}
              <View style={styles.factsContainer}>
                {memory?.facts && memory.facts.length > 0 ? (
                  memory.facts.map((fact, index) => {
                    const chip = (
                      <View key={`${fact}_${index}`} style={styles.factChip}>
                        <Text style={styles.factChipText}>{fact}</Text>
                        <Pressable
                          style={styles.factChipRemoveBtn}
                          onPress={() => handleRemoveFact(index)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove fact ${fact}`}
                        >
                          <Text style={styles.factChipRemoveText}>✕</Text>
                        </Pressable>
                      </View>
                    );

                    if (index < 8) {
                      return (
                        <FadeSlideIn key={`${fact}_${index}`} delay={index * 25}>
                          {chip}
                        </FadeSlideIn>
                      );
                    }
                    return chip;
                  })
                ) : (
                  <Text style={styles.noFactsText}>
                    {memory?.enabled
                      ? `No specific facts recorded yet. As ${activeStudent.student_name} chats, Kidsko will remember their grade and interests.`
                      : `Memory is switched off. Kidsko will not store or use facts across chats.`}
                  </Text>
                )}
              </View>

              {/* Forget Everything Button */}
              {Boolean(memory?.preferredName || (memory?.facts && memory.facts.length > 0)) && (
                <PressScale
                  onPress={handleForgetEverything}
                  disabled={updatingMemory}
                  style={styles.forgetScale}
                >
                  <View style={styles.forgetBtn}>
                    <Text style={styles.forgetBtnText}>🗑️ Forget Everything</Text>
                  </View>
                </PressScale>
              )}
            </>
          )}
        </View>
      )}

      {/* 3. Chat History & Transcripts Action Card */}
      {activeStudent && (
        <PressScale
          onPress={() => onOpenTranscript(activeStudent)}
          style={styles.actionCardScale}
          accessibilityRole="button"
          accessibilityLabel="View Chat Transcripts"
        >
          <View style={styles.actionCard}>
            <View style={styles.actionCardRow}>
              <View style={styles.actionIconBadge}>
                <Text style={styles.actionIcon}>📜</Text>
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>Chat History & Transcripts</Text>
                <Text style={styles.actionCardSub}>
                  Read past conversations and homework help for {activeStudent.student_name}
                </Text>
              </View>
              <Text style={styles.actionArrow}>→</Text>
            </View>
          </View>
        </PressScale>
      )}

      {/* 4. Subscription & Plan Action Card */}
      <PressScale
        onPress={onOpenPaywall}
        style={styles.actionCardScale}
        accessibilityRole="button"
        accessibilityLabel="Manage Subscription Plan"
      >
        <View style={styles.actionCard}>
          <View style={styles.actionCardRow}>
            <View
              style={[
                styles.actionIconBadge,
                isPremium && styles.actionIconBadgePremium,
              ]}
            >
              <Text style={styles.actionIcon}>{isPremium ? '⭐' : '📦'}</Text>
            </View>
            <View style={styles.actionCardContent}>
              <View style={styles.planTitleRow}>
                <Text style={styles.actionCardTitle}>Plan & Usage Allowance</Text>
                <View
                  style={[
                    styles.planPill,
                    isPremium ? styles.planPillPremium : styles.planPillFree,
                  ]}
                >
                  <Text
                    style={[
                      styles.planPillText,
                      isPremium ? styles.planPillTextPremium : styles.planPillTextFree,
                    ]}
                  >
                    {isPremium ? 'PREMIUM' : 'FREE'}
                  </Text>
                </View>
              </View>
              <Text style={styles.actionCardSub}>
                {isPremium
                  ? '100 min Voice/Video • 200 msgs • 15 scans / week'
                  : '10 min Voice/Video • 30 msgs • 3 scans / week'}
              </Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </View>
        </View>
      </PressScale>

      {/* 5. Sign Out Button */}
      <PressScale
        onPress={onRequestLogout}
        style={styles.signOutScale}
        accessibilityRole="button"
        accessibilityLabel="Sign out of parent account"
      >
        <View style={styles.signOutBtn}>
          <Text style={styles.signOutText}>🚪 Sign Out</Text>
        </View>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: 40,
    gap: 16,
  },
  navyHeader: {
    borderRadius: radii.xl,
    padding: 20,
    overflow: 'hidden',
    ...shadows.card,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  headerEmoji: {
    fontSize: 32,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: fontFamilies.black,
    color: colors.white,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: fontFamilies.semiBold,
    marginTop: 2,
  },
  childrenAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  childAvatarCol: {
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  childAvatarSquircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.cardBgMuted,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  childAvatarSquircleActive: {
    borderColor: colors.white,
    borderWidth: 3,
    shadowColor: colors.white,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  childAvatarEmoji: {
    fontSize: 26,
  },
  activeChildBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.coralStrong,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  activeChildBadgeCheck: {
    color: colors.white,
    fontSize: 10,
    fontFamily: fontFamilies.black,
  },
  childAvatarName: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
  childAvatarNameActive: {
    color: colors.white,
    fontFamily: fontFamilies.extraBold,
  },
  addChildSquircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  addChildSquircleActive: {
    borderColor: colors.white,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  addChildPlus: {
    fontSize: 22,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inlineAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  inlineAddInput: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  inlineAddBtn: {
    backgroundColor: colors.coralStrong,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  inlineAddBtnText: {
    color: colors.white,
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
  },
  inlineErrorText: {
    color: colors.errorBorder,
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.subtext,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  memoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  switchCol: {
    alignItems: 'center',
    marginTop: -2,
  },
  switchLabel: {
    fontSize: 10,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    marginTop: 2,
  },
  memoryErrorContainer: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.errorBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    marginTop: 10,
    alignItems: 'center',
    gap: 8,
  },
  memoryErrorText: {
    color: colors.error,
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.coralStrong,
    borderRadius: radii.pill,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: fontFamilies.extraBold,
  },
  preferredNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  preferredNameLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  nameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBgMuted,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  nameBadgeText: {
    fontSize: 12,
    fontFamily: fontFamilies.extraBold,
    color: colors.coralStrong,
  },
  nameBadgeRemoveBtn: {
    padding: 2,
  },
  nameBadgeRemoveText: {
    fontSize: 11,
    fontFamily: fontFamilies.black,
    color: colors.coralStrong,
  },
  factsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  factChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  factChipText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  factChipRemoveBtn: {
    padding: 2,
  },
  factChipRemoveText: {
    fontSize: 11,
    fontFamily: fontFamilies.black,
    color: colors.subtext,
  },
  noFactsText: {
    fontSize: 13,
    color: colors.subtext,
    fontStyle: 'italic',
    lineHeight: 18,
    paddingVertical: 6,
  },
  forgetScale: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  forgetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  forgetBtnText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.error,
  },
  actionCardScale: {
    width: '100%',
  },
  actionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.card,
  },
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBgMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBadgePremium: {
    backgroundColor: colors.warningBg,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionCardContent: {
    flex: 1,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionCardTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  actionCardSub: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 2,
    lineHeight: 16,
  },
  actionArrow: {
    fontSize: 18,
    fontFamily: fontFamilies.extraBold,
    color: colors.subtext,
  },
  planPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  planPillFree: {
    backgroundColor: colors.disabledBg,
  },
  planPillPremium: {
    backgroundColor: colors.sun,
  },
  planPillText: {
    fontSize: 10,
    fontFamily: fontFamilies.black,
  },
  planPillTextFree: {
    color: colors.subtext,
  },
  planPillTextPremium: {
    color: colors.text,
  },
  signOutScale: {
    width: '100%',
    marginTop: 6,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(217, 74, 74, 0.08)',
  },
  signOutText: {
    fontSize: 14,
    fontFamily: fontFamilies.extraBold,
    color: colors.error,
  },
});
