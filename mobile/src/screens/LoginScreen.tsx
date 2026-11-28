import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { login, saveToken, forgotPassword, resetPasswordWithOtp } from '../services/api';
import { getApiUrl, loadSavedApiUrl } from '../services/config';
import ServerConfigModal from '../components/ServerConfigModal';
import {
  LinearGradient,
  Button,
  PressScale,
  FadeSlideIn,
  useSafeAreaInsets,
  AskieCompanion,
  KeyboardAwareView,
  AppIcon,
} from '../ui';
import { colors, fontFamilies, gradients } from '../theme';

type Props = {
  onLoggedIn: () => void;
  onGoToRegister: () => void;
  sessionNote?: string | null;
};

export default function LoginScreen({ onLoggedIn, onGoToRegister, sessionNote }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(__DEV__ ? 'test@kidsko.ai' : '');
  const [password, setPassword] = useState(__DEV__ ? 'password123' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiUrl());

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'reset'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotResendTimer, setForgotResendTimer] = useState(0);

  useEffect(() => {
    if (forgotResendTimer <= 0) return;
    const t = setInterval(() => setForgotResendTimer((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [forgotResendTimer]);

  useEffect(() => {
    loadSavedApiUrl().then((saved) => {
      setServerUrl(saved);
    });
  }, []);

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg('Please fill in both email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      await saveToken(
        result.session.access_token,
        result.userId,
        email.trim(),
        result.session.refresh_token
      );
      onLoggedIn();
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendForgotCode = async () => {
    setForgotError(null);
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    if (
      cleanEmail.endsWith('@gmail.cm') ||
      cleanEmail.endsWith('@gmai.com') ||
      cleanEmail.endsWith('@gamil.com') ||
      cleanEmail.endsWith('@gmial.com')
    ) {
      setForgotError('Did you mean @gmail.com? Please check your email spelling.');
      return;
    }
    setForgotLoading(true);
    try {
      await forgotPassword(cleanEmail);
      setForgotEmail(cleanEmail);
      setForgotStep('reset');
      setForgotResendTimer(30);
      setForgotError(null);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to send recovery code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setForgotError(null);
    if (!forgotOtp || forgotOtp.trim().length < 6) {
      setForgotError('Please enter the verification code sent to your email.');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 8) {
      setForgotError('New password must be at least 8 characters long.');
      return;
    }
    setForgotLoading(true);
    try {
      await resetPasswordWithOtp(forgotEmail.trim(), forgotOtp.trim(), forgotNewPassword);
      setEmail(forgotEmail.trim());
      setPassword(forgotNewPassword);
      setForgotSuccess('Password updated successfully! You can now sign in.');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep('email');
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotSuccess(null);
      }, 1500);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to reset password. Please check the code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const isNetworkError =
    errorMsg &&
    (errorMsg.includes('ConnectException') ||
      errorMsg.includes('Failed to connect') ||
      errorMsg.includes('fetch failed') ||
      errorMsg.includes('Network request failed'));

  return (
    <View style={styles.container}>
      {/* ── Gradient Header with Mascot ── */}
      <LinearGradient
        colors={gradients.primary.colors}
        start={gradients.primary.start}
        end={gradients.primary.end}
        style={[
          styles.headerGradient,
          { paddingTop: insets.top + 16, paddingBottom: 28 },
        ]}
      >
        <FadeSlideIn delay={0}>
          <View style={styles.headerTopRow}>
            <View style={styles.brandRow}>
              <AskieCompanion size="s" state="idle" />
            </View>

            {/* Server settings button */}
            <Pressable
              onPress={() => setShowServerModal(true)}
              style={styles.gearButton}
              accessibilityLabel="Server Settings"
              accessibilityRole="button"
            >
              <Text style={styles.gearIcon}>⚙️</Text>
            </Pressable>
          </View>

          <Text style={styles.headline}>Welcome back! 👋</Text>
          <Text style={styles.subheadline}>Let's keep learning today 📚</Text>
        </FadeSlideIn>
      </LinearGradient>

      {/* ── Body / Form Area ── */}
      <KeyboardAwareView style={styles.keyboardContainer}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Email Field */}
          <FadeSlideIn delay={60}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View
                style={[
                  styles.inputContainer,
                  emailFocused && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="you@gmail.com"
                  placeholderTextColor={colors.subtext}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>
          </FadeSlideIn>

          {/* Password Field */}
          <FadeSlideIn delay={120}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  passwordFocused && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Your password"
                  placeholderTextColor={colors.subtext}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </Pressable>
              </View>
            </View>
          </FadeSlideIn>

          {/* Forgot Password Link */}
          <FadeSlideIn delay={130}>
            <View style={styles.forgotRow}>
              <Pressable
                onPress={() => {
                  setForgotEmail(email);
                  setForgotError(null);
                  setForgotSuccess(null);
                  setForgotStep('email');
                  setShowForgotModal(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Forgot Password"
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>
            </View>
          </FadeSlideIn>

          {/* Session-expired notice (from auto-logout) */}
          {sessionNote && (
            <FadeSlideIn delay={80}>
              <View style={[styles.errorContainer, { backgroundColor: 'rgba(255,160,0,0.13)', borderColor: '#FFA000' }]}>
                <Text style={[styles.errorText, { color: '#FFA000' }]}>⚠️ {sessionNote}</Text>
              </View>
            </FadeSlideIn>
          )}

          {/* Error notification */}
          {errorMsg && (
            <FadeSlideIn delay={140}>
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            </FadeSlideIn>
          )}

          {/* Network error connection helper */}
          {isNetworkError && (
            <FadeSlideIn delay={150}>
              <Pressable
                style={styles.connectionFixCard}
                onPress={() => setShowServerModal(true)}
              >
                <Text style={styles.connectionFixTitle}>⚠️ Cannot reach {serverUrl}</Text>
                <Text style={styles.connectionFixSub}>
                  Tap here to change Server IP to your computer's local Wi-Fi IP
                </Text>
              </Pressable>
            </FadeSlideIn>
          )}

          {/* Sign In Button */}
          <FadeSlideIn delay={180}>
            <PressScale style={styles.buttonScale}>
              <Button
                title="Sign In →"
                onPress={handleLogin}
                loading={loading}
                variant="primary"
              />
            </PressScale>
          </FadeSlideIn>

          {/* Switch to Register */}
          <FadeSlideIn delay={240}>
            <Pressable
              onPress={onGoToRegister}
              style={styles.switchLink}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              <Text style={styles.switchLinkText}>
                New here? <Text style={styles.switchLinkBold}>Create account</Text>
              </Text>
            </Pressable>

            {/* Server indicator */}
            <Pressable
              style={styles.serverRow}
              onPress={() => setShowServerModal(true)}
            >
              <Text style={styles.serverText}>Server: {serverUrl}</Text>
            </Pressable>
          </FadeSlideIn>
        </ScrollView>
      </KeyboardAwareView>

      <ServerConfigModal
        visible={showServerModal}
        onClose={() => setShowServerModal(false)}
        onSaved={(newUrl) => {
          setServerUrl(newUrl);
          setErrorMsg(null);
        }}
      />

      {/* ── Forgot Password Modal ── */}
      <Modal
        visible={showForgotModal}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <KeyboardAwareView style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ScrollView
            contentContainerStyle={styles.modalOverlayScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password 🔑</Text>
              <Pressable
                onPress={() => setShowForgotModal(false)}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close"
              >
                <AppIcon name="close" size={16} color={colors.subtext} strokeWidth={2.4} />
              </Pressable>
            </View>

            {forgotSuccess ? (
              <View style={styles.forgotSuccessBox}>
                <Text style={styles.forgotSuccessText}>🎉 {forgotSuccess}</Text>
              </View>
            ) : forgotStep === 'email' ? (
              <View>
                <Text style={styles.modalDescription}>
                  Enter the email address registered with your Kidsko account. We'll send you a 6-digit recovery code.
                </Text>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Parent Email</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="you@gmail.com"
                      placeholderTextColor={colors.subtext}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                    />
                  </View>
                </View>

                {forgotError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{forgotError}</Text>
                  </View>
                )}

                <Button
                  title="Send Recovery Code ✉️"
                  onPress={handleSendForgotCode}
                  loading={forgotLoading}
                  variant="primary"
                />
              </View>
            ) : (
              <View>
                <Text style={styles.modalDescription}>
                  We sent a verification code to{' '}
                  <Text style={{ fontFamily: fontFamilies.bold, color: colors.text }}>
                    {forgotEmail}
                  </Text>
                  . Check your inbox or spam folder, then enter the code and your new password below.
                </Text>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { letterSpacing: 3, fontFamily: fontFamilies.bold }]}
                      placeholder="12345678"
                      placeholderTextColor={colors.subtext}
                      keyboardType="number-pad"
                      maxLength={8}
                      value={forgotOtp}
                      onChangeText={setForgotOtp}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
                    {forgotResendTimer > 0 ? (
                      <Text style={{ fontSize: 12, color: colors.subtext, fontFamily: fontFamilies.semiBold }}>
                        Resend code in {forgotResendTimer}s
                      </Text>
                    ) : (
                      <Pressable onPress={handleSendForgotCode} disabled={forgotLoading}>
                        <Text style={{ fontSize: 12, color: colors.coral, fontFamily: fontFamilies.bold }}>
                          Resend Code
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>New Password (Min 8 chars)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="At least 8 characters"
                      placeholderTextColor={colors.subtext}
                      secureTextEntry
                      value={forgotNewPassword}
                      onChangeText={setForgotNewPassword}
                    />
                  </View>
                </View>

                {forgotError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{forgotError}</Text>
                  </View>
                )}

                <Button
                  title="Reset Password & Sign In 🔐"
                  onPress={handleResetPassword}
                  loading={forgotLoading}
                  variant="primary"
                />

                <Pressable
                  onPress={() => setForgotStep('email')}
                  style={{ marginTop: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                >
                  <AppIcon name="arrowLeft" size={14} color={colors.coral} strokeWidth={2.4} />
                  <Text style={styles.forgotBackLink}>Change email</Text>
                </Pressable>
              </View>
            )}
            </View>
          </ScrollView>
        </KeyboardAwareView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    paddingHorizontal: 22,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mascotBadge: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotEmoji: {
    fontSize: 24,
  },
  brandTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.black,
    color: colors.white,
  },
  brandDot: {
    color: colors.sun,
  },
  gearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearIcon: {
    fontSize: 18,
  },
  headline: {
    fontSize: 26,
    fontFamily: fontFamilies.black,
    color: colors.white,
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.extraBold,
    color: colors.subtext,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputFocused: {
    borderColor: colors.coral,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  eyeButton: {
    padding: 6,
    marginLeft: 4,
  },
  eyeIcon: {
    fontSize: 18,
  },
  buttonScale: {
    width: '100%',
    marginTop: 6,
    marginBottom: 16,
  },
  switchLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLinkText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  switchLinkBold: {
    color: colors.coral,
    fontFamily: fontFamilies.black,
  },
  serverRow: {
    alignItems: 'center',
    marginTop: 20,
    opacity: 0.6,
  },
  serverText: {
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    color: colors.subtext,
  },
  errorContainer: {
    backgroundColor: colors.errorBg,
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    textAlign: 'center',
  },
  connectionFixCard: {
    backgroundColor: colors.warningBg,
    borderWidth: 1.5,
    borderColor: colors.warningBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  connectionFixTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.warningText,
    marginBottom: 4,
  },
  connectionFixSub: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: colors.warningText,
    lineHeight: 18,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
    paddingRight: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.coralStrong,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalOverlayScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.black,
    color: colors.text,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  modalDescription: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: colors.subtext,
    lineHeight: 19,
    marginBottom: 16,
  },
  modalField: {
    marginBottom: 14,
  },
  forgotSuccessBox: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  forgotSuccessText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: '#2E7D32',
    textAlign: 'center',
  },
  forgotBackLink: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
});
