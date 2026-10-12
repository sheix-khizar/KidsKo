import { useState, useEffect } from 'react';
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
import { Screen, Button, LinearGradient } from '../ui';
import { colors, radii, gradients } from '../theme';

type Props = {
  onRegistered: () => void;
  onGoToLogin: () => void;
};

export default function RegisterScreen({ onRegistered, onGoToLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    setLoading(true);
    try {
      const result = await register(email, password);
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
    <Screen safeBottom={false}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Prototype Gradient Header */}
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBanner}
        >
          <View style={styles.brandRow}>
            <View style={styles.mascotBadge}>
              <Text style={styles.mascotEmoji}>🦉</Text>
            </View>
            <Text style={styles.brandTitle}>
              Kidsko<Text style={{ color: colors.sun }}>.ai</Text>
            </Text>
          </View>
          <Text style={styles.headerTitle}>Create your account! 🎉</Text>
          <Text style={styles.headerSubtitle}>Join thousands of young learners</Text>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Continue with Google button */}
          <Pressable
            style={styles.googleBtn}
            onPress={() => {
              setEmail('parent@example.com');
              setPassword('password123');
            }}
          >
            <Text style={styles.googleIconText}>🌐</Text>
            <Text style={styles.googleBtnText}>Sign up with Google</Text>
          </Pressable>

          {/* Or Divider */}
          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or with email</Text>
            <View style={styles.orLine} />
          </View>

          {/* Form Fields */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Parent / Student Name</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Aisha"
              placeholderTextColor={colors.subtext}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Parent Email</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="you@gmail.com"
              placeholderTextColor={colors.subtext}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.fieldInput, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
                placeholder="Min 6 characters"
                placeholderTextColor={colors.subtext}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword((prev) => !prev)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </Pressable>
            </View>
          </View>

          {errorMsg && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {isNetworkError && (
            <Pressable
              style={styles.connectionFixCard}
              onPress={() => setShowServerModal(true)}
            >
              <Text style={styles.connectionFixTitle}>⚠️ Cannot reach {serverUrl}</Text>
              <Text style={styles.connectionFixSub}>
                Tap here to change Server IP to your computer's local Wi-Fi IP
              </Text>
            </Pressable>
          )}

          {/* Submit Button */}
          <Button
            title="Create Account 🚀"
            onPress={handleRegister}
            loading={loading}
            variant="primary"
            style={styles.submitBtn}
          />

          {/* Switch to Login */}
          <Pressable onPress={onGoToLogin} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchHighlight}>Sign In</Text>
            </Text>
          </Pressable>

          <Text style={styles.safeBadge}>
            🔒 Safe for kids · No ads · Always private
          </Text>

          {/* Server Config Footer */}
          <Pressable
            style={styles.footerContainer}
            onPress={() => setShowServerModal(true)}
          >
            <Text style={styles.footerText}>⚙️ Server: {serverUrl} (Tap to change)</Text>
          </Pressable>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBanner: {
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
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
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '700',
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  googleIconText: {
    fontSize: 20,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  orLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.subtext,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.subtext,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingRight: 12,
  },
  eyeButton: {
    padding: 6,
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorContainer: {
    backgroundColor: '#FFEAEA',
    borderWidth: 1,
    borderColor: colors.coralStrong,
    borderRadius: radii.sm,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: colors.coralStrong,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 13,
  },
  connectionFixCard: {
    backgroundColor: '#FFF4E5',
    borderColor: colors.orange,
    borderWidth: 1.5,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 14,
  },
  connectionFixTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
  },
  connectionFixSub: {
    color: colors.subtext,
    fontSize: 12,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  submitBtn: {
    marginTop: 6,
    marginBottom: 14,
  },
  switchRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.subtext,
  },
  switchHighlight: {
    color: colors.coralStrong,
    fontWeight: '900',
  },
  safeBadge: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#B2BEC3',
    marginTop: 16,
  },
  footerContainer: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 11,
    color: colors.subtext,
  },
});
