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
  clearStudentMemory,
  createStudent,
  StudentMemoryData,
} from '../services/api';
import { isPremiumActive } from '../services/billing';
import { colors, radii, spacing, typography } from '../theme';

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
              await clearStudentMemory(activeStudent.id);
              setMemory({
                studentId: activeStudent.id,
                preferredName: null,
                facts: [],
                enabled: memory?.enabled ?? true,
              });
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to clear memory');
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
      {/* 1. Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Parents Hub 🔒</Text>
        <Text style={styles.subtitle}>
          Manage your family, review past learning, and control child privacy.
        </Text>
      </View>

      {/* 2. Children Management Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeading}>Family & Children</Text>
        <Text style={styles.sectionSub}>Select a child to view transcripts or adjust settings:</Text>

        <View style={styles.childrenChips}>
          {students.map((st) => {
            const isSelected = activeStudent?.id === st.id;
            return (
              <Pressable
                key={st.id}
                style={[styles.childChip, isSelected && styles.childChipActive]}
                onPress={() => onSelectStudent(st)}
                accessibilityRole="button"
                accessibilityLabel={`Select child ${st.student_name}`}
              >
                <Text style={styles.childChipIcon}>🧒</Text>
                <Text style={[styles.childChipText, isSelected && styles.childChipTextActive]}>
                  {st.student_name}
                </Text>
                {isSelected && <Text style={styles.childChipCheck}>✓</Text>}
              </Pressable>
            );
          })}
        </View>

        {/* Add Another Child Form */}
        <View style={styles.addChildRow}>
          <TextInput
            style={styles.addChildInput}
            placeholder="Child's name"
            placeholderTextColor={colors.subtext}
            value={newChildName}
            onChangeText={(txt) => {
              setNewChildName(txt);
              if (addChildError) setAddChildError(null);
            }}
            maxLength={30}
          />
          <Pressable
            style={[styles.addChildBtn, addingChild && styles.addChildBtnDisabled]}
            onPress={handleAddChild}
            disabled={addingChild}
            accessibilityRole="button"
            accessibilityLabel="Add another child"
          >
            {addingChild ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.addChildBtnText}>+ Add</Text>
            )}
          </Pressable>
        </View>
        {addChildError && <Text style={styles.errorText}>{addChildError}</Text>}
      </View>

      {/* 3. What Kidsko Remembers (Stage 10 / Step 4.5) */}
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
                  trackColor={{ false: '#D1D5DB', true: colors.green }}
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
              <Pressable
                style={styles.retryBtn}
                onPress={() => fetchMemory(activeStudent.id)}
                accessibilityRole="button"
                accessibilityLabel="Retry loading memory"
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Preferred Name Tag */}
              {memory?.preferredName && (
                <View style={styles.preferredNameRow}>
                  <Text style={styles.preferredNameLabel}>Name to call {activeStudent.student_name}:</Text>
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
                  memory.facts.map((fact, index) => (
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
                  ))
                ) : (
                  <Text style={styles.noFactsText}>
                    {memory?.enabled
                      ? `No specific facts recorded yet. As ${activeStudent.student_name} chats, Kidsko will remember their grade and interests.`
                      : `Memory is switched off. Kidsko will not store or use facts across chats.`}
                  </Text>
                )}
              </View>

              {/* Forget Everything Button — visible whenever any preferred name OR facts are stored */}
              {Boolean(memory?.preferredName || (memory?.facts && memory.facts.length > 0)) && (
                <Pressable
                  style={styles.forgetBtn}
                  onPress={handleForgetEverything}
                  disabled={updatingMemory}
                  accessibilityRole="button"
                  accessibilityLabel="Forget everything"
                >
                  <Text style={styles.forgetBtnText}>🗑️ Forget Everything</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}

      {/* 4. Chat History & Transcripts */}
      {activeStudent && (
        <Pressable
          style={styles.actionCard}
          onPress={() => onOpenTranscript(activeStudent)}
          accessibilityRole="button"
          accessibilityLabel="View Chat Transcripts"
        >
          <View style={styles.actionCardRow}>
            <View style={styles.actionIconBadge}>
              <Text style={styles.actionIcon}>📜</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionCardTitle}>Chat History & Transcripts</Text>
              <Text style={styles.actionCardSub}>
                Read past conversations and homework help for {activeStudent.student_name}
              </Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </View>
        </Pressable>
      )}

      {/* 5. Subscription & Plan */}
      <Pressable
        style={styles.actionCard}
        onPress={onOpenPaywall}
        accessibilityRole="button"
        accessibilityLabel="Manage Subscription Plan"
      >
        <View style={styles.actionCardRow}>
          <View style={[styles.actionIconBadge, isPremium && styles.actionIconBadgePremium]}>
            <Text style={styles.actionIcon}>{isPremium ? '⭐' : '📦'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.actionCardTitle}>Plan & Usage Allowance</Text>
              <View style={[styles.planPill, isPremium ? styles.planPillPremium : styles.planPillFree]}>
                <Text style={[styles.planPillText, isPremium ? styles.planPillTextPremium : styles.planPillTextFree]}>
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
      </Pressable>

      {/* 6. Sign Out */}
      <Pressable
        style={styles.signOutBtn}
        onPress={onRequestLogout}
        accessibilityRole="button"
        accessibilityLabel="Sign out of parent account"
      >
        <Text style={styles.signOutText}>🚪 Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.subtext,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.subtext,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  childrenChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.cardBgMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 6,
  },
  childChipActive: {
    backgroundColor: '#FFF2EB',
    borderColor: colors.coralStrong,
  },
  childChipIcon: {
    fontSize: 14,
  },
  childChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  childChipTextActive: {
    color: colors.coralStrong,
    fontWeight: '800',
  },
  childChipCheck: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.coralStrong,
  },
  addChildRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addChildInput: {
    flex: 1,
    height: 44,
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  addChildBtn: {
    backgroundColor: colors.parentNavy,
    paddingHorizontal: 16,
    height: 44,
    minHeight: 44,
    minWidth: 44,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addChildBtnDisabled: {
    opacity: 0.6,
  },
  addChildBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  memoryErrorContainer: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFF2F2',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#FFD1D1',
    marginTop: 10,
    alignItems: 'center',
    gap: 8,
  },
  memoryErrorText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '800',
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
    fontWeight: '700',
    color: colors.subtext,
    marginTop: 2,
  },
  preferredNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  preferredNameLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.subtext,
  },
  nameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2EB',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#FBD3C1',
    gap: 6,
  },
  nameBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.coralStrong,
  },
  nameBadgeRemoveBtn: {
    padding: 2,
  },
  nameBadgeRemoveText: {
    fontSize: 11,
    fontWeight: '900',
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
    backgroundColor: '#EEF2F6',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D8E2EC',
    gap: 6,
  },
  factChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  factChipRemoveBtn: {
    padding: 2,
  },
  factChipRemoveText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.subtext,
  },
  noFactsText: {
    fontSize: 13,
    color: colors.subtext,
    fontStyle: 'italic',
    lineHeight: 18,
    paddingVertical: 6,
  },
  forgetBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  forgetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
  },
  actionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
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
    backgroundColor: '#FFF8E1',
  },
  actionIcon: {
    fontSize: 20,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
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
    fontWeight: '800',
    color: colors.subtext,
  },
  planPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  planPillFree: {
    backgroundColor: '#E2E8F0',
  },
  planPillPremium: {
    backgroundColor: colors.sun,
  },
  planPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  planPillTextFree: {
    color: colors.subtext,
  },
  planPillTextPremium: {
    color: colors.text,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(217, 74, 74, 0.08)',
    marginTop: 6,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.error,
  },
});
