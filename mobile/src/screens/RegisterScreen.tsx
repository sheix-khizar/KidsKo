import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
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
} from '../ui';
import { colors, fontFamilies, gradients } from '../theme';

type Props = {
  onRegistered: () => void;
  onGoToLogin: () => void;
};

export default function RegisterScreen({ onRegistered, onGoToLogin }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (confirmPassword && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await register(email.trim(), password);
      await saveToken(result.session.access_token, result.userId);
      onRegistered();
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
              <View style={styles.mascotBadge}>
                <Text style={styles.mascotEmoji}>🦉</Text>
              </View>
              <Text style={styles.brandTitle}>
                Kidsko<Text style={styles.brandDot}>.ai</Text>
              </Text>
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
                  placeholder="Min 6 characters"
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
          <FadeSlideIn delay={160}>
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
    color: '#B2BEC3',
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
    backgroundColor: '#FFEAEA',
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
    backgroundColor: '#FFF3CD',
    borderWidth: 1.5,
    borderColor: '#FFEEBA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  connectionFixTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: '#856404',
    marginBottom: 4,
  },
  connectionFixSub: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: '#856404',
    lineHeight: 18,
  },
});
