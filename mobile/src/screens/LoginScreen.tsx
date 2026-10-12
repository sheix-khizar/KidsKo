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
import { login, saveToken } from '../services/api';
import { getApiUrl, loadSavedApiUrl } from '../services/config';
import ServerConfigModal from '../components/ServerConfigModal';
import { Screen, Button, LinearGradient } from '../ui';
import { colors, radii, gradients } from '../theme';

type Props = {
  onLoggedIn: () => void;
  onGoToRegister: () => void;
};

export default function LoginScreen({ onLoggedIn, onGoToRegister }: Props) {
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

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg('Please fill in both email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email, password);
      await saveToken(result.session.access_token, result.userId);
      onLoggedIn();
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
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
          <Text style={styles.headerTitle}>Welcome back! 👋</Text>
          <Text style={styles.headerSubtitle}>Let's keep learning today 📚</Text>
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
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </Pressable>

          {/* Or Divider */}
          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or sign in with email</Text>
            <View style={styles.orLine} />
          </View>

          {/* Input Fields */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
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
                placeholder="Your password"
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

          <View style={styles.forgotRow}>
            <Pressable onPress={() => setErrorMsg('Password reset is sent to your registered email.')}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
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

          {/* Sign In Button */}
          <Button
            title="Sign In →"
            onPress={handleLogin}
            loading={loading}
            variant="primary"
            style={styles.submitBtn}
          />

          {/* Switch to Register */}
          <Pressable onPress={onGoToRegister} style={styles.switchRow}>
            <Text style={styles.switchText}>
              New here? <Text style={styles.switchHighlight}>Create account</Text>
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
    color: colors.white,
    letterSpacing: -0.5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.white,
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
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 18,
  },
  googleIconText: {
    fontSize: 18,
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
    backgroundColor: '#FFF8F0',
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
    backgroundColor: '#FFF8F0',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingRight: 12,
  },
  eyeButton: {
    padding: 8,
  },
  eyeIcon: {
    fontSize: 18,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: 18,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.coral,
  },
  errorContainer: {
    backgroundColor: '#FFEAEA',
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
  connectionFixCard: {
    backgroundColor: '#FFF8E7',
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 16,
  },
  connectionFixTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  connectionFixSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.subtext,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: 4,
    marginBottom: 16,
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
    color: colors.coral,
    fontWeight: '900',
  },
  safeBadge: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#B2BEC3',
    marginTop: 16,
    lineHeight: 18,
  },
  footerContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.subtext,
  },
});
