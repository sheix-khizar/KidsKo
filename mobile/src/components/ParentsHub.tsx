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
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { Student } from '../screens/MainShellScreen';
import {
  getStudentMemory,
  updateStudentMemory,
  createStudent,
  updateStudent,
  deleteStudent,
  deleteAccount,
  clearToken,
  updateParentPassword,
  updateParentEmail,
  requestPasswordChangeOtp,
  confirmPasswordChangeOtp,
  requestEmailChangeOtp,
  confirmEmailChangeOtp,
  forgotPassword,
  resetPasswordWithOtp,
  getCurrentUserEmail,
  StudentMemoryData,
  getStudentActivity,
  StudentActivityData,
  pruneChatRetention,
  getChatThreads,
  ChatThreadSummary,
} from '../services/api';
import * as SecureStore from 'expo-secure-store';
import { isPremiumActive } from '../services/billing';
import { colors, radii, spacing, fontFamilies, gradients, shadows } from '../theme';
import { LinearGradient } from '../ui/LinearGradient';
import { PressScale, FadeSlideIn } from '../ui/motion';
import ParentalGate from './ParentalGate';

type SubTab = 'overview' | 'history' | 'limits' | 'settings';

type Props = {
  students: Student[];
  activeStudent: Student | null;
  onSelectStudent: (student: Student) => void;
  onRefreshStudents: () => Promise<Student[] | void>;
  onOpenTranscript: (student: Student, thread?: { id: string; title: string }) => void;
  onOpenPaywall: () => void;
  onRequestLogout: () => void;
  onRequestClose?: () => void;
  onAccountDeleted?: () => void;
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
  onRequestClose,
  onAccountDeleted,
  billingVersion = 0,
}: Props) {
  // Navigation Sub-tab
  const [currentTab, setCurrentTab] = useState<SubTab>('overview');

  // Add Child Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState('');
  const [newChildGrade, setNewChildGrade] = useState('Grade 1');
  const [addingChild, setAddingChild] = useState(false);
  const [addChildError, setAddChildError] = useState<string | null>(null);

  // Edit Child Modal State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editChildName, setEditChildName] = useState('');
  const [updatingChild, setUpdatingChild] = useState(false);
  const [editChildError, setEditChildError] = useState<string | null>(null);

  // Activity State
  const [activity, setActivity] = useState<StudentActivityData | null>(null);
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);

  // Active Subscription Plan State
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [localStudents, setLocalStudents] = useState<Student[]>(students);

  // Parent Account Management State
  const [parentEmail, setParentEmail] = useState<string>('');
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState<boolean>(false);
  const [passwordStep, setPasswordStep] = useState<'form' | 'otp'>('form');
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState<boolean>(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [passwordOtpInput, setPasswordOtpInput] = useState<string>('');
  const [passwordResendTimer, setPasswordResendTimer] = useState<number>(0);
  const [updatingPassword, setUpdatingPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [changeEmailModalVisible, setChangeEmailModalVisible] = useState<boolean>(false);
  const [emailStep, setEmailStep] = useState<'form' | 'otp'>('form');
  const [newEmailInput, setNewEmailInput] = useState<string>('');
  const [confirmEmailInput, setConfirmEmailInput] = useState<string>('');
  const [emailPasswordInput, setEmailPasswordInput] = useState<string>('');
  const [emailOtpInput, setEmailOtpInput] = useState<string>('');
  const [emailResendTimer, setEmailResendTimer] = useState<number>(0);
  const [updatingEmail, setUpdatingEmail] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (passwordResendTimer <= 0) return;
    const t = setInterval(() => setPasswordResendTimer((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [passwordResendTimer]);

  useEffect(() => {
    if (emailResendTimer <= 0) return;
    const t = setInterval(() => setEmailResendTimer((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [emailResendTimer]);

  useEffect(() => {
    getCurrentUserEmail().then((em) => {
      if (em) setParentEmail(em);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLocalStudents(students);
  }, [students]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const active = await isPremiumActive();
        if (isMounted) setIsPremium(active);
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, [billingVersion]);

  // Conversations History State
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Limits State
  const [dailyLimit, setDailyLimit] = useState<number | 'infinity'>(30);
  const [schoolHours, setSchoolHours] = useState<boolean>(true);
  const [eveningStudy, setEveningStudy] = useState<boolean>(true);
  const [weekendLearning, setWeekendLearning] = useState<boolean>(false);

  // Safety & Controls State
  const [allowCamera, setAllowCamera] = useState<boolean>(true);
  const [curfewEnabled, setCurfewEnabled] = useState<boolean>(false);
  const [chatRetention, setChatRetention] = useState<'30' | '90' | 'forever'>('forever');

  // Notifications State
  const [dailyReport, setDailyReport] = useState<boolean>(true);
  const [limitAlerts, setLimitAlerts] = useState<boolean>(true);

  // Student Memory State
  const [memory, setMemory] = useState<StudentMemoryData | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [updatingMemory, setUpdatingMemory] = useState(false);

  // PIN & Deletion Gate State
  const [deleteGateVisible, setDeleteGateVisible] = useState<boolean>(false);
  const [pendingDeleteType, setPendingDeleteType] = useState<'child' | 'account' | null>(null);
  const [childToDelete, setChildToDelete] = useState<Student | null>(null);
  const [deletingChild, setDeletingChild] = useState<boolean>(false);
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [accountDeleteModalVisible, setAccountDeleteModalVisible] = useState<boolean>(false);
  const [accountDeletePassword, setAccountDeletePassword] = useState<string>('');
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null);
  const [changePinVisible, setChangePinVisible] = useState<boolean>(false);

  // Load Settings from SecureStore
  useEffect(() => {
    (async () => {
      try {
        const savedCam = await SecureStore.getItemAsync('kidsko_parent_allow_camera');
        if (savedCam !== null) setAllowCamera(savedCam === 'true');

        const savedCurfew = await SecureStore.getItemAsync('kidsko_parent_curfew');
        if (savedCurfew !== null) setCurfewEnabled(savedCurfew === 'true');

        const savedRet = await SecureStore.getItemAsync('kidsko_parent_chat_retention');
        if (savedRet === '30' || savedRet === '90' || savedRet === 'forever') {
          setChatRetention(savedRet);
        }

        const savedSchool = await SecureStore.getItemAsync('kidsko_parent_school_hours');
        if (savedSchool !== null) setSchoolHours(savedSchool === 'true');

        const savedEvening = await SecureStore.getItemAsync('kidsko_parent_evening_study');
        if (savedEvening !== null) setEveningStudy(savedEvening === 'true');

        const savedWeekend = await SecureStore.getItemAsync('kidsko_parent_weekend_learning');
        if (savedWeekend !== null) setWeekendLearning(savedWeekend === 'true');

        const savedDailyReport = await SecureStore.getItemAsync('kidsko_parent_daily_report');
        if (savedDailyReport !== null) setDailyReport(savedDailyReport === 'true');

        const savedLimitAlerts = await SecureStore.getItemAsync('kidsko_parent_limit_alerts');
        if (savedLimitAlerts !== null) setLimitAlerts(savedLimitAlerts === 'true');
      } catch {}
    })();
  }, []);

  // Load per-student limit & activity & threads
  useEffect(() => {
    if (activeStudent) {
      // Load daily limit for active child
      SecureStore.getItemAsync(`kidsko_limit_${activeStudent.id}`).then((val) => {
        if (val === 'infinity') setDailyLimit('infinity');
        else if (val) {
          const num = parseInt(val, 10);
          if (!isNaN(num)) setDailyLimit(num);
        } else {
          setDailyLimit(30);
        }
      }).catch(() => {});

      // Fetch real activity
      fetchActivity(activeStudent.id);

      // Fetch memory
      fetchMemory(activeStudent.id);

      // Fetch threads
      fetchThreads(activeStudent.id);
    } else {
      setActivity(null);
      setMemory(null);
      setThreads([]);
    }
  }, [activeStudent?.id]);

  const fetchActivity = async (studentId: string) => {
    setLoadingActivity(true);
    try {
      const act = await getStudentActivity(studentId);
      setActivity(act);
    } catch {
      setActivity(null);
    } finally {
      setLoadingActivity(false);
    }
  };

  const fetchMemory = async (studentId: string) => {
    setLoadingMemory(true);
    try {
      const data = await getStudentMemory(studentId);
      setMemory(data);
    } catch {
      setMemory(null);
    } finally {
      setLoadingMemory(false);
    }
  };

  const fetchThreads = async (studentId: string) => {
    setLoadingThreads(true);
    try {
      const thList = await getChatThreads(studentId);
      setThreads(thList);
    } catch {
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  };

  // Toggle Handlers
  const handleToggleCamera = async (val: boolean) => {
    setAllowCamera(val);
    try {
      await SecureStore.setItemAsync('kidsko_parent_allow_camera', val ? 'true' : 'false');
    } catch {}
  };

  const handleToggleCurfew = async (val: boolean) => {
    setCurfewEnabled(val);
    try {
      await SecureStore.setItemAsync('kidsko_parent_curfew', val ? 'true' : 'false');
    } catch {}
  };

  const handleChangeRetention = async (val: '30' | '90' | 'forever') => {
    setChatRetention(val);
    try {
      await SecureStore.setItemAsync('kidsko_parent_chat_retention', val);
      if (val === '30' || val === '90') {
        await pruneChatRetention(parseInt(val, 10));
      }
    } catch {}
  };

  const handleChangeDailyLimit = async (limit: number | 'infinity') => {
    if (!activeStudent) return;
    setDailyLimit(limit);
    try {
      await SecureStore.setItemAsync(`kidsko_limit_${activeStudent.id}`, String(limit));
    } catch {}
  };

  const handleToggleSchedule = async (type: 'school' | 'evening' | 'weekend', val: boolean) => {
    try {
      if (type === 'school') {
        setSchoolHours(val);
        await SecureStore.setItemAsync('kidsko_parent_school_hours', val ? 'true' : 'false');
      } else if (type === 'evening') {
        setEveningStudy(val);
        await SecureStore.setItemAsync('kidsko_parent_evening_study', val ? 'true' : 'false');
      } else if (type === 'weekend') {
        setWeekendLearning(val);
        await SecureStore.setItemAsync('kidsko_parent_weekend_learning', val ? 'true' : 'false');
      }
    } catch {}
  };

  const handleToggleNotification = async (type: 'daily' | 'alerts', val: boolean) => {
    try {
      if (type === 'daily') {
        setDailyReport(val);
        await SecureStore.setItemAsync('kidsko_parent_daily_report', val ? 'true' : 'false');
      } else {
        setLimitAlerts(val);
        await SecureStore.setItemAsync('kidsko_parent_limit_alerts', val ? 'true' : 'false');
      }
    } catch {}
  };

  // Add Child
  const handleConfirmAddChild = async () => {
    if (!newChildName.trim()) {
      setAddChildError("Please enter your child's name.");
      return;
    }
    setAddingChild(true);
    setAddChildError(null);
    try {
      const created = await createStudent(newChildName.trim());
      const updatedList = await onRefreshStudents();
      if (Array.isArray(updatedList) && updatedList.length > 0) {
        const found = updatedList.find((s) => s.id === created.id) || updatedList[0];
        onSelectStudent(found);
      }
      setNewChildName('');
      setNewChildAge('');
      setShowAddModal(false);
    } catch (err: any) {
      setAddChildError(err?.message || 'Could not add child profile');
    } finally {
      setAddingChild(false);
    }
  };

  // Edit Child
  const handleOpenEditChild = (student: Student) => {
    setEditingStudent(student);
    setEditChildName(student.student_name);
    setEditChildError(null);
  };

  const handleSaveEditChild = async () => {
    if (!editingStudent || !editChildName.trim()) {
      setEditChildError("Name cannot be empty.");
      return;
    }
    setUpdatingChild(true);
    setEditChildError(null);
    try {
      await updateStudent(editingStudent.id, editChildName.trim());
      await onRefreshStudents();
      setEditingStudent(null);
    } catch (err: any) {
      setEditChildError(err?.message || 'Failed to update child profile');
    } finally {
      setUpdatingChild(false);
    }
  };

  // Trigger Delete Child
  const handleRequestDeleteChild = (student: Student) => {
    setChildToDelete(student);
    Alert.alert(
      `Delete ${student.student_name}'s Profile?`,
      `Are you sure you want to permanently delete ${student.student_name}'s profile? All conversations and memory will be erased.\n\nParent PIN verification required.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue with PIN',
          style: 'destructive',
          onPress: () => {
            setPendingDeleteType('child');
            setDeleteGateVisible(true);
          },
        },
      ]
    );
  };

  // Trigger Delete Account
  const handleRequestDeleteAccount = () => {
    Alert.alert(
      'Delete Parent Account?',
      'Are you sure you want to permanently delete your parent account and all children profiles? All data will be wiped.\n\nParent PIN verification required.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue with PIN',
          style: 'destructive',
          onPress: () => {
            setPendingDeleteType('account');
            setDeleteGateVisible(true);
          },
        },
      ]
    );
  };

  // PIN Confirmed Action
  const handlePinConfirmedAction = async () => {
    setDeleteGateVisible(false);
    if (pendingDeleteType === 'child') {
      const target = childToDelete || activeStudent;
      if (!target) return;
      const childName = target.student_name;
      const targetId = target.id;
      // Optimistically remove from UI immediately
      setLocalStudents((prev) => prev.filter((s) => s.id !== targetId));
      setEditingStudent(null);
      setDeletingChild(true);
      try {
        await deleteStudent(targetId);
        const updatedList = await onRefreshStudents();
        if (Array.isArray(updatedList) && updatedList.length > 0) {
          const nextChild = updatedList.find((s) => s.id !== targetId) || updatedList[0];
          onSelectStudent(nextChild);
        }
        Alert.alert('Profile Deleted', `${childName}'s profile has been removed.`);
      } catch (err: any) {
        const updatedList = await onRefreshStudents();
        if (Array.isArray(updatedList) && updatedList.length > 0) {
          const nextChild = updatedList.find((s) => s.id !== targetId) || updatedList[0];
          onSelectStudent(nextChild);
        }
        if (err?.message?.includes('not found')) {
          Alert.alert('Profile Removed', `${childName}'s profile was removed.`);
        } else {
          Alert.alert('Error', err.message || 'Failed to delete child profile');
        }
      } finally {
        setDeletingChild(false);
        setPendingDeleteType(null);
        setChildToDelete(null);
      }
    } else if (pendingDeleteType === 'account') {
      setPendingDeleteType(null);
      setAccountDeletePassword('');
      setAccountDeleteError(null);
      setAccountDeleteModalVisible(true);
    }
  };

  // Password Confirmed Account Deletion
  const handleConfirmAccountDeletion = async () => {
    if (!accountDeletePassword.trim()) {
      setAccountDeleteError('Please enter your account password.');
      return;
    }
    setDeletingAccount(true);
    setAccountDeleteError(null);
    try {
      await deleteAccount(accountDeletePassword.trim());
      await clearToken();
      setAccountDeleteModalVisible(false);
      if (onAccountDeleted) {
        onAccountDeleted();
      } else {
        onRequestLogout();
      }
    } catch (err: any) {
      setAccountDeleteError(err?.message || 'Failed to delete account. Please check your password.');
    } finally {
      setDeletingAccount(false);
    }
  };

  // Parent Password Update Action (Step 1: Request OTP)
  const handleRequestPasswordOtp = async () => {
    let emailToUse = parentEmail;
    if (!emailToUse) {
      try {
        const fetched = await getCurrentUserEmail();
        if (fetched) {
          emailToUse = fetched;
          setParentEmail(fetched);
        }
      } catch {}
    }

    if (!isForgotPasswordMode) {
      if (!currentPasswordInput) {
        setPasswordError('Please enter your current password.');
        return;
      }
    }

    if (!newPasswordInput || newPasswordInput.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setUpdatingPassword(true);
    setPasswordError(null);
    try {
      if (isForgotPasswordMode) {
        if (!emailToUse) {
          throw new Error('Could not identify parent email. Please try logging in again.');
        }
        await forgotPassword(emailToUse);
      } else {
        await requestPasswordChangeOtp(currentPasswordInput, newPasswordInput);
      }
      setPasswordStep('otp');
      setPasswordOtpInput('');
      setPasswordResendTimer(30);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to send verification code.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Parent Password Update Action (Step 2: Verify OTP & Change Password)
  const handleConfirmPasswordOtp = async () => {
    const trimmedOtp = passwordOtpInput.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      setPasswordError('Please enter the verification code sent to your email.');
      return;
    }
    let emailToUse = parentEmail;
    if (!emailToUse) {
      try {
        const fetched = await getCurrentUserEmail();
        if (fetched) {
          emailToUse = fetched;
          setParentEmail(fetched);
        }
      } catch {}
    }

    setUpdatingPassword(true);
    setPasswordError(null);
    try {
      if (isForgotPasswordMode) {
        if (!emailToUse) throw new Error('Could not identify parent email.');
        await resetPasswordWithOtp(emailToUse, trimmedOtp, newPasswordInput);
      } else {
        await confirmPasswordChangeOtp(trimmedOtp, newPasswordInput);
      }
      setChangePasswordModalVisible(false);
      setPasswordStep('form');
      setIsForgotPasswordMode(false);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordOtpInput('');
      Alert.alert(
        isForgotPasswordMode ? 'Password Reset Successful' : 'Password Updated',
        'Your parent account password has been updated successfully.'
      );
    } catch (err: any) {
      setPasswordError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Parent Email Update Action (Step 1: Request OTP to new email)
  const handleRequestEmailOtp = async () => {
    const trimmed = newEmailInput.trim().toLowerCase();
    const confirmTrimmed = confirmEmailInput.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (
      trimmed.endsWith('@gmail.cm') ||
      trimmed.endsWith('@gmai.com') ||
      trimmed.endsWith('@gamil.com') ||
      trimmed.endsWith('@gmial.com')
    ) {
      setEmailError('Did you mean @gmail.com? Please check your email spelling.');
      return;
    }
    if (trimmed !== confirmTrimmed) {
      setEmailError('Email addresses do not match. Please re-type to confirm.');
      return;
    }
    if (trimmed === parentEmail.toLowerCase()) {
      setEmailError('New email must be different from your current email.');
      return;
    }
    if (!emailPasswordInput) {
      setEmailError('Please enter your current password.');
      return;
    }
    setUpdatingEmail(true);
    setEmailError(null);
    try {
      await requestEmailChangeOtp(emailPasswordInput, trimmed);
      setEmailStep('otp');
      setEmailOtpInput('');
      setEmailResendTimer(30);
    } catch (err: any) {
      setEmailError(err?.message || 'Failed to send verification code.');
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Parent Email Update Action (Step 2: Verify OTP sent to new email & Commit)
  const handleConfirmEmailOtp = async () => {
    const trimmed = newEmailInput.trim().toLowerCase();
    const trimmedOtp = emailOtpInput.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      setEmailError('Please enter the verification code sent to your new email.');
      return;
    }
    setUpdatingEmail(true);
    setEmailError(null);
    try {
      const res = await confirmEmailChangeOtp(trimmed, trimmedOtp);
      setParentEmail(res.email);
      setChangeEmailModalVisible(false);
      setEmailStep('form');
      setNewEmailInput('');
      setConfirmEmailInput('');
      setEmailPasswordInput('');
      setEmailOtpInput('');
      Alert.alert('Email Updated', `Your account email has been updated to ${res.email}.`);
    } catch (err: any) {
      setEmailError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Memory Actions
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

  const handleRemoveFact = async (idx: number) => {
    if (!activeStudent || !memory) return;
    const newFacts = memory.facts.filter((_, i) => i !== idx);
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

  const handleClearMemory = () => {
    if (!activeStudent) return;
    Alert.alert(
      'Clear All Memory?',
      `Are you sure you want to erase all remembered facts for ${activeStudent.student_name}? Kidsko will start fresh.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setUpdatingMemory(true);
            try {
              await updateStudentMemory(activeStudent.id, { facts: [] });
              await fetchMemory(activeStudent.id);
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

  // Question Limit Calculations
  const questionsUsed = activity?.questionsToday ?? 0;
  const limitNumber = dailyLimit === 'infinity' ? 9999 : dailyLimit;
  const questionsRemaining = dailyLimit === 'infinity' ? '∞' : Math.max(0, limitNumber - questionsUsed);
  const limitPercent = dailyLimit === 'infinity' ? 20 : Math.min(100, Math.round((questionsUsed / limitNumber) * 100));

  // Past conversation icon palette
  const threadIcons = ['🔬', '🔢', '🌍', '🦕', '📖', '🚀', '🎨', '🧩'];
  const threadBgColors = ['#FFF0F0', '#FFF5E0', '#E8F8F0', '#F3EEFF', '#EBF5FB', '#FFF0F5'];

  return (
    <View style={styles.mainContainer}>
      {/* ── Dashboard Header ── */}
      <LinearGradient
        colors={['#1E3A5F', '#2980B9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerContainer}
      >
        {/* Top Title & Close Button */}
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>👨‍👩‍👧‍👦 Parent Dashboard</Text>
            <Text style={styles.headerSubtitle}>Manage your children's learning</Text>
          </View>
          {onRequestClose && (
            <TouchableOpacity
              onPress={onRequestClose}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              activeOpacity={0.7}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close parent dashboard"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Children Horizontal Squircle Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childrenPillsContainer}
        >
          {localStudents.map((st, idx) => {
            const isSelected = activeStudent?.id === st.id;
            const isAlternate = idx % 2 !== 0;
            return (
              <TouchableOpacity
                key={st.id}
                onPress={() => onSelectStudent(st)}
                style={styles.childPillItem}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.childPillSquircle,
                    isSelected ? styles.childPillActiveSquircle : styles.childPillInactiveSquircle,
                    {
                      backgroundColor: isSelected
                        ? '#FF6B6B'
                        : isAlternate
                        ? 'rgba(78, 205, 196, 0.4)'
                        : 'rgba(255, 107, 107, 0.35)',
                    },
                  ]}
                >
                  <Text style={styles.childPillEmoji}>{isAlternate ? '👦' : '👧'}</Text>
                </View>
                <Text
                  style={[
                    styles.childPillName,
                    isSelected && styles.childPillNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {st.student_name}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Add Child Pill */}
          <TouchableOpacity
            onPress={() => {
              setNewChildName('');
              setNewChildAge('');
              setAddChildError(null);
              setShowAddModal(true);
            }}
            style={styles.childPillItem}
            activeOpacity={0.8}
          >
            <View style={styles.addChildSquircle}>
              <Text style={styles.addChildPlus}>➕</Text>
            </View>
            <Text style={styles.addChildText}>Add</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Sub-nav Tab Bar (Overview | History | Limits | Settings) */}
        <View style={styles.subnavBar}>
          {(['overview', 'history', 'limits', 'settings'] as SubTab[]).map((tab) => {
            const isActive = currentTab === tab;
            const label = tab.charAt(0).toUpperCase() + tab.slice(1);
            return (
              <PressScale
                key={tab}
                onPress={() => setCurrentTab(tab)}
                style={[styles.subnavTab, isActive && styles.subnavTabActive]}
              >
                <Text style={[styles.subnavTabText, isActive && styles.subnavTabTextActive]}>
                  {label}
                </Text>
              </PressScale>
            );
          })}
        </View>
      </LinearGradient>

      {/* ── Sub-tab Content Area with Animated Transitions ── */}
      <View style={styles.contentBody}>
        <FadeSlideIn key={currentTab} duration={240} style={{ flex: 1 }}>
        {/* ════════ TAB 1: OVERVIEW ════════ */}
        {currentTab === 'overview' && (
          <View style={styles.tabContentWrapper}>
            {activeStudent ? (
              <>
                {/* Active Child Profile Card */}
                <View style={styles.card}>
                  <View style={styles.activeChildCardRow}>
                    <LinearGradient
                      colors={['#FF6B6B', '#FF9F43']}
                      style={styles.activeChildAvatarCircle}
                    >
                      <Text style={styles.activeChildAvatarEmoji}>👧</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeChildName}>{activeStudent.student_name}</Text>
                      <TouchableOpacity
                        onPress={onOpenPaywall}
                        activeOpacity={0.7}
                        style={styles.activeChildPlanBadge}
                        accessibilityRole="button"
                        accessibilityLabel="Change plan"
                      >
                        <Text style={styles.activeChildPlanText}>
                          {isPremium ? '⭐ Premium Active' : '📦 Free Plan · Upgrade 🚀'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.activeStatusPill}>
                      <Text style={styles.activeStatusText}>🟢 Active</Text>
                    </View>
                  </View>
                </View>

                {/* 4-Grid Metrics */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>💬</Text>
                    <Text style={[styles.metricValue, { color: colors.coral }]}>
                      {activity?.questionsToday ?? 0}
                    </Text>
                    <Text style={styles.metricLabel}>Questions Today</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>🔥</Text>
                    <Text style={[styles.metricValue, { color: '#FF9F43' }]}>
                      {activity?.streak ?? 0}
                    </Text>
                    <Text style={styles.metricLabel}>Day Streak</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>⏱️</Text>
                    <Text style={[styles.metricValue, { color: colors.sky }]}>
                      {activity?.questionsThisWeek ?? 0}
                    </Text>
                    <Text style={styles.metricLabel}>This Week</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>⭐</Text>
                    <Text style={[styles.metricValue, { color: colors.purple }]}>
                      {activity?.topicsExplored ?? 0}
                    </Text>
                    <Text style={styles.metricLabel}>Topics Explored</Text>
                  </View>
                </View>

                {/* Topics This Week */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderTitle}>📚 Topics This Week</Text>
                  {activity?.topics && activity.topics.length > 0 ? (
                    <View style={{ marginTop: 4 }}>
                      {activity.topics.map((t, idx) => {
                        const totalWeekly = Math.max(1, activity.questionsThisWeek);
                        const pct = Math.min(100, Math.round((t.count / totalWeekly) * 100));
                        const isLast = idx === activity.topics!.length - 1;
                        return (
                          <View key={t.name} style={[styles.topicRow, isLast && { marginBottom: 0 }]}>
                            <View style={styles.topicHeader}>
                              <View style={[styles.topicIconSquircle, { backgroundColor: `${t.color}20` }]}>
                                <Text style={styles.topicIconEmoji}>{t.icon}</Text>
                              </View>
                              <Text style={styles.topicName}>{t.name}</Text>
                              <Text style={styles.topicCount}>{t.count} {t.count === 1 ? 'Q' : 'Qs'}</Text>
                            </View>
                            <View style={styles.progressBarTrack}>
                              <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: t.color }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.emptyStateText}>
                      No learning topics explored yet this week. As {activeStudent.student_name} asks questions in Science, Maths, or English, real subject topics will appear here!
                    </Text>
                  )}
                </View>

                {/* Weekly Flexbox Bar Chart */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderTitle}>📊 Questions This Week</Text>
                  {activity && activity.questionsThisWeek > 0 ? (
                    <View style={styles.barChartContainer}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                        const count = activity.dailyCounts?.[day] || 0;
                        const maxDaily = Math.max(1, ...Object.values(activity.dailyCounts || {}));
                        const pct = Math.max(8, Math.round((count / maxDaily) * 100));
                        const isPeak = count > 0 && count === maxDaily;
                        return (
                          <View key={day} style={styles.barCol}>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    height: `${pct}%` as any,
                                    backgroundColor: isPeak ? colors.coral : '#EEF2FF',
                                  },
                                ]}
                              />
                            </View>
                            <Text
                              style={[
                                styles.barDayText,
                                isPeak && { color: colors.coral, fontFamily: fontFamilies.black },
                              ]}
                            >
                              {day}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.emptyStateText}>
                      No questions asked yet this week. As {activeStudent.student_name} chats with Kidsko, real learning progress will appear here!
                    </Text>
                  )}
                </View>

                {/* Kidsko Memory & Preferences Card */}
                <View style={styles.card}>
                  <View style={styles.memoryHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.cardHeaderTitle}>🧠 Kidsko Memory</Text>
                      <Text style={styles.cardSubtitle}>
                        What Kidsko remembered from chats with {activeStudent.student_name}.
                      </Text>
                    </View>
                    <Switch
                      value={memory?.enabled ?? true}
                      onValueChange={handleToggleMemory}
                      trackColor={{ false: colors.disabledBg, true: colors.green }}
                      thumbColor={colors.white}
                      disabled={updatingMemory}
                    />
                  </View>

                  {loadingMemory ? (
                    <ActivityIndicator size="small" color={colors.coral} style={{ marginVertical: 12 }} />
                  ) : memory && memory.facts.length > 0 ? (
                    <View style={styles.factsWrap}>
                      {memory.facts.map((fact, idx) => (
                        <View key={`${fact}_${idx}`} style={styles.factChip}>
                          <Text style={styles.factChipText}>{fact}</Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveFact(idx)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.factChipRemove}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyStateText}>
                      No specific facts recorded yet. As {activeStudent.student_name} chats, Kidsko will remember their grade and interests.
                    </Text>
                  )}

                  {memory && memory.facts.length > 0 && (
                    <TouchableOpacity
                      onPress={handleClearMemory}
                      style={styles.clearMemoryBtn}
                      disabled={updatingMemory}
                    >
                      <Text style={styles.clearMemoryBtnText}>🧹 Clear All Memory</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.noChildCard}>
                <Text style={styles.noChildEmoji}>🧒</Text>
                <Text style={styles.noChildTitle}>No Child Profile Selected</Text>
                <Text style={styles.noChildSubtitle}>Add a child profile above to begin tracking their learning progress.</Text>
              </View>
            )}
          </View>
        )}

        {/* ════════ TAB 2: HISTORY (Image 2) ════════ */}
        {currentTab === 'history' && (
          <View style={styles.tabContentWrapper}>
            {activeStudent ? (
              <>
                <Text style={styles.sectionHeaderTitle}>
                  {activeStudent.student_name}'s Conversations
                </Text>

                {loadingThreads ? (
                  <ActivityIndicator size="large" color={colors.coral} style={{ marginTop: 20 }} />
                ) : threads.length > 0 ? (
                  <View style={{ gap: 9 }}>
                    {threads.map((item, idx) => {
                      const icon = threadIcons[idx % threadIcons.length];
                      const bgColor = threadBgColors[idx % threadBgColors.length];
                      const dateStr = item.updatedAt
                        ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Recent';
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => onOpenTranscript(activeStudent, { id: item.id, title: item.title })}
                          style={styles.historyCard}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.historyIconBox, { backgroundColor: bgColor }]}>
                            <Text style={styles.historyIconEmoji}>{icon}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.historyItemTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.historyItemMeta}>
                              {dateStr} · {item.message_count ? `${item.message_count} messages` : 'Conversation'}
                            </Text>
                          </View>
                          <View style={styles.historyChevronBox}>
                            <Text style={styles.historyChevronText}>›</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.emptyStateText}>
                      No past conversations yet. When {activeStudent.student_name} chats with Kidsko, homework help and learning transcripts will appear here!
                    </Text>
                  </View>
                )}

                {/* View Full Transcript Action */}
                <TouchableOpacity
                  onPress={() => onOpenTranscript(activeStudent)}
                  style={styles.fullTranscriptBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.fullTranscriptBtnText}>
                    📜 View Full Raw Transcript for {activeStudent.student_name}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.noChildCard}>
                <Text style={styles.noChildTitle}>No Child Profile Selected</Text>
              </View>
            )}
          </View>
        )}

        {/* ════════ TAB 3: LIMITS (Image 3) ════════ */}
        {currentTab === 'limits' && (
          <View style={styles.tabContentWrapper}>
            {!isPremium ? (
              /* 🔒 Premium Locked Limits Screen (Free Plan) */
              <View style={styles.limitsLockedContainer}>
                <LinearGradient
                  colors={['#1A2A44', '#1E3A5F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.limitsLockedCard}
                >
                  <View style={styles.limitsLockedBadge}>
                    <Text style={{ fontSize: 32 }}>🔒</Text>
                  </View>
                  <Text style={styles.limitsLockedTitle}>Custom Limits is a Premium Feature</Text>
                  <Text style={styles.limitsLockedDesc}>
                    Personalized question caps, custom study schedules, bedtime curfew, and camera vision controls are available exclusively with Kidsko Premium.
                  </Text>

                  {/* Free vs Premium Plan Comparison */}
                  <View style={styles.limitsComparisonBox}>
                    <View style={styles.limitsComparisonRow}>
                      <Text style={styles.limitsComparisonLabel}>📦 Free Plan Default:</Text>
                      <Text style={styles.limitsComparisonVal}>Fixed 30 questions/week</Text>
                    </View>
                    <View style={styles.limitsComparisonRow}>
                      <Text style={[styles.limitsComparisonLabel, { color: '#FFD700' }]}>⭐ Premium Plan:</Text>
                      <Text style={[styles.limitsComparisonVal, { color: '#FFFFFF', fontFamily: fontFamilies.bold }]}>
                        Custom Caps & Unlimited
                      </Text>
                    </View>
                  </View>

                  {/* Feature Highlights */}
                  <View style={styles.limitsFeaturesList}>
                    <Text style={styles.limitsFeatureItem}>✨ Set custom weekly limits (30, 50, 100, or Unlimited)</Text>
                    <Text style={styles.limitsFeatureItem}>⏰ Tailor study schedules (School, Evening, Weekend)</Text>
                    <Text style={styles.limitsFeatureItem}>🌙 Enforce night-time Bedtime Curfew (8 PM – 7 AM)</Text>
                    <Text style={styles.limitsFeatureItem}>📷 AI Camera Vision parental switch</Text>
                  </View>

                  <TouchableOpacity
                    onPress={onOpenPaywall}
                    style={styles.limitsUnlockBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.limitsUnlockBtnText}>
                      Upgrade to Premium to Unlock Limits 🚀
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ) : activeStudent ? (
              <>
                {/* ⏱️ Weekly Question Limit Card */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderTitle}>⏱️ Weekly Question Limit</Text>
                  <Text style={styles.cardSubtitle}>
                    Control how many questions {activeStudent.student_name} can ask per week
                  </Text>

                  <View style={styles.limitCounterBox}>
                    <Text style={styles.limitBigNumber}>
                      {dailyLimit === 'infinity' ? '∞' : dailyLimit}
                    </Text>
                    <Text style={styles.limitUnitsText}>questions per week</Text>

                    {/* Progress Bar Track */}
                    <View style={styles.limitTrack}>
                      <View style={[styles.limitFill, { width: `${limitPercent}%` }]} />
                    </View>
                    <Text style={styles.limitUsageText}>
                      {questionsUsed} used · {questionsRemaining} remaining
                    </Text>
                  </View>

                  {/* Limit Preset Selector Buttons */}
                  <View style={styles.limitPresetsRow}>
                    {([10, 20, 30, 50, 'infinity'] as const).map((preset) => {
                      const isSelected = dailyLimit === preset;
                      const label = preset === 'infinity' ? '∞' : String(preset);
                      return (
                        <TouchableOpacity
                          key={String(preset)}
                          onPress={() => handleChangeDailyLimit(preset)}
                          style={[
                            styles.presetBtn,
                            isSelected && styles.presetBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetBtnText,
                              isSelected && styles.presetBtnTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* ⏰ Study Schedule Card */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderTitle}>⏰ Study Schedule</Text>

                  <View style={styles.scheduleRow}>
                    <Text style={styles.scheduleLabel}>School Hours (8am–3pm)</Text>
                    <Switch
                      value={schoolHours}
                      onValueChange={(v) => handleToggleSchedule('school', v)}
                      trackColor={{ false: colors.disabledBg, true: colors.green }}
                      thumbColor={colors.white}
                    />
                  </View>

                  <View style={styles.scheduleRow}>
                    <Text style={styles.scheduleLabel}>Evening Study (5pm–7pm)</Text>
                    <Switch
                      value={eveningStudy}
                      onValueChange={(v) => handleToggleSchedule('evening', v)}
                      trackColor={{ false: colors.disabledBg, true: colors.green }}
                      thumbColor={colors.white}
                    />
                  </View>

                  <View style={[styles.scheduleRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <Text style={styles.scheduleLabel}>Weekend Learning</Text>
                    <Switch
                      value={weekendLearning}
                      onValueChange={(v) => handleToggleSchedule('weekend', v)}
                      trackColor={{ false: colors.disabledBg, true: colors.green }}
                      thumbColor={colors.white}
                    />
                  </View>
                </View>

                {/* 🛡️ Safety & Controls Card */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderTitle}>🛡️ Safety & Controls</Text>

                  <View style={styles.scheduleRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.scheduleLabel}>AI Vision Camera</Text>
                      <Text style={styles.controlSub}>Allow Kidsko to see homework through camera</Text>
                    </View>
                    <Switch
                      value={allowCamera}
                      onValueChange={handleToggleCamera}
                      trackColor={{ false: colors.disabledBg, true: colors.green }}
                      thumbColor={colors.white}
                    />
                  </View>

                  <View style={styles.scheduleRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.scheduleLabel}>🌙 Bedtime Curfew</Text>
                      <Text style={styles.controlSub}>Lock calls during night (8:00 PM – 7:00 AM)</Text>
                    </View>
                    <Switch
                      value={curfewEnabled}
                      onValueChange={handleToggleCurfew}
                      trackColor={{ false: colors.disabledBg, true: colors.green }}
                      thumbColor={colors.white}
                    />
                  </View>

                  <View style={{ paddingTop: 8 }}>
                    <Text style={styles.scheduleLabel}>Chat History Retention</Text>
                    <Text style={styles.controlSub}>How long Kidsko keeps past conversations</Text>
                    <View style={styles.retentionPillRow}>
                      {(['30', '90', 'forever'] as const).map((opt) => (
                        <Pressable
                          key={opt}
                          style={[
                            styles.retentionPill,
                            chatRetention === opt && styles.retentionPillActive,
                          ]}
                          onPress={() => handleChangeRetention(opt)}
                        >
                          <Text
                            style={[
                              styles.retentionPillText,
                              chatRetention === opt && styles.retentionPillTextActive,
                            ]}
                          >
                            {opt === 'forever' ? 'Keep Forever' : `${opt} Days`}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.noChildCard}>
                <Text style={styles.noChildTitle}>No Child Profile Selected</Text>
              </View>
            )}
          </View>
        )}

        {/* ════════ TAB 4: SETTINGS (Images 4 & 5) ════════ */}
        {currentTab === 'settings' && (
          <View style={styles.tabContentWrapper}>
            {/* ⭐ MEMBERSHIP & PLAN Section */}
            <Text style={styles.sectionCategoryHeader}>MEMBERSHIP & SUBSCRIPTION</Text>
            <TouchableOpacity
              onPress={() => {
                console.log('[ParentsHub] onOpenPaywall tapped!');
                onOpenPaywall();
              }}
              activeOpacity={0.85}
              style={styles.membershipCard}
              accessibilityRole="button"
              accessibilityLabel="View and manage subscription plan"
            >
              <LinearGradient
                colors={isPremium ? ['#1A2A44', '#1E3A5F'] : ['#2C3E50', '#1E3A5F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.membershipCardGradient}
              >
                <View style={styles.membershipTopRow}>
                  <View style={styles.membershipIconBadge}>
                    <Text style={{ fontSize: 24 }}>{isPremium ? '⭐' : '📦'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.membershipSubText}>ACTIVE PLAN</Text>
                    <Text style={styles.membershipTitle}>
                      {isPremium ? 'Kidsko Premium' : 'Free Starter Plan'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.membershipStatusPill,
                      isPremium ? styles.statusPillPremium : styles.statusPillFree,
                    ]}
                  >
                    <Text
                      style={[
                        styles.membershipStatusText,
                        isPremium ? styles.statusTextPremium : styles.statusTextFree,
                      ]}
                    >
                      {isPremium ? 'ACTIVE' : 'FREE'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.membershipFeaturesText}>
                  {isPremium
                    ? '✨ Unlimited homework questions\n📞 Unlimited Voice & Video calls\n📷 Real-time AI Camera Vision\n👨‍👩‍👧‍👦 Multi-child learning profiles'
                    : '• 30 questions/week limit\n• Standard homework help\n• Tap to unlock unlimited voice/video & camera vision'}
                </Text>

                <View style={styles.membershipActionBtn}>
                  <Text style={styles.membershipActionBtnText}>
                    {isPremium ? 'Manage Subscription Plan ›' : 'Upgrade to Premium 🚀'}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* 👨‍👩‍👧‍👦 Manage Children Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>👨‍👩‍👧‍👦 Manage Children</Text>
              <View style={{ marginTop: 8 }}>
                {localStudents.map((st, idx) => (
                  <View key={st.id} style={styles.manageChildRow}>
                    <LinearGradient
                      colors={idx % 2 === 0 ? ['#FF6B6B', '#FF9F43'] : ['#4ECDC4', '#74B9FF']}
                      style={styles.manageChildAvatar}
                    >
                      <Text style={{ fontSize: 20 }}>{idx % 2 === 0 ? '👧' : '👦'}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.manageChildName}>{st.student_name}</Text>
                      <Text style={styles.manageChildGrade}>Child Profile · Active Learner</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleOpenEditChild(st)}
                      style={styles.manageChildEditBtn}
                    >
                      <Text style={styles.manageChildEditText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* ➕ Add Another Child Button */}
              <TouchableOpacity
                onPress={() => {
                  setNewChildName('');
                  setNewChildAge('');
                  setAddChildError(null);
                  setShowAddModal(true);
                }}
                style={styles.addAnotherChildBtn}
              >
                <Text style={styles.addAnotherChildText}>➕ Add Another Child</Text>
              </TouchableOpacity>
            </View>

            {/* SAFETY Section */}
            <Text style={styles.sectionCategoryHeader}>SAFETY</Text>
            <View style={styles.groupedListCard}>
              <TouchableOpacity
                onPress={() => setChangePinVisible(true)}
                style={styles.groupedRow}
              >
                <View style={[styles.groupedIconSquircle, { backgroundColor: '#E8F8F0' }]}>
                  <Text style={{ fontSize: 18 }}>🔒</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.groupedRowTitle}>Change Parent PIN</Text>
                  <Text style={styles.groupedRowSubtitle}>Current: ••••</Text>
                </View>
                <Text style={styles.groupedChevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Alert.alert('Content Filter', 'Child safe strict AI filtering is actively turned on.')}
                style={[styles.groupedRow, { borderBottomWidth: 0 }]}
              >
                <View style={[styles.groupedIconSquircle, { backgroundColor: '#FFF0F0' }]}>
                  <Text style={{ fontSize: 18 }}>🚫</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.groupedRowTitle}>Content Filter</Text>
                  <Text style={styles.groupedRowSubtitle}>Strict mode on</Text>
                </View>
                <Text style={styles.groupedChevron}>›</Text>
              </TouchableOpacity>
            </View>

            {/* PARENT ACCOUNT & SECURITY Section */}
            <Text style={styles.sectionCategoryHeader}>PARENT ACCOUNT</Text>
            <View style={styles.groupedListCard}>
              {/* Account Email / Gmail */}
              <TouchableOpacity
                onPress={() => {
                  setNewEmailInput('');
                  setConfirmEmailInput('');
                  setEmailPasswordInput('');
                  setEmailOtpInput('');
                  setEmailStep('form');
                  setEmailError(null);
                  setChangeEmailModalVisible(true);
                }}
                style={styles.groupedRow}
              >
                <View style={[styles.groupedIconSquircle, { backgroundColor: '#EBF3FF' }]}>
                  <Text style={{ fontSize: 18 }}>📧</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.groupedRowTitle}>Account Email / Gmail</Text>
                  <Text style={styles.groupedRowSubtitle} numberOfLines={1}>
                    {parentEmail || 'Tap to update email'}
                  </Text>
                </View>
                <Text style={styles.groupedChevron}>Edit ›</Text>
              </TouchableOpacity>

              {/* Change Password */}
              <TouchableOpacity
                onPress={() => {
                  setCurrentPasswordInput('');
                  setNewPasswordInput('');
                  setConfirmPasswordInput('');
                  setPasswordOtpInput('');
                  setPasswordStep('form');
                  setIsForgotPasswordMode(false);
                  setPasswordError(null);
                  setChangePasswordModalVisible(true);
                }}
                style={styles.groupedRow}
              >
                <View style={[styles.groupedIconSquircle, { backgroundColor: '#F0E7FF' }]}>
                  <Text style={{ fontSize: 18 }}>🔑</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.groupedRowTitle}>Change Password</Text>
                  <Text style={styles.groupedRowSubtitle}>Update your parent login password</Text>
                </View>
                <Text style={styles.groupedChevron}>›</Text>
              </TouchableOpacity>

              {/* Sign Out Parent */}
              <TouchableOpacity
                onPress={onRequestLogout}
                style={[styles.groupedRow, { borderBottomWidth: 0 }]}
              >
                <View style={[styles.groupedIconSquircle, { backgroundColor: '#FFF0F0' }]}>
                  <Text style={{ fontSize: 18 }}>🚪</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.groupedRowTitle, { color: colors.coral }]}>Sign Out Parent</Text>
                  <Text style={styles.groupedRowSubtitle}>Log out of this device</Text>
                </View>
                <Text style={[styles.groupedChevron, { color: colors.coral }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* NOTIFICATIONS Section */}
            <Text style={styles.sectionCategoryHeader}>NOTIFICATIONS</Text>
            <View style={styles.groupedListCard}>
              <View style={styles.groupedRow}>
                <View style={[styles.groupedIconSquircle, { backgroundColor: '#FFF5E0' }]}>
                  <Text style={{ fontSize: 18 }}>🔔</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.groupedRowTitle}>Daily Report</Text>
                  <Text style={styles.groupedRowSubtitle}>Every evening at 7pm</Text>
                </View>
                <Switch
                  value={dailyReport}
                  onValueChange={(v) => handleToggleNotification('daily', v)}
                  trackColor={{ false: colors.disabledBg, true: colors.green }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={[styles.groupedRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.groupedIconSquircle, { backgroundColor: '#FFF0F0' }]}>
                  <Text style={{ fontSize: 18 }}>⚠️</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.groupedRowTitle}>Limit Alerts</Text>
                  <Text style={styles.groupedRowSubtitle}>When 80% used</Text>
                </View>
                <Switch
                  value={limitAlerts}
                  onValueChange={(v) => handleToggleNotification('alerts', v)}
                  trackColor={{ false: colors.disabledBg, true: colors.green }}
                  thumbColor={colors.white}
                />
              </View>
            </View>

            {/* Danger Zone: Account Deletion (App Store 5.1.1) */}
            <TouchableOpacity
              onPress={handleRequestDeleteAccount}
              style={styles.deleteAccountCard}
              disabled={deletingAccount}
            >
              <Text style={{ fontSize: 18 }}>⚠️</Text>
              <Text style={styles.deleteAccountText}>Permanently Delete Account</Text>
            </TouchableOpacity>
          </View>
        )}
        </FadeSlideIn>
      </View>

      {/* ── MODAL 1: Add Child Modal ── */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => !addingChild && setShowAddModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>➕ Add Child</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.modalCloseBtn}
                disabled={addingChild}
              >
                <Text style={{ fontSize: 16, color: colors.subtext }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalFieldLabel}>Child's Name</Text>
            <TextInput
              style={styles.modalTextInput}
              value={newChildName}
              onChangeText={(t) => {
                setNewChildName(t);
                if (addChildError) setAddChildError(null);
              }}
              placeholder="e.g. Sara"
              placeholderTextColor={colors.subtext}
              editable={!addingChild}
            />

            <Text style={styles.modalFieldLabel}>Age</Text>
            <TextInput
              style={styles.modalTextInput}
              value={newChildAge}
              onChangeText={setNewChildAge}
              placeholder="e.g. 8"
              keyboardType="number-pad"
              placeholderTextColor={colors.subtext}
              editable={!addingChild}
            />

            <Text style={styles.modalFieldLabel}>Grade</Text>
            <View style={styles.gradePickerRow}>
              {['Grade 1', 'Grade 3', 'Grade 5', 'Grade 7'].map((gr) => (
                <TouchableOpacity
                  key={gr}
                  onPress={() => setNewChildGrade(gr)}
                  style={[
                    styles.gradePickerPill,
                    newChildGrade === gr && styles.gradePickerPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.gradePickerText,
                      newChildGrade === gr && styles.gradePickerTextActive,
                    ]}
                  >
                    {gr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {addChildError ? (
              <Text style={styles.modalErrorText}>{addChildError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleConfirmAddChild}
              style={[styles.modalPrimaryBtn, addingChild && { opacity: 0.7 }]}
              disabled={addingChild}
            >
              {addingChild ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalPrimaryBtnText}>Add Child 🎉</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 2: Edit Child Modal ── */}
      <Modal
        visible={editingStudent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !updatingChild && setEditingStudent(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>✏️ Edit Child Profile</Text>
              <TouchableOpacity
                onPress={() => setEditingStudent(null)}
                style={styles.modalCloseBtn}
                disabled={updatingChild}
              >
                <Text style={{ fontSize: 16, color: colors.subtext }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalFieldLabel}>Child's Name</Text>
            <TextInput
              style={styles.modalTextInput}
              value={editChildName}
              onChangeText={(t) => {
                setEditChildName(t);
                if (editChildError) setEditChildError(null);
              }}
              placeholder="Child's Name"
              placeholderTextColor={colors.subtext}
              editable={!updatingChild}
            />

            {editChildError ? (
              <Text style={styles.modalErrorText}>{editChildError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleSaveEditChild}
              style={[styles.modalPrimaryBtn, updatingChild && { opacity: 0.7 }]}
              disabled={updatingChild}
            >
              {updatingChild ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.modalPrimaryBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {editingStudent && (
              <TouchableOpacity
                onPress={() => {
                  const toDelete = editingStudent;
                  setEditingStudent(null);
                  handleRequestDeleteChild(toDelete);
                }}
                style={styles.modalDangerBtn}
                disabled={updatingChild}
              >
                <Text style={styles.modalDangerBtnText}>
                  🗑️ Delete {editingStudent.student_name}'s Profile
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL 3: Password Confirmation for Permanent Account Deletion ── */}
      <Modal
        visible={accountDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingAccount) {
            setAccountDeleteModalVisible(false);
            setAccountDeletePassword('');
            setAccountDeleteError(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardCenter}>
            <Text style={styles.deleteModalTitle}>⚠️ Confirm Password</Text>
            <Text style={styles.deleteModalSub}>
              This will permanently delete your account, your children's profiles, learning history, and memory. This action cannot be undone.
            </Text>
            <Text style={styles.deleteModalSub}>
              Please enter your Kidsko password to confirm:
            </Text>

            <TextInput
              style={styles.modalTextInput}
              value={accountDeletePassword}
              onChangeText={(t) => {
                setAccountDeletePassword(t);
                if (accountDeleteError) setAccountDeleteError(null);
              }}
              placeholder="Your Account Password"
              placeholderTextColor={colors.subtext}
              secureTextEntry
              autoCapitalize="none"
              editable={!deletingAccount}
            />

            {accountDeleteError ? (
              <Text style={styles.modalErrorText}>{accountDeleteError}</Text>
            ) : null}

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setAccountDeleteModalVisible(false);
                  setAccountDeletePassword('');
                  setAccountDeleteError(null);
                }}
                disabled={deletingAccount}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmDeleteBtn,
                  deletingAccount && { opacity: 0.6 },
                ]}
                onPress={handleConfirmAccountDeletion}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmDeleteBtnText}>Permanently Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 4: Change Parent Email / Gmail ── */}
      <Modal
        visible={changeEmailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !updatingEmail && setChangeEmailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>📧 Account Email</Text>
              <TouchableOpacity
                onPress={() => setChangeEmailModalVisible(false)}
                style={styles.modalCloseBtn}
                disabled={updatingEmail}
              >
                <Text style={{ fontSize: 16, color: colors.subtext }}>✕</Text>
              </TouchableOpacity>
            </View>

            {emailStep === 'form' ? (
              <>
                <Text style={{ fontSize: 13, fontFamily: fontFamilies.regular, color: colors.subtext, marginBottom: 14 }}>
                  Enter your new email address and current password. We will send a verification code to verify the new email.
                </Text>

                <Text style={styles.modalFieldLabel}>New Email Address</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={newEmailInput}
                  onChangeText={(t) => {
                    setNewEmailInput(t);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="e.g. parent@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.subtext}
                  editable={!updatingEmail}
                />

                <Text style={styles.modalFieldLabel}>Confirm New Email Address</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={confirmEmailInput}
                  onChangeText={(t) => {
                    setConfirmEmailInput(t);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="Re-type new email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.subtext}
                  editable={!updatingEmail}
                />

                <Text style={styles.modalFieldLabel}>Current Account Password</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={emailPasswordInput}
                  onChangeText={(t) => {
                    setEmailPasswordInput(t);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="Enter password to confirm"
                  secureTextEntry
                  autoCapitalize="none"
                  placeholderTextColor={colors.subtext}
                  editable={!updatingEmail}
                />

                {emailError ? (
                  <Text style={styles.modalErrorText}>{emailError}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleRequestEmailOtp}
                  style={[styles.modalPrimaryBtn, updatingEmail && { opacity: 0.6 }]}
                  disabled={updatingEmail}
                >
                  {updatingEmail ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Send Verification Code 📩</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ alignItems: 'center', marginVertical: 10 }}>
                  <Text style={{ fontSize: 36, marginBottom: 6 }}>📬</Text>
                  <Text style={{ fontSize: 16, fontFamily: fontFamilies.bold, color: colors.text, textAlign: 'center' }}>
                    Verify Your New Email
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: fontFamilies.regular, color: colors.subtext, textAlign: 'center', marginTop: 4 }}>
                    Enter the code sent to{'\n'}
                    <Text style={{ fontFamily: fontFamilies.bold, color: colors.text }}>{newEmailInput.trim().toLowerCase()}</Text>
                  </Text>
                </View>

                <Text style={styles.modalFieldLabel}>Verification Code</Text>
                <TextInput
                  style={[styles.modalTextInput, { textAlign: 'center', fontSize: 24, letterSpacing: 6, fontFamily: fontFamilies.bold }]}
                  value={emailOtpInput}
                  onChangeText={(t) => {
                    setEmailOtpInput(t);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="••••••"
                  keyboardType="number-pad"
                  maxLength={8}
                  placeholderTextColor={colors.subtext}
                  editable={!updatingEmail}
                  autoFocus
                />

                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.subtext, fontFamily: fontFamilies.regular }}>
                    Didn't receive code?{' '}
                  </Text>
                  {emailResendTimer > 0 ? (
                    <Text style={{ fontSize: 12, color: colors.subtext, fontFamily: fontFamilies.semiBold }}>
                      Resend in {emailResendTimer}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleRequestEmailOtp} disabled={updatingEmail}>
                      <Text style={{ fontSize: 12, color: colors.coral, fontFamily: fontFamilies.bold }}>
                        Resend Code
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {emailError ? (
                  <Text style={styles.modalErrorText}>{emailError}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleConfirmEmailOtp}
                  style={[styles.modalPrimaryBtn, updatingEmail && { opacity: 0.6 }]}
                  disabled={updatingEmail}
                >
                  {updatingEmail ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Verify & Update Email</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setEmailStep('form');
                    setEmailOtpInput('');
                    setEmailError(null);
                  }}
                  style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
                  disabled={updatingEmail}
                >
                  <Text style={{ fontSize: 13, color: colors.subtext, fontFamily: fontFamilies.semiBold }}>
                    ← Change Email Address
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL 5: Change Account Password ── */}
      <Modal
        visible={changePasswordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !updatingPassword && setChangePasswordModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheetCard}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>🔑 Change Password</Text>
              <TouchableOpacity
                onPress={() => setChangePasswordModalVisible(false)}
                style={styles.modalCloseBtn}
                disabled={updatingPassword}
              >
                <Text style={{ fontSize: 16, color: colors.subtext }}>✕</Text>
              </TouchableOpacity>
            </View>

            {passwordStep === 'form' ? (
              <>
                <Text style={{ fontSize: 13, fontFamily: fontFamilies.regular, color: colors.subtext, marginBottom: 14 }}>
                  {isForgotPasswordMode
                    ? `Forgot your current password? We will send a security code to ${parentEmail || 'your email'} to reset it.`
                    : 'Enter your current password and choose a new password. We will send a verification code to your registered email.'}
                </Text>

                {!isForgotPasswordMode ? (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.modalFieldLabel}>Current Password</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setIsForgotPasswordMode(true);
                          setPasswordError(null);
                        }}
                        disabled={updatingPassword}
                      >
                        <Text style={{ fontSize: 12, color: colors.coral, fontFamily: fontFamilies.bold }}>
                          Forgot Password?
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.modalTextInput}
                      value={currentPasswordInput}
                      onChangeText={(t) => {
                        setCurrentPasswordInput(t);
                        if (passwordError) setPasswordError(null);
                      }}
                      placeholder="Current password"
                      secureTextEntry
                      autoCapitalize="none"
                      placeholderTextColor={colors.subtext}
                      editable={!updatingPassword}
                    />
                  </>
                ) : null}

                <Text style={styles.modalFieldLabel}>New Password</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={newPasswordInput}
                  onChangeText={(t) => {
                    setNewPasswordInput(t);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="At least 8 characters"
                  secureTextEntry
                  autoCapitalize="none"
                  placeholderTextColor={colors.subtext}
                  editable={!updatingPassword}
                />

                <Text style={styles.modalFieldLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={confirmPasswordInput}
                  onChangeText={(t) => {
                    setConfirmPasswordInput(t);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Re-type new password"
                  secureTextEntry
                  autoCapitalize="none"
                  placeholderTextColor={colors.subtext}
                  editable={!updatingPassword}
                />

                {passwordError ? (
                  <Text style={styles.modalErrorText}>{passwordError}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleRequestPasswordOtp}
                  style={[styles.modalPrimaryBtn, updatingPassword && { opacity: 0.6 }]}
                  disabled={updatingPassword}
                >
                  {updatingPassword ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>
                      {isForgotPasswordMode ? 'Send Reset Code 📩' : 'Send Verification Code 🔐'}
                    </Text>
                  )}
                </TouchableOpacity>

                {isForgotPasswordMode ? (
                  <TouchableOpacity
                    onPress={() => {
                      setIsForgotPasswordMode(false);
                      setPasswordError(null);
                    }}
                    style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
                    disabled={updatingPassword}
                  >
                    <Text style={{ fontSize: 13, color: colors.subtext, fontFamily: fontFamilies.semiBold }}>
                      ← I remember my password
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <>
                <View style={{ alignItems: 'center', marginVertical: 10 }}>
                  <Text style={{ fontSize: 36, marginBottom: 6 }}>🔐</Text>
                  <Text style={{ fontSize: 16, fontFamily: fontFamilies.bold, color: colors.text, textAlign: 'center' }}>
                    {isForgotPasswordMode ? 'Reset Password Security Code' : 'Enter Security Code'}
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: fontFamilies.regular, color: colors.subtext, textAlign: 'center', marginTop: 4 }}>
                    Enter the verification code sent to{'\n'}
                    <Text style={{ fontFamily: fontFamilies.bold, color: colors.text }}>{parentEmail || 'your email'}</Text>
                  </Text>
                </View>

                <Text style={styles.modalFieldLabel}>Verification Code</Text>
                <TextInput
                  style={[styles.modalTextInput, { textAlign: 'center', fontSize: 24, letterSpacing: 6, fontFamily: fontFamilies.bold }]}
                  value={passwordOtpInput}
                  onChangeText={(t) => {
                    setPasswordOtpInput(t);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="••••••"
                  keyboardType="number-pad"
                  maxLength={8}
                  placeholderTextColor={colors.subtext}
                  editable={!updatingPassword}
                  autoFocus
                />

                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: colors.subtext, fontFamily: fontFamilies.regular }}>
                    Didn't receive code?{' '}
                  </Text>
                  {passwordResendTimer > 0 ? (
                    <Text style={{ fontSize: 12, color: colors.subtext, fontFamily: fontFamilies.semiBold }}>
                      Resend in {passwordResendTimer}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleRequestPasswordOtp} disabled={updatingPassword}>
                      <Text style={{ fontSize: 12, color: colors.coral, fontFamily: fontFamilies.bold }}>
                        Resend Code
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {passwordError ? (
                  <Text style={styles.modalErrorText}>{passwordError}</Text>
                ) : null}

                <TouchableOpacity
                  onPress={handleConfirmPasswordOtp}
                  style={[styles.modalPrimaryBtn, updatingPassword && { opacity: 0.6 }]}
                  disabled={updatingPassword}
                >
                  {updatingPassword ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>
                      {isForgotPasswordMode ? 'Verify & Reset Password' : 'Verify & Update Password'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setPasswordStep('form');
                    setPasswordOtpInput('');
                    setPasswordError(null);
                  }}
                  style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
                  disabled={updatingPassword}
                >
                  <Text style={{ fontSize: 13, color: colors.subtext, fontFamily: fontFamilies.semiBold }}>
                    {isForgotPasswordMode ? '← Change New Password' : '← Edit Password'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── PIN Confirmation Gate for Profile Deletion & Account Deletion ── */}
      <ParentalGate
        visible={deleteGateVisible}
        onSuccess={handlePinConfirmedAction}
        onCancel={() => {
          setDeleteGateVisible(false);
          setPendingDeleteType(null);
          setChildToDelete(null);
        }}
      />

      {/* ── PIN Change Parental Gate ── */}
      <ParentalGate
        visible={changePinVisible}
        onSuccess={() => {
          setChangePinVisible(false);
          Alert.alert('Parent PIN', 'PIN verified. You can update your PIN anytime.');
        }}
        onCancel={() => setChangePinVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  headerContainer: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 12 : 20,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.black,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: fontFamilies.bold,
  },
  childrenPillsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
  },
  childPillItem: {
    alignItems: 'center',
    gap: 6,
  },
  childPillSquircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childPillActiveSquircle: {
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    ...shadows.card,
  },
  childPillInactiveSquircle: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  childPillEmoji: {
    fontSize: 26,
  },
  childPillName: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  childPillNameActive: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.black,
  },
  addChildSquircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChildPlus: {
    fontSize: 22,
  },
  addChildText: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  subnavBar: {
    flexDirection: 'row',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    paddingTop: 4,
  },
  subnavTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  subnavTabActive: {
    backgroundColor: '#F0F4F8',
  },
  subnavTabText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  subnavTabTextActive: {
    color: '#1E3A5F',
    fontFamily: fontFamilies.black,
  },
  contentBody: {
    flex: 1,
    padding: spacing.md,
  },
  tabContentWrapper: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    ...shadows.card,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.black,
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginBottom: 12,
  },
  activeChildCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  activeChildAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeChildAvatarEmoji: {
    fontSize: 28,
  },
  activeChildName: {
    fontSize: 17,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  activeChildMeta: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginTop: 2,
  },
  activeChildPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  activeChildPlanText: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: colors.coral,
  },
  activeStatusPill: {
    backgroundColor: '#E8F8F0',
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  activeStatusText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: '#2ECC71',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    ...shadows.card,
  },
  metricEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 28,
    fontFamily: fontFamilies.black,
    lineHeight: 32,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    marginTop: 3,
  },
  topicRow: {
    marginBottom: 12,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  topicIconSquircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicIconEmoji: {
    fontSize: 16,
  },
  topicName: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  topicCount: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: '#F0F4F8',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 80,
    paddingTop: 10,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    height: 60,
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  barDayText: {
    fontSize: 9,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  emptyStateText: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: colors.subtext,
    lineHeight: 19,
    textAlign: 'center',
    paddingVertical: 8,
  },
  memoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  factsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  factChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
  },
  factChipText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.text,
  },
  factChipRemove: {
    fontSize: 13,
    color: colors.subtext,
    fontWeight: 'bold',
  },
  clearMemoryBtn: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  clearMemoryBtnText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.coral,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.black,
    color: colors.text,
    marginBottom: 2,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.card,
  },
  historyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyIconEmoji: {
    fontSize: 19,
  },
  historyItemTitle: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  historyItemMeta: {
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginTop: 2,
  },
  historyChevronBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyChevronText: {
    fontSize: 16,
    color: '#2980B9',
    fontFamily: fontFamilies.bold,
  },
  fullTranscriptBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: 6,
  },
  fullTranscriptBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.coral,
  },
  limitCounterBox: {
    alignItems: 'center',
    marginVertical: 14,
  },
  limitBigNumber: {
    fontSize: 48,
    fontFamily: fontFamilies.black,
    color: colors.coral,
    lineHeight: 52,
  },
  limitUnitsText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    marginTop: 2,
  },
  limitTrack: {
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    height: 10,
    width: '100%',
    marginVertical: 12,
    overflow: 'hidden',
  },
  limitFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: colors.coral,
  },
  limitUsageText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  limitPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnActive: {
    borderColor: colors.coral,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  presetBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  presetBtnTextActive: {
    color: colors.coral,
    fontFamily: fontFamilies.black,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  scheduleLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  controlSub: {
    fontSize: 11,
    fontFamily: fontFamilies.regular,
    color: colors.subtext,
    marginTop: 2,
  },
  retentionPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  retentionPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
  },
  retentionPillActive: {
    backgroundColor: colors.coral,
  },
  retentionPillText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  retentionPillTextActive: {
    color: colors.white,
  },
  limitsLockedContainer: {
    marginBottom: 16,
  },
  limitsLockedCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...shadows.card,
  },
  limitsLockedBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  limitsLockedTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.black,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  limitsLockedDesc: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  limitsComparisonBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    gap: 8,
  },
  limitsComparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitsComparisonLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  limitsComparisonVal: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  limitsFeaturesList: {
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  limitsFeatureItem: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  limitsUnlockBtn: {
    width: '100%',
    backgroundColor: colors.coral,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  limitsUnlockBtnText: {
    fontSize: 14,
    fontFamily: fontFamilies.black,
    color: '#FFFFFF',
  },
  limitsUpgradeBanner: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.25)',
    alignItems: 'center',
  },
  limitsUpgradeText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.coral,
    textAlign: 'center',
  },
  membershipCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
    ...shadows.card,
  },
  membershipCardGradient: {
    padding: 18,
    borderRadius: 20,
  },
  membershipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membershipIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipSubText: {
    fontSize: 10,
    fontFamily: fontFamilies.black,
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.8,
  },
  membershipTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.black,
    color: '#FFFFFF',
    marginTop: 1,
  },
  membershipStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusPillPremium: {
    backgroundColor: '#FFD700',
  },
  statusPillFree: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  membershipStatusText: {
    fontSize: 10,
    fontFamily: fontFamilies.black,
    letterSpacing: 0.5,
  },
  statusTextPremium: {
    color: '#1A2A44',
  },
  statusTextFree: {
    color: '#FFFFFF',
  },
  membershipFeaturesText: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 14,
  },
  membershipActionBtn: {
    backgroundColor: colors.coral,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipActionBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.black,
    color: '#FFFFFF',
  },
  manageChildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  manageChildAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageChildName: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  manageChildGrade: {
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginTop: 1,
  },
  manageChildEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8F9FA',
  },
  manageChildEditText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  addAnotherChildBtn: {
    width: '100%',
    marginTop: 14,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.4)',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addAnotherChildText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.coral,
  },
  sectionCategoryHeader: {
    fontSize: 10,
    fontFamily: fontFamilies.black,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#9CA3AF',
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: 4,
  },
  groupedListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    ...shadows.card,
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  groupedIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedRowTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  groupedRowSubtitle: {
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
    marginTop: 1,
  },
  groupedChevron: {
    fontSize: 18,
    color: '#D1D5DB',
  },
  deleteAccountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginTop: 6,
  },
  deleteAccountText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.error,
  },
  signOutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    ...shadows.card,
  },
  signOutText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: '#EF4444',
    marginLeft: 12,
  },
  noChildCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...shadows.card,
  },
  noChildEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  noChildTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    marginBottom: 4,
  },
  noChildSubtitle: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: colors.subtext,
    textAlign: 'center',
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheetCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalCardCenter: {
    width: '90%',
    alignSelf: 'center',
    marginVertical: 'auto',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    ...shadows.card,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFieldLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
    marginTop: 10,
    marginBottom: 6,
  },
  modalTextInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fontFamilies.regular,
    color: colors.text,
  },
  gradePickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  gradePickerPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
  },
  gradePickerPillActive: {
    backgroundColor: colors.coral,
  },
  gradePickerText: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    color: colors.text,
  },
  gradePickerTextActive: {
    color: colors.white,
  },
  modalErrorText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    color: colors.error,
    marginTop: 8,
  },
  modalPrimaryBtn: {
    backgroundColor: '#1E3A5F',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
    ...shadows.card,
  },
  modalPrimaryBtnText: {
    fontSize: 15,
    fontFamily: fontFamilies.black,
    color: colors.white,
  },
  modalDangerBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  modalDangerBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.error,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.black,
    color: colors.error,
    marginBottom: 8,
  },
  deleteModalSub: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: colors.subtext,
    lineHeight: 17,
    marginBottom: 8,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  modalConfirmDeleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  modalConfirmDeleteBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.black,
    color: colors.white,
  },
});
