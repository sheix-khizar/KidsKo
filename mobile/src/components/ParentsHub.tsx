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
  ScrollView,
} from 'react-native';
import { LinearGradient } from '../ui';
import { Student } from '../screens/MainShellScreen';
import {
  getStudentMemory,
  updateStudentMemory,
  clearStudentMemory,
  createStudent,
  StudentMemoryData,
} from '../services/api';
import { isPremiumActive } from '../services/billing';
import { colors, radii, gradients } from '../theme';

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

type DashSubTab = 'overview' | 'history' | 'limits' | 'settings';

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
  const [subTab, setSubTab] = useState<DashSubTab>('overview');

  // Add child state
  const [newChildName, setNewChildName] = useState('');
  const [addingChild, setAddingChild] = useState(false);
  const [addChildError, setAddChildError] = useState<string | null>(null);

  // Memory state for active student
  const [memory, setMemory] = useState<StudentMemoryData | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [updatingMemory, setUpdatingMemory] = useState(false);

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
    try {
      const data = await getStudentMemory(studentId);
      setMemory(data);
    } catch (err: any) {
      console.warn('Failed to load memory:', err.message);
      setMemory({
        studentId,
        preferredName: null,
        facts: [],
        enabled: true,
      });
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
      {/* Prototype Navy Gradient Header */}
      <LinearGradient
        colors={gradients.parents}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerBanner}
      >
        <Text style={styles.dashboardTitle}>👨‍👩‍👧‍👦 Parent Dashboard</Text>
        <Text style={styles.dashboardSubtitle}>Manage your children's learning</Text>

        {/* Children avatar pills row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childrenPillsRow}
        >
          {students.map((st, idx) => {
            const isSelected = activeStudent?.id === st.id;
            return (
              <Pressable
                key={st.id}
                style={styles.childPillItem}
                onPress={() => onSelectStudent(st)}
                accessibilityRole="button"
                accessibilityLabel={`Select child ${st.student_name}`}
              >
                <LinearGradient
                  colors={idx % 2 === 0 ? gradients.primary : gradients.teal}
                  style={[
                    styles.childPillAvatar,
                    isSelected && styles.childPillAvatarActive,
                  ]}
                >
                  <Text style={styles.childPillEmoji}>{idx % 2 === 0 ? '👧' : '👦'}</Text>
                </LinearGradient>
                <Text
                  style={[
                    styles.childPillName,
                    isSelected && styles.childPillNameActive,
                  ]}
                >
                  {st.student_name}
                </Text>
              </Pressable>
            );
          })}

          {/* Add Child Pill Trigger */}
          <Pressable
            style={styles.childPillItem}
            onPress={() => setSubTab('settings')}
          >
            <View style={styles.addChildPillBox}>
              <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>➕</Text>
            </View>
            <Text style={styles.addChildPillLabel}>Add</Text>
          </Pressable>
        </ScrollView>

        {/* Sub-nav tabs */}
        <View style={styles.subNavBar}>
          <Pressable
            style={[styles.subNavBtn, subTab === 'overview' && styles.subNavBtnActive]}
            onPress={() => setSubTab('overview')}
          >
            <Text style={[styles.subNavText, subTab === 'overview' && styles.subNavTextActive]}>
              Overview
            </Text>
          </Pressable>

          <Pressable
            style={[styles.subNavBtn, subTab === 'history' && styles.subNavBtnActive]}
            onPress={() => setSubTab('history')}
          >
            <Text style={[styles.subNavText, subTab === 'history' && styles.subNavTextActive]}>
              History
            </Text>
          </Pressable>

          <Pressable
            style={[styles.subNavBtn, subTab === 'limits' && styles.subNavBtnActive]}
            onPress={() => setSubTab('limits')}
          >
            <Text style={[styles.subNavText, subTab === 'limits' && styles.subNavTextActive]}>
              Limits
            </Text>
          </Pressable>

          <Pressable
            style={[styles.subNavBtn, subTab === 'settings' && styles.subNavBtnActive]}
            onPress={() => setSubTab('settings')}
          >
            <Text style={[styles.subNavText, subTab === 'settings' && styles.subNavTextActive]}>
              Settings
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Body Content by SubTab */}
      <View style={styles.tabContentContainer}>
        {/* SUBTAB 1: OVERVIEW */}
        {subTab === 'overview' && (
          <View style={styles.subTabSection}>
            {/* 2x2 Metric Cards */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricEmoji}>⏱️</Text>
                <Text style={styles.metricValue}>42m</Text>
                <Text style={styles.metricLabel}>Learning Time</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricEmoji}>💬</Text>
                <Text style={styles.metricValue}>18</Text>
                <Text style={styles.metricLabel}>Questions Asked</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricEmoji}>🔬</Text>
                <Text style={styles.metricValue}>5</Text>
                <Text style={styles.metricLabel}>Topics Explored</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricEmoji}>⚡</Text>
                <Text style={styles.metricValue}>4 days</Text>
                <Text style={styles.metricLabel}>Active Streak 🔥</Text>
              </View>
            </View>

            {/* Topic Progress Card */}
            <View style={styles.cardBox}>
              <Text style={styles.cardHeading}>Topic Mastery</Text>
              <Text style={styles.cardSub}>Subjects {activeStudent?.student_name || 'child'} explored this week:</Text>

              <View style={styles.topicRow}>
                <View style={styles.topicHeader}>
                  <Text style={styles.topicName}>🔬 Science & Nature</Text>
                  <Text style={styles.topicPct}>85%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: '85%', backgroundColor: '#00B894' }]} />
                </View>
              </View>

              <View style={styles.topicRow}>
                <View style={styles.topicHeader}>
                  <Text style={styles.topicName}>🔢 Maths & Logic</Text>
                  <Text style={styles.topicPct}>60%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: '60%', backgroundColor: colors.orange }]} />
                </View>
              </View>

              <View style={styles.topicRow}>
                <View style={styles.topicHeader}>
                  <Text style={styles.topicName}>📚 Reading & English</Text>
                  <Text style={styles.topicPct}>75%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: '75%', backgroundColor: '#74B9FF' }]} />
                </View>
              </View>

              <View style={styles.topicRow}>
                <View style={styles.topicHeader}>
                  <Text style={styles.topicName}>🎨 Arts & History</Text>
                  <Text style={styles.topicPct}>40%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: '40%', backgroundColor: '#A78BFA' }]} />
                </View>
              </View>
            </View>

            {/* Quick Link to Transcripts */}
            {activeStudent && (
              <Pressable
                style={styles.actionCard}
                onPress={() => onOpenTranscript(activeStudent)}
              >
                <View style={styles.actionCardRow}>
                  <View style={styles.actionIconBadge}>
                    <Text style={{ fontSize: 22 }}>📜</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionCardTitle}>Read Full Learning Transcripts</Text>
                    <Text style={styles.actionCardSub}>
                      Review complete Q&A conversations and homework explanations
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>→</Text>
                </View>
              </Pressable>
            )}
          </View>
        )}

        {/* SUBTAB 2: HISTORY */}
        {subTab === 'history' && (
          <View style={styles.subTabSection}>
            {activeStudent ? (
              <View style={styles.cardBox}>
                <Text style={styles.cardHeading}>Learning Transcripts</Text>
                <Text style={styles.cardSub}>
                  Review conversations, questions, and homework explanations for {activeStudent.student_name}.
                </Text>

                <Pressable
                  style={styles.actionCard}
                  onPress={() => onOpenTranscript(activeStudent)}
                >
                  <View style={styles.actionCardRow}>
                    <View style={styles.actionIconBadge}>
                      <Text style={{ fontSize: 22 }}>📜</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionCardTitle}>Open Transcript Reader</Text>
                      <Text style={styles.actionCardSub}>
                        Filtered, cleaned and formatted for easy parental review
                      </Text>
                    </View>
                    <Text style={styles.actionArrow}>→</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.cardSub}>Select a child to view transcripts.</Text>
            )}
          </View>
        )}

        {/* SUBTAB 3: LIMITS & SUBSCRIPTION */}
        {subTab === 'limits' && (
          <View style={styles.subTabSection}>
            <View style={styles.cardBox}>
              <View style={styles.planHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardHeading}>Current Plan</Text>
                  <Text style={styles.cardSub}>Weekly usage and learning allowance</Text>
                </View>
                <View style={[styles.planPill, isPremium ? styles.planPillPremium : styles.planPillFree]}>
                  <Text style={[styles.planPillText, isPremium ? styles.planPillTextPremium : styles.planPillTextFree]}>
                    {isPremium ? 'PREMIUM' : 'FREE PLAN'}
                  </Text>
                </View>
              </View>

              <View style={styles.allowanceList}>
                <View style={styles.allowanceRow}>
                  <Text style={styles.allowanceLabel}>📞 Voice & Video Calls</Text>
                  <Text style={styles.allowanceVal}>
                    {isPremium ? '100 mins / week' : '10 mins / week'}
                  </Text>
                </View>
                <View style={styles.allowanceRow}>
                  <Text style={styles.allowanceLabel}>💬 AI Chat Questions</Text>
                  <Text style={styles.allowanceVal}>
                    {isPremium ? '200 msgs / week' : '30 msgs / week'}
                  </Text>
                </View>
                <View style={styles.allowanceRow}>
                  <Text style={styles.allowanceLabel}>📷 Homework Photo Scans</Text>
                  <Text style={styles.allowanceVal}>
                    {isPremium ? '15 scans / week' : '3 scans / week'}
                  </Text>
                </View>
              </View>

              <Pressable style={styles.upgradeBtn} onPress={onOpenPaywall}>
                <LinearGradient
                  colors={gradients.primary}
                  style={styles.upgradeBtnGradient}
                >
                  <Text style={styles.upgradeBtnText}>
                    {isPremium ? 'Manage Subscription ⭐' : 'Upgrade to Premium 🚀'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}

        {/* SUBTAB 4: SETTINGS & PRIVACY */}
        {subTab === 'settings' && (
          <View style={styles.subTabSection}>
            {/* Add Child Form */}
            <View style={styles.cardBox}>
              <Text style={styles.cardHeading}>Add Another Child</Text>
              <Text style={styles.cardSub}>Create a profile for a sibling to have their own chats:</Text>
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
                >
                  {addingChild ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.addChildBtnText}>+ Add</Text>
                  )}
                </Pressable>
              </View>
              {addChildError && <Text style={styles.errorText}>{addChildError}</Text>}
            </View>

            {/* What Kidsko Remembers */}
            {activeStudent && (
              <View style={styles.cardBox}>
                <View style={styles.memoryHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeading}>What Kidsko Remembers</Text>
                    <Text style={styles.cardSub}>
                      Learning preferences stored for {activeStudent.student_name}.
                    </Text>
                  </View>
                  <View style={styles.switchCol}>
                    <Switch
                      value={memory?.enabled ?? true}
                      onValueChange={handleToggleMemory}
                      trackColor={{ false: '#D1D5DB', true: '#00B894' }}
                      thumbColor="#FFFFFF"
                      disabled={loadingMemory || updatingMemory}
                    />
                    <Text style={styles.switchLabel}>
                      {memory?.enabled ? 'Active' : 'Off'}
                    </Text>
                  </View>
                </View>

                {loadingMemory ? (
                  <ActivityIndicator style={{ paddingVertical: 16 }} color={colors.coralStrong} />
                ) : (
                  <>
                    {memory?.preferredName && (
                      <View style={styles.preferredNameRow}>
                        <Text style={styles.preferredNameLabel}>Name to call {activeStudent.student_name}:</Text>
                        <View style={styles.nameBadge}>
                          <Text style={styles.nameBadgeText}>{memory.preferredName}</Text>
                          <Pressable
                            style={styles.nameBadgeRemoveBtn}
                            onPress={handleClearPreferredName}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          >
                            <Text style={styles.nameBadgeRemoveText}>✕</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    <View style={styles.factsContainer}>
                      {memory?.facts && memory.facts.length > 0 ? (
                        memory.facts.map((fact, index) => (
                          <View key={`${fact}_${index}`} style={styles.factChip}>
                            <Text style={styles.factChipText}>{fact}</Text>
                            <Pressable
                              style={styles.factChipRemoveBtn}
                              onPress={() => handleRemoveFact(index)}
                              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                              <Text style={styles.factChipRemoveText}>✕</Text>
                            </Pressable>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noFactsText}>
                          {memory?.enabled
                            ? `No facts stored yet. As ${activeStudent.student_name} chats, Kidsko will remember their grade and interests.`
                            : `Memory is switched off. Kidsko will not store facts across chats.`}
                        </Text>
                      )}
                    </View>

                    {Boolean(memory?.preferredName || (memory?.facts && memory.facts.length > 0)) && (
                      <Pressable
                        style={styles.forgetBtn}
                        onPress={handleForgetEverything}
                        disabled={updatingMemory}
                      >
                        <Text style={styles.forgetBtnText}>🗑️ Forget Everything</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Sign Out Button */}
            <Pressable style={styles.signOutBtn} onPress={onRequestLogout}>
              <Text style={styles.signOutText}>🚪 Sign Out</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  headerBanner: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 0,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  dashboardSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
    marginBottom: 16,
  },
  childrenPillsRow: {
    gap: 12,
    paddingBottom: 14,
  },
  childPillItem: {
    alignItems: 'center',
    gap: 6,
  },
  childPillAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  childPillAvatarActive: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  childPillEmoji: {
    fontSize: 26,
  },
  childPillName: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  childPillNameActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  addChildPillBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChildPillLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  subNavBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 4,
  },
  subNavBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  subNavBtnActive: {
    backgroundColor: '#F0F4F8',
  },
  subNavText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  subNavTextActive: {
    color: '#1E3A5F',
    fontWeight: '900',
  },
  tabContentContainer: {
    padding: 16,
  },
  subTabSection: {
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metricEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.subtext,
    marginTop: 2,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    color: colors.subtext,
    marginBottom: 14,
    fontWeight: '600',
  },
  topicRow: {
    marginBottom: 12,
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  topicName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  topicPct: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.subtext,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF4E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  actionCardSub: {
    fontSize: 11,
    color: colors.subtext,
    marginTop: 2,
    fontWeight: '600',
  },
  actionArrow: {
    fontSize: 18,
    color: colors.coralStrong,
    fontWeight: '900',
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planPill: {
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  planPillFree: {
    backgroundColor: '#F3F4F6',
  },
  planPillPremium: {
    backgroundColor: '#FEF08A',
  },
  planPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  planPillTextFree: {
    color: colors.subtext,
  },
  planPillTextPremium: {
    color: '#854D0E',
  },
  allowanceList: {
    gap: 10,
    marginBottom: 16,
  },
  allowanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  allowanceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  allowanceVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.coralStrong,
  },
  upgradeBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  upgradeBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  addChildRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addChildInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  addChildBtn: {
    backgroundColor: colors.coralStrong,
    borderRadius: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addChildBtnDisabled: {
    opacity: 0.6,
  },
  addChildBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  errorText: {
    color: colors.coralStrong,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  memoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchCol: {
    alignItems: 'center',
    marginLeft: 12,
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
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  preferredNameLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.subtext,
  },
  nameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEAEA',
    borderWidth: 1,
    borderColor: colors.coralStrong,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    fontSize: 12,
    fontWeight: '900',
    color: colors.coralStrong,
  },
  factsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  factChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  factChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  factChipRemoveBtn: {
    padding: 2,
  },
  factChipRemoveText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0284C7',
  },
  noFactsText: {
    fontSize: 12,
    color: colors.subtext,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  forgetBtn: {
    backgroundColor: '#FFEAEA',
    borderWidth: 1,
    borderColor: colors.coralStrong,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgetBtnText: {
    color: colors.coralStrong,
    fontSize: 13,
    fontWeight: '800',
  },
  signOutBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '900',
  },
});
