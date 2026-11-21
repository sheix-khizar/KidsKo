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
} from 'react-native';
import { register, saveToken } from '../services/api';
import { getApiUrl, loadSavedApiUrl } from '../services/config';
import ServerConfigModal from '../components/ServerConfigModal';
import {
  LinearGradient,
  Button,
  PressScale,
  FadeSlideIn,
  useSafeAreaInsets,
  AskieCompanion,
} from '../ui';
import { colors, fontFamilies, gradients } from '../theme';

type Props = {
  onRegistered: () => void;
  onRequireVerification: (email: string) => void;
  onGoToLogin: () => void;
};

export default function RegisterScreen({ onRegistered, onRequireVerification, onGoToLogin }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [parentConsentChecked, setParentConsentChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiUrl());

  useEffect(() => {
    loadSavedApiUrl().then((saved) => {
      setServerUrl(saved);
    });
  }, []);

  const handleRegister = async () => {
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg('Please fill in both email and password.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (
      cleanEmail.endsWith('@gmail.cm') ||
      cleanEmail.endsWith('@gmai.com') ||
      cleanEmail.endsWith('@gamil.com')
    ) {
      setErrorMsg('Did you mean @gmail.com? Please check your email spelling.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!parentConsentChecked) {
      setErrorMsg('Please confirm you are an adult parent or legal guardian.');
      return;
    }

    setLoading(true);
    try {
      const result = await register(email.trim(), password);
      if (result.needsVerification) {
        onRequireVerification(email.trim());
      } else if (result.session) {
        await saveToken(
          result.session.access_token,
          result.userId,
          email.trim(),
          result.session.refresh_token
        );
        onRegistered();
      } else {
        onRequireVerification(email.trim());
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
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

          <Text style={styles.headline}>Create your account! 🎉</Text>
          <Text style={styles.subheadline}>Join thousands of young learners</Text>
        </FadeSlideIn>
      </LinearGradient>

      {/* ── Body / Form Area ── */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Your Name Field */}
          <FadeSlideIn delay={40}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Your Name</Text>
              <View
                style={[
                  styles.inputContainer,
                  nameFocused && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Aisha"
                  placeholderTextColor={colors.subtext}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                />
              </View>
            </View>
          </FadeSlideIn>

          {/* Email Field */}
          <FadeSlideIn delay={80}>
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
                  placeholder="Min 8 characters"
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

          {/* Confirm Password Field */}
          <FadeSlideIn delay={150}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  confirmPasswordFocused && styles.inputFocused,
                ]}
              >
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Repeat password"
                  placeholderTextColor={colors.subtext}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setConfirmPasswordFocused(true)}
                  onBlur={() => setConfirmPasswordFocused(false)}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                  accessibilityLabel={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.eyeIcon}>
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </FadeSlideIn>

          {/* Parental Consent Checkbox & COPPA Notice */}
          <FadeSlideIn delay={170}>
            <Pressable
              style={styles.consentRow}
              onPress={() => setParentConsentChecked((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: parentConsentChecked }}
            >
              <View style={[styles.checkbox, parentConsentChecked && styles.checkboxChecked]}>
                {parentConsentChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentText}>
                I confirm I am an adult parent or legal guardian (Age 18+).
              </Text>
            </Pressable>
            <Text style={styles.termsNote}>
              By creating an account, you agree to Kidsko's{' '}
              <Text style={styles.legalLink}>Terms of Service</Text> and{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>.
            </Text>
          </FadeSlideIn>

          {/* Error notification */}
          {errorMsg && (
            <FadeSlideIn delay={180}>
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            </FadeSlideIn>
          )}

          {/* Network error connection helper */}
          {isNetworkError && (
            <FadeSlideIn delay={190}>
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

          {/* Create Account Button */}
          <FadeSlideIn delay={200}>
            <PressScale style={styles.buttonScale}>
              <Button
                title="Create Account 🚀"
                onPress={handleRegister}
                loading={loading}
                variant="primary"
              />
            </PressScale>
          </FadeSlideIn>

          {/* Switch to Login */}
          <FadeSlideIn delay={240}>
            <Pressable
              onPress={onGoToLogin}
              style={styles.switchLink}
              accessibilityRole="button"
              accessibilityLabel="Sign In"
            >
              <Text style={styles.switchLinkText}>
                Already have an account? <Text style={styles.switchLinkBold}>Sign In</Text>
              </Text>
            </Pressable>

            {/* Privacy note */}
            <Text style={styles.privacyNote}>
              🔒 Safe for kids · No ads · Always private
            </Text>

            {/* Server indicator */}
            <Pressable
              style={styles.serverRow}
              onPress={() => setShowServerModal(true)}
            >
              <Text style={styles.serverText}>Server: {serverUrl}</Text>
            </Pressable>
          </FadeSlideIn>
        </ScrollView>
      </KeyboardAvoidingView>

      <ServerConfigModal
        visible={showServerModal}
        onClose={() => setShowServerModal(false)}
        onSaved={(newUrl) => {
          setServerUrl(newUrl);
          setErrorMsg(null);
        }}
      />
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
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.coralStrong,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: colors.coralStrong,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    lineHeight: 18,
  },
  termsNote: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: colors.subtext,
    lineHeight: 17,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  legalLink: {
    color: colors.coralStrong,
    fontFamily: fontFamilies.bold,
    textDecorationLine: 'underline',
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
  privacyNote: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: fontFamilies.semiBold,
    color: colors.mutedText,
    marginTop: 14,
    lineHeight: 18,
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
});
