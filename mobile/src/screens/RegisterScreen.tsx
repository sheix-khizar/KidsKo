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
import { Screen, Mascot, Button, Card } from '../ui';
import { colors, radii, typography, spacing } from '../theme';

type Props = {
  onRegistered: () => void;
  onGoToLogin: () => void;
};

export default function RegisterScreen({ onRegistered, onGoToLogin }: Props) {
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
    <Screen>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Mascot */}
          <View style={styles.header}>
            <Mascot size="m" />
            <Text style={styles.title}>Join Kidsko.ai</Text>
            <Text style={styles.subtitle}>Create your parent account to get started 🦉</Text>
          </View>

          {/* Form Card */}
          <Card style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Parent Email</Text>
              <TextInput
                style={styles.input}
                placeholder="name@email.com"
                placeholderTextColor={colors.subtext}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
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
                  accessibilityRole="button"
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

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              variant="primary"
              style={styles.submitButton}
            />

            <Pressable
              onPress={onGoToLogin}
              style={styles.switchLink}
              accessibilityRole="button"
              accessibilityLabel="Sign in to existing account"
            >
              <Text style={styles.switchLinkText}>
                Already have an account? <Text style={styles.switchLinkBold}>Sign In</Text>
              </Text>
            </Pressable>
          </Card>

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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.subtext,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    ...typography.label,
    fontSize: 14,
    color: colors.text,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorContainer: {
    backgroundColor: '#FFEAEA',
    borderWidth: 1,
    borderColor: colors.coralStrong,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.coralStrong,
    textAlign: 'center',
    fontWeight: '700',
  },
  connectionFixCard: {
    backgroundColor: '#FFF4E5',
    borderColor: colors.orange,
    borderWidth: 1.5,
    borderRadius: radii.md,
    padding: spacing.md,
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
  submitButton: {
    marginTop: spacing.xs,
  },
  switchLink: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchLinkText: {
    ...typography.body,
    color: colors.subtext,
  },
  switchLinkBold: {
    color: colors.coralStrong,
    fontWeight: '800',
  },
  footerContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  footerText: {
    ...typography.caption,
    color: colors.subtext,
  },
});
