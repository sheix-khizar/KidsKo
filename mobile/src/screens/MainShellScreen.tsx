import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ActivityIndicator,
  BackHandler,
  ScrollView,
  Platform,
} from 'react-native';
import ChatScreen from './ChatScreen';
import ParentalGate from '../components/ParentalGate';
import ParentsHub from '../components/ParentsHub';
import { getStudents, createStudent, clearToken, getSavedUserId } from '../services/api';
import { configureBilling, isPremiumActive } from '../services/billing';
import { TabBar, TabKey } from '../ui/TabBar';
import { Screen, Mascot, Button, Card, LinearGradient } from '../ui';
import { colors, radii, gradients } from '../theme';

export type Student = { id: string; student_name: string };

type Props = {
  onLogout: () => void;
  onOpenPaywall: () => void;
  onOpenTranscript: (student: Student) => void;
  onStartCall: (student: Student) => void;
  onLimitReached: () => void;
  billingVersion?: number;
};

export default function MainShellScreen({
  onLogout,
  onOpenPaywall,
  onOpenTranscript,
  onStartCall,
  onLimitReached,
  billingVersion = 0,
}: Props) {
  const [tab, setTab] = useState<TabKey>('chat');
  const [isPremium, setIsPremium] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Child switcher & First-run state
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const [firstRunName, setFirstRunName] = useState('');
  const [addingFirstRun, setAddingFirstRun] = useState(false);
  const [firstRunError, setFirstRunError] = useState<string | null>(null);

  // Parents tab gate state
  const [parentsUnlocked, setParentsUnlocked] = useState(false);
  const [logoutGateVisible, setLogoutGateVisible] = useState(false);

  const loadStudentList = async () => {
    try {
      const list = await getStudents();
      setStudents(list);
      if (list.length > 0) {
        setActiveStudent((prev) => {
          if (!prev || !list.some((s) => s.id === prev.id)) {
            return list[0];
          }
          return prev;
        });
      } else {
        setActiveStudent(null);
      }
    } catch (err: any) {
      console.warn('Failed to load students in shell:', err.message);
      if (err.status === 401 || err.message?.includes('expired') || err.message?.includes('Invalid')) {
        await clearToken();
        onLogout();
      }
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    (async () => {
      const savedUserId = await getSavedUserId();
      if (savedUserId) {
        configureBilling(savedUserId);
      }
      try {
        const prem = await isPremiumActive();
        setIsPremium(prem);
      } catch {}
    })();
    loadStudentList();
  }, []);

  // Re-check the plan after a purchase
  useEffect(() => {
    if (billingVersion === 0) return;
    isPremiumActive().then(setIsPremium).catch(() => {});
  }, [billingVersion]);

  // Handle hardware back on Android: return to 'chat' tab before exiting
  useEffect(() => {
    const onBackPress = () => {
      if (showSwitcherModal) {
        setShowSwitcherModal(false);
        return true;
      }
      if (tab !== 'chat') {
        setTab('chat');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [tab, showSwitcherModal]);

  // Tab change handler
  const handleTabSelect = (nextTab: TabKey) => {
    if (tab === 'parents' && nextTab !== 'parents') {
      setParentsUnlocked(false);
    }
    if (nextTab === 'call') {
      isPremiumActive().then(setIsPremium).catch(() => {});
    }
    setTab(nextTab);
  };

  // First-run ungated child creation
  const handleAddFirstChild = async () => {
    const trimmed = firstRunName.trim();
    if (!trimmed) {
      setFirstRunError('Please enter a name.');
      return;
    }
    setAddingFirstRun(true);
    setFirstRunError(null);
    try {
      const res = await createStudent(trimmed);
      setFirstRunName('');
      const updatedList = await getStudents();
      setStudents(updatedList);
      if (res && res.student) {
        setActiveStudent(res.student);
      } else if (updatedList.length > 0) {
        setActiveStudent(updatedList[0]);
      }
    } catch (err: any) {
      setFirstRunError(err.message || 'Failed to add child.');
    } finally {
      setAddingFirstRun(false);
    }
  };

  if (loadingStudents) {
    return (
      <Screen>
        <View style={styles.centerContainer}>
          <Mascot size="m" />
          <ActivityIndicator size="small" color={colors.coralStrong} style={{ marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeBottom={false}>
      {/* Shell Header: only shown on non-chat tabs when active child is present */}
      {tab !== 'chat' && tab !== 'call' && (
        <View style={styles.shellHeader}>
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>
              Kidsko<Text style={{ color: colors.sun }}>.ai</Text> 🦉
            </Text>
          </View>

          {activeStudent && (
            <Pressable
              style={styles.childChip}
              onPress={() => setShowSwitcherModal(true)}
              accessibilityRole="button"
              accessibilityLabel={`Active child is ${activeStudent.student_name}. Tap to switch.`}
            >
              <Text style={styles.childChipIcon}>🧒</Text>
              <Text style={styles.childChipName} numberOfLines={1}>
                {activeStudent.student_name}
              </Text>
              <Text style={styles.childChipArrow}>▼</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Main Tab Body */}
      <View style={styles.bodyContainer}>
        {/* TAB 1: CHAT */}
        <View style={[{ flex: 1 }, tab !== 'chat' && { display: 'none' }]}>
          {students.length === 0 ? (
            <ScrollView contentContainerStyle={styles.firstRunContent}>
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.firstRunBanner}
              >
                <Text style={{ fontSize: 50, marginBottom: 8 }}>🦉</Text>
                <Text style={styles.firstRunTitle}>Welcome to Kidsko! 🎉</Text>
                <Text style={styles.firstRunSub}>
                  Add your child's name to get started with friendly homework help and chats.
                </Text>
              </LinearGradient>

              <Card style={styles.firstRunCard}>
                <Text style={styles.firstRunLabel}>Child's Name</Text>
                <TextInput
                  style={styles.firstRunInput}
                  placeholder="e.g. Aisha"
                  placeholderTextColor={colors.subtext}
                  value={firstRunName}
                  onChangeText={setFirstRunName}
                />
                {firstRunError && (
                  <Text style={styles.firstRunErrorText}>{firstRunError}</Text>
                )}
                <Button
                  title="Add Child & Start Learning 🚀"
                  onPress={handleAddFirstChild}
                  loading={addingFirstRun}
                  variant="primary"
                  style={{ marginTop: 8 }}
                />
              </Card>
            </ScrollView>
          ) : activeStudent ? (
            <ChatScreen
              key={activeStudent.id}
              studentId={activeStudent.id}
              studentName={activeStudent.student_name}
              embedded={true}
              onBack={() => {}}
              onLimitReached={onLimitReached}
            />
          ) : null}
        </View>

        {/* TAB 2: CALL (Prototype Dark Theme) */}
        {tab === 'call' && (
          <LinearGradient
            colors={gradients.callDark}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.callContainer}
          >
            <ScrollView
              contentContainerStyle={styles.callScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Mascot Badge */}
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.callMascotBox}
              >
                <Text style={styles.callMascotEmoji}>🦉</Text>
              </LinearGradient>

              <Text style={styles.callMainTitle}>Talk to Kidsko!</Text>
              <Text style={styles.callSubtitle}>
                Choose how you want to talk to me today 👇
              </Text>

              {/* Plan Allowance Pill */}
              <View style={styles.callPlanBadge}>
                <Text style={styles.callPlanText}>
                  {isPremium
                    ? '⭐ Premium: 100 Voice & Video mins / week'
                    : '💬 Free: 10 Voice & Video mins / week'}
                </Text>
              </View>

              {/* Voice Call Card */}
              <Pressable
                style={({ pressed }) => [
                  styles.callOptionCard,
                  pressed && styles.callOptionCardPressed,
                ]}
                onPress={() => {
                  if (activeStudent) {
                    onStartCall(activeStudent);
                  }
                }}
                disabled={!activeStudent}
              >
                <LinearGradient
                  colors={gradients.primary}
                  style={styles.optionIconBox}
                >
                  <Text style={styles.optionIconEmoji}>🎤</Text>
                </LinearGradient>

                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Voice Call</Text>
                  <Text style={styles.optionDesc}>
                    Talk and listen to Kidsko{'\n'}like a phone call 📞
                  </Text>
                </View>

                <View style={styles.chevronBox}>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </Pressable>

              {/* AI Vision Card */}
              <Pressable
                style={({ pressed }) => [
                  styles.visionOptionCard,
                  pressed && styles.callOptionCardPressed,
                ]}
                onPress={() => {
                  if (activeStudent) {
                    onStartCall(activeStudent);
                  }
                }}
                disabled={!activeStudent}
              >
                <LinearGradient
                  colors={gradients.teal}
                  style={styles.optionIconBox}
                >
                  <Text style={styles.optionIconEmoji}>👁️</Text>
                </LinearGradient>

                <View style={styles.optionContent}>
                  <View style={styles.visionTitleRow}>
                    <Text style={styles.optionTitle}>AI Vision</Text>
                    <LinearGradient
                      colors={gradients.teal}
                      style={styles.newBadge}
                    >
                      <Text style={styles.newBadgeText}>NEW ✨</Text>
                    </LinearGradient>
                  </View>
                  <Text style={styles.optionDesc}>
                    Point camera at anything{'\n'}Kidsko will explain it! 📷🔍
                  </Text>
                </View>

                <View style={styles.chevronBox}>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </Pressable>

              {/* Tip Card */}
              <View style={styles.tipCard}>
                <Text style={styles.tipIcon}>💡</Text>
                <Text style={styles.tipText}>
                  Tip: Use <Text style={{ color: '#4ECDC4', fontWeight: '800' }}>AI Vision</Text> to point at your homework and Kidsko will help you!
                </Text>
              </View>
            </ScrollView>
          </LinearGradient>
        )}

        {/* TAB 3: PARENTS */}
        {tab === 'parents' && (
          <View style={{ flex: 1 }}>
            {!parentsUnlocked ? (
              <View style={styles.gateWrapper}>
                <ParentalGate
                  visible={true}
                  onSuccess={() => setParentsUnlocked(true)}
                  onCancel={() => setTab('chat')}
                />
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={{ paddingBottom: 60 }}
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                <ParentsHub
                  students={students}
                  activeStudent={activeStudent}
                  onSelectStudent={(st) => setActiveStudent(st)}
                  onRefreshStudents={loadStudentList}
                  onOpenTranscript={onOpenTranscript}
                  onOpenPaywall={onOpenPaywall}
                  onRequestLogout={() => setLogoutGateVisible(true)}
                  billingVersion={billingVersion}
                />

                {/* Logout Parental Gate */}
                <ParentalGate
                  visible={logoutGateVisible}
                  onSuccess={async () => {
                    setLogoutGateVisible(false);
                    await clearToken();
                    onLogout();
                  }}
                  onCancel={() => setLogoutGateVisible(false)}
                />
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Child Switcher Bottom Modal */}
      <Modal
        visible={showSwitcherModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSwitcherModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSwitcherModal(false)}
        >
          <Pressable style={styles.switcherSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.switcherTitle}>Switch Student 🧒</Text>
            <View style={styles.switcherList}>
              {students.map((st) => {
                const isSelected = activeStudent?.id === st.id;
                return (
                  <Pressable
                    key={st.id}
                    style={[
                      styles.switcherItem,
                      isSelected && styles.switcherItemActive,
                    ]}
                    onPress={() => {
                      setActiveStudent(st);
                      setShowSwitcherModal(false);
                    }}
                  >
                    <Text style={styles.switcherItemIcon}>🧒</Text>
                    <Text
                      style={[
                        styles.switcherItemName,
                        isSelected && styles.switcherItemNameActive,
                      ]}
                    >
                      {st.student_name}
                    </Text>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
            <Button
              title="Close"
              onPress={() => setShowSwitcherModal(false)}
              variant="ghost"
              style={{ marginTop: 12 }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bottom Tab Bar */}
      <TabBar activeTab={tab} onSelectTab={handleTabSelect} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.coralStrong,
    letterSpacing: -0.5,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    maxWidth: 160,
  },
  childChipIcon: {
    fontSize: 14,
  },
  childChipName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    maxWidth: 90,
  },
  childChipArrow: {
    fontSize: 10,
    color: colors.subtext,
  },
  bodyContainer: {
    flex: 1,
  },
  firstRunContent: {
    padding: 24,
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  firstRunBanner: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  firstRunTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  firstRunSub: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },
  firstRunCard: {
    width: '100%',
    padding: 20,
    gap: 12,
  },
  firstRunLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  firstRunInput: {
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  firstRunErrorText: {
    color: colors.coralStrong,
    fontWeight: '700',
    fontSize: 13,
  },

  // Call Screen Prototype Styles
  callContainer: {
    flex: 1,
  },
  callScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  callMascotBox: {
    width: 100,
    height: 100,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 8,
  },
  callMascotEmoji: {
    fontSize: 54,
  },
  callMainTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  callSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  callPlanBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 24,
  },
  callPlanText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFE66D',
  },
  callOptionCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  visionOptionCard: {
    width: '100%',
    backgroundColor: 'rgba(78, 205, 196, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(78, 205, 196, 0.3)',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  callOptionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  optionIconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  optionIconEmoji: {
    fontSize: 30,
  },
  optionContent: {
    flex: 1,
  },
  visionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  newBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  optionDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 17,
  },
  chevronBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 20,
    fontWeight: '700',
  },
  tipCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tipIcon: {
    fontSize: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 17,
  },

  gateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  switcherSheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    gap: 14,
  },
  switcherTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  switcherList: {
    gap: 8,
  },
  switcherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 12,
  },
  switcherItemActive: {
    borderColor: colors.coralStrong,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  switcherItemIcon: {
    fontSize: 20,
  },
  switcherItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  switcherItemNameActive: {
    color: colors.coralStrong,
    fontWeight: '900',
  },
  checkmark: {
    fontSize: 16,
    color: colors.coralStrong,
    fontWeight: '900',
  },
});
