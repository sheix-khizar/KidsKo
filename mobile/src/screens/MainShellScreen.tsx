import { fontFamilies } from '../theme';
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
} from 'react-native';
import ChatScreen from './ChatScreen';
import ParentalGate from '../components/ParentalGate';
import ParentsHub from '../components/ParentsHub';
import { getStudents, createStudent, clearToken, getSavedUserId } from '../services/api';
import { configureBilling, isPremiumActive } from '../services/billing';
import { TabBar, TabKey } from '../ui/TabBar';
import { Screen, Mascot, Button, Card, Pill } from '../ui';
import { colors, radii, typography, spacing } from '../theme';

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
        // Auto-select first child if none selected or if active was removed
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

  // Re-check the plan after a purchase (the shell stays mounted behind the paywall)
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
      return false; // let OS exit app on chat tab
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [tab, showSwitcherModal]);

  // Tab change handler: re-lock parents tab whenever leaving it, refresh billing on call tab
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
      {/* Shell Header: Child Switcher Chip (non-chat tabs) */}
      {tab !== 'chat' && (
      <View style={[styles.shellHeader, { paddingTop: spacing.sm }]}>
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>Kidsko.ai 🦉</Text>
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
        {/* TAB 1: CHAT (Kept mounted to preserve scroll, draft text, and attachments across tabs) */}
        <View style={[{ flex: 1 }, tab !== 'chat' && { display: 'none' }]}>
          {students.length === 0 ? (
            // Ungated first-run empty state
            <ScrollView contentContainerStyle={styles.firstRunContent}>
              <Mascot size="l" style={styles.firstRunMascot} />
              <Text style={styles.firstRunTitle}>Welcome to Kidsko! 🦉</Text>
              <Text style={styles.firstRunSub}>
                Add your child's name to get started with friendly homework help and chats.
              </Text>

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
                  title="Add Child & Start Learning"
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
              onSwitchStudent={() => setShowSwitcherModal(true)}
            />
          ) : null}
        </View>

        {/* TAB 2: CALL */}
        {tab === 'call' && (
          <ScrollView contentContainerStyle={styles.callTabContent}>
            <View style={styles.callCardContainer}>
              <Card style={styles.callCard}>
                <Mascot size="l" style={styles.callMascot} />
                <Text style={styles.callTitle}>Talk to Kidsko 🦉</Text>
                <Text style={styles.callSubtitle}>
                  {activeStudent
                    ? `Ready to talk with ${activeStudent.student_name}? Speak naturally or show your homework!`
                    : 'Select a child to start your call.'}
                </Text>

                <View style={styles.callPillWrapper}>
                  <Pill
                    label={
                      isPremium
                        ? 'Premium plan: 100 Voice & Video minutes a week'
                        : 'Free plan: 10 Voice & Video minutes a week'
                    }
                    color={isPremium ? colors.mint : colors.cardBgMuted}
                    borderColor={isPremium ? colors.green : colors.border}
                  />
                </View>

                <Text style={styles.callHint}>
                  💡 You can turn your camera on during the call to show homework!
                </Text>

                <Button
                  title="📞 Start Call"
                  onPress={() => {
                    if (activeStudent) {
                      onStartCall(activeStudent);
                    }
                  }}
                  variant="primary"
                  style={styles.startCallButton}
                  disabled={!activeStudent}
                />
              </Card>
            </View>
          </ScrollView>
        )}

        {/* TAB 3: PARENTS */}
        {tab === 'parents' && (
          <>
            {!parentsUnlocked ? (
              <View style={styles.gateWrapper}>
                <ParentalGate
                  visible={true}
                  onSuccess={() => setParentsUnlocked(true)}
                  onCancel={() => setTab('chat')}
                />
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 60 }} bounces={false}>
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
          </>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    ...typography.subheading,
    fontFamily: fontFamilies.black,
    color: colors.coralStrong,
    letterSpacing: -0.5,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
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
    ...typography.label,
    fontSize: 13,
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
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  firstRunMascot: {
    marginBottom: spacing.md,
  },
  firstRunTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  firstRunSub: {
    ...typography.body,
    color: colors.subtext,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
  firstRunCard: {
    width: '100%',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  firstRunLabel: {
    ...typography.label,
    color: colors.text,
  },
  firstRunInput: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  firstRunErrorText: {
    ...typography.caption,
    color: colors.coralStrong,
    fontFamily: fontFamilies.bold,
  },
  callTabContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  callCardContainer: {
    alignItems: 'center',
  },
  callCard: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  callMascot: {
    marginBottom: spacing.xs,
  },
  callTitle: {
    ...typography.heading,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  callSubtitle: {
    ...typography.body,
    color: colors.subtext,
    textAlign: 'center',
    maxWidth: 290,
  },
  callPillWrapper: {
    marginVertical: spacing.xs,
  },
  callHint: {
    ...typography.caption,
    color: colors.subtext,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  startCallButton: {
    width: '100%',
    marginTop: spacing.sm,
  },
  gateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parentsContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  parentsTitle: {
    ...typography.heading,
    color: colors.text,
  },
  parentsSub: {
    ...typography.body,
    color: colors.subtext,
    marginBottom: spacing.sm,
  },
  parentsList: {
    gap: spacing.md,
  },
  actionCard: {
    padding: spacing.md,
  },
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCardIcon: {
    fontSize: 24,
  },
  actionCardTitle: {
    ...typography.label,
    color: colors.text,
  },
  actionCardSub: {
    ...typography.caption,
    color: colors.subtext,
    marginTop: 2,
  },
  actionCardArrow: {
    fontSize: 18,
    color: colors.subtext,
    fontFamily: fontFamilies.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  switcherSheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  switcherTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
  },
  switcherList: {
    gap: spacing.sm,
  },
  switcherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 12,
  },
  switcherItemActive: {
    borderColor: colors.coralStrong,
    backgroundColor: '#FFEAEA',
  },
  switcherItemIcon: {
    fontSize: 20,
  },
  switcherItemName: {
    ...typography.label,
    color: colors.text,
    flex: 1,
  },
  switcherItemNameActive: {
    color: colors.coralStrong,
    fontFamily: fontFamilies.extraBold,
  },
  checkmark: {
    fontSize: 16,
    color: colors.coralStrong,
    fontFamily: fontFamilies.extraBold,
  },
});
