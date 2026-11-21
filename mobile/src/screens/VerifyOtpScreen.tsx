import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { verifyOtp, resendOtp, saveToken } from '../services/api';
import {
  LinearGradient,
  Button,
  PressScale,
  FadeSlideIn,
  Mascot,
  useSafeAreaInsets,
} from '../ui';
import { colors, fontFamilies, gradients } from '../theme';

type Props = {
  email: string;
  onVerified: () => void;
  onBack: () => void;
};

export default function VerifyOtpScreen({ email, onVerified, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Countdown timer for code resend
  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  const handleDigitChange = (text: string, index: number) => {
    setErrorMsg(null);

    // Handle full 6-digit code paste
    const cleanNumbers = text.replace(/[^0-9]/g, '');
    if (cleanNumbers.length > 1) {
      const pasted = cleanNumbers.slice(0, 6).split('');
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setDigits(newDigits);
      const nextFocus = Math.min(cleanNumbers.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanNumbers;
    setDigits(newDigits);

    // Auto-advance to next box
    if (cleanNumbers && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const code = digits.join('');

  const handleVerify = async () => {
    setErrorMsg(null);
    if (code.length < 6) {
      setErrorMsg('Please enter the complete 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOtp(email.trim(), code, 'signup');
      if (result.session) {
        await saveToken(
          result.session.access_token,
          result.userId,
          email.trim(),
          result.session.refresh_token
        );
      }
      onVerified();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setErrorMsg(null);
    setResending(true);
    try {
      await resendOtp(email.trim(), 'signup');
      setResendTimer(30);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      Alert.alert('Code Sent', `A new 6-digit verification code has been sent to ${email}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

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
          <View style={styles.topBar}>
            <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back to sign up">
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>
            <View style={styles.mascotBadge}>
              <Mascot size="m" />
            </View>
          </View>

          <Text style={styles.headline}>Check your Gmail 📬</Text>
          <Text style={styles.subheadline}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
        </FadeSlideIn>
      </LinearGradient>

      {/* ── OTP Form ── */}
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
          <FadeSlideIn delay={80}>
            <Text style={styles.otpLabel}>Verification Code</Text>
            <View style={styles.otpRow}>
              {digits.map((digit, index) => {
                const isFocused = focusedIndex === index;
                return (
                  <View
                    key={index}
                    style={[
                      styles.digitBox,
                      isFocused && styles.digitBoxFocused,
                      Boolean(digit) && styles.digitBoxFilled,
                    ]}
                  >
                    <TextInput
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      style={styles.digitInput}
                      value={digit}
                      onChangeText={(t) => handleDigitChange(t, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      onFocus={() => setFocusedIndex(index)}
                      keyboardType="number-pad"
                      maxLength={6}
                      selectTextOnFocus
                      textAlign="center"
                      autoFocus={index === 0}
                    />
                  </View>
                );
              })}
            </View>
          </FadeSlideIn>

          {/* Error Banner */}
          {errorMsg ? (
            <FadeSlideIn delay={20}>
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            </FadeSlideIn>
          ) : null}

          {/* Verify Button */}
          <FadeSlideIn delay={140}>
            <Button
              title="Verify & Continue"
              variant="primary"
              loading={loading}
              onPress={handleVerify}
              style={styles.verifyButton}
            />
          </FadeSlideIn>

          {/* Resend Code Section */}
          <FadeSlideIn delay={180}>
            <View style={styles.resendSection}>
              <Text style={styles.resendPrompt}>Didn't receive the code? </Text>
              {resendTimer > 0 ? (
                <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
              ) : (
                <Pressable onPress={handleResend} disabled={resending} style={styles.resendPressable}>
                  {resending ? (
                    <ActivityIndicator size="small" color={colors.coralStrong} />
                  ) : (
                    <Text style={styles.resendActionText}>Resend Code</Text>
                  )}
                </Pressable>
              )}
            </View>

            <PressScale onPress={onBack} style={styles.changeEmailRow}>
              <Text style={styles.changeEmailText}>Wrong email address? <Text style={styles.changeEmailLink}>Change</Text></Text>
            </PressScale>
          </FadeSlideIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerGradient: {
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: -2,
  },
  mascotBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  headline: {
    fontSize: 26,
    fontFamily: fontFamilies.black,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
  },
  subheadline: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  emailHighlight: {
    fontFamily: fontFamilies.bold,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  otpLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  digitBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitBoxFocused: {
    borderColor: colors.coralStrong,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.coralStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  digitBoxFilled: {
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },
  digitInput: {
    width: '100%',
    height: '100%',
    fontSize: 24,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    color: '#DC2626',
  },
  verifyButton: {
    width: '100%',
    marginBottom: 20,
  },
  resendSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  resendPrompt: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    color: colors.subtext,
  },
  timerText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.subtext,
  },
  resendPressable: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  resendActionText: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.coralStrong,
  },
  changeEmailRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  changeEmailText: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: colors.subtext,
  },
  changeEmailLink: {
    fontFamily: fontFamilies.bold,
    color: colors.coralStrong,
  },
});
