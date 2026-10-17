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
import { LinearGradient } from '../ui/LinearGradient';
import { Screen, Mascot, Button, Card, Pill, FadeSlideIn, Bounce, PressScale } from '../ui';
import { colors, radii, typography, spacing, gradients } from '../theme';

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

        {/* TAB 2: CALL (Prototype dark call design) */}
        {tab === 'call' && (
          <FadeSlideIn key="call" duration={180} style={{ flex: 1 }}>
            <LinearGradient
              colors={gradients.callDark.colors}
              start={gradients.callDark.start}
              end={gradients.callDark.end}
              style={StyleSheet.absoluteFill}
            />

            {/* Soft decorative background orb */}
            <View style={styles.callBackdropOrb} pointerEvents="none" />

            <ScrollView
              contentContainerStyle={styles.callTabContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.callHeaderCenter}>
                <Bounce>
                  <LinearGradient
                    colors={gradients.primary.colors}
                    start={gradients.primary.start}
                    end={gradients.primary.end}
                    style={styles.callMascotBadge}
                  >
                    <Text style={styles.callMascotEmoji}>🦉</Text>
                  </LinearGradient>
                </Bounce>
                <Text style={styles.callTitle}>Talk to Kidsko!</Text>
                <Text style={styles.callSubtitle}>
                  {activeStudent
                    ? `Ready to talk with ${activeStudent.student_name}? Speak naturally or show your homework!`
                    : 'Choose how you want to talk to me today 👇'}
                </Text>
              </View>

              {/* The Single "Start Call" Action Card */}
              <PressScale
                style={styles.callActionCardScale}
                onPress={() => {
                  if (activeStudent) {
                    onStartCall(activeStudent);
                  }
                }}
                disabled={!activeStudent}
              >
                <View style={styles.callActionCard}>
                  <LinearGradient
                    colors={gradients.primary.colors}
                    start={gradients.primary.start}
                    end={gradients.primary.end}
                    style={styles.callIconSquircle}
                  >
                    <Text style={styles.callIconEmoji}>🎙️</Text>
                  </LinearGradient>
                  <View style={styles.callActionInfo}>
                    <Text style={styles.callActionTitle}>Voice & Video Call</Text>
                    <Text style={styles.callActionSub}>
                      Talk & listen naturally, or show homework with camera 📷
                    </Text>
                  </View>
                  <View style={styles.callArrowCircle}>
                    <Text style={styles.callArrowText}>›</Text>
                  </View>
                </View>
              </PressScale>

              {/* Plan usage pill from real billing state */}
              <View style={styles.callPillContainer}>
                <View style={styles.callPlanPill}>
                  <Text style={styles.callPlanIcon}>{isPremium ? '⭐' : '⏱️'}</Text>
                  <Text style={styles.callPlanText}>
                    {isPremium
                      ? 'Premium: 100 mins weekly Voice & Video'
                      : 'Free: 10 mins weekly Voice & Video'}
                  </Text>
                </View>
              </View>

              {/* Tip Card */}
              <View style={styles.callTipCard}>
                <Text style={styles.callTipIcon}>💡</Text>
                <Text style={styles.callTipText}>
                  Tip: Tap the camera icon anytime in-call to show your worksheet to Kidsko!
                </Text>
              </View>
            </ScrollView>
          </FadeSlideIn>
        )}

        {/* TAB 3: PARENTS */}
        {tab === 'parents' && (
          <FadeSlideIn key="parents" duration={180} style={{ flex: 1 }}>
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
          </FadeSlideIn>
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
  callBackdropOrb: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  callTabContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 48,
    alignItems: 'center',
  },
  callHeaderCenter: {
    alignItems: 'center',
    marginBottom: 28,
  },
  callMascotBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.coral,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  callMascotEmoji: {
    fontSize: 48,
  },
  callTitle: {
    ...typography.heading,
    fontSize: 28,
    fontFamily: fontFamilies.black,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  callSubtitle: {
    ...typography.body,
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  callActionCardScale: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 16,
  },
  callActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
  },
  callIconSquircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  callIconEmoji: {
    fontSize: 24,
  },
  callActionInfo: {
    flex: 1,
    marginRight: 8,
  },
  callActionTitle: {
    ...typography.subheading,
    fontSize: 17,
    fontFamily: fontFamilies.extraBold,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  callActionSub: {
    ...typography.caption,
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
  },
  callArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callArrowText: {
    fontSize: 22,
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    marginTop: -2,
  },
  callPillContainer: {
    marginBottom: 16,
  },
  callPlanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  callPlanIcon: {
    fontSize: 14,
  },
  callPlanText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  callTipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    maxWidth: 340,
  },
  callTipIcon: {
    fontSize: 18,
  },
  callTipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 17,
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
