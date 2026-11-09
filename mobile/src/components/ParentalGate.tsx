import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { fontFamilies, colors } from '../theme';
import {
  isPinConfigured,
  verifyPin,
  savePin,
  getLockoutStatus,
} from '../services/pinService';
import { login, getCurrentUserEmail } from '../services/api';

type Props = {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

type GateMode =
  | 'enter_pin'
  | 'setup_verify_password'
  | 'setup_create_pin'
  | 'setup_confirm_pin'
  | 'forgot_verify_password';

export default function ParentalGate({ visible, onSuccess, onCancel }: Props) {
  const [mode, setMode] = useState<GateMode>('enter_pin');
  const [pin, setPin] = useState<string>('');
  const [tempFirstPin, setTempFirstPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSec, setLockoutSec] = useState<number>(0);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lockoutIntervalRef = useRef<any>(null);

  // Initialize gate state whenever modal opens
  useEffect(() => {
    if (!visible) {
      if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
      setPin('');
      setErrorMsg(null);
      setPasswordInput('');
      setLoading(false);
      return;
    }

    checkInitialState();
  }, [visible]);

  const checkInitialState = async () => {
    const lockout = await getLockoutStatus();
    if (lockout.isLocked) {
      setLockoutSec(lockout.secondsRemaining);
      startLockoutTimer(lockout.secondsRemaining);
    } else {
      setLockoutSec(0);
    }

    const hasPin = await isPinConfigured();
    if (!hasPin) {
      setMode('setup_verify_password');
    } else {
      setMode('enter_pin');
    }
  };

  const startLockoutTimer = (initialSec: number) => {
    if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
    let sec = initialSec;
    lockoutIntervalRef.current = setInterval(() => {
      sec -= 1;
      if (sec <= 0) {
        clearInterval(lockoutIntervalRef.current);
        setLockoutSec(0);
        setErrorMsg(null);
      } else {
        setLockoutSec(sec);
      }
    }, 1000);
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = async (digit: string) => {
    if (lockoutSec > 0 || loading) return;
    if (pin.length >= 4) return;

    const newPin = pin + digit;
    setPin(newPin);
    setErrorMsg(null);

    if (newPin.length === 4) {
      // 4 digits completed -> evaluate depending on mode
      if (mode === 'enter_pin') {
        await handleVerifyPin(newPin);
      } else if (mode === 'setup_create_pin') {
        setTempFirstPin(newPin);
        setPin('');
        setMode('setup_confirm_pin');
      } else if (mode === 'setup_confirm_pin') {
        if (newPin === tempFirstPin) {
          await savePin(newPin);
          setPin('');
          onSuccess();
        } else {
          triggerShake();
          setErrorMsg('PINs do not match. Try again.');
          setPin('');
          setMode('setup_create_pin');
        }
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutSec > 0 || loading) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg(null);
    }
  };

  const handleVerifyPin = async (candidatePin: string) => {
    setLoading(true);
    try {
      const result = await verifyPin(candidatePin);
      if (result.success) {
        setPin('');
        onSuccess();
      } else {
        triggerShake();
        setPin('');
        if (result.isLocked) {
          setLockoutSec(result.secondsRemaining);
          startLockoutTimer(result.secondsRemaining);
          setErrorMsg(`Too many wrong attempts. Locked for ${result.secondsRemaining}s.`);
        } else {
          setErrorMsg('Wrong PIN. Try again!');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) {
      setErrorMsg('Please enter your account password');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const email = (await getCurrentUserEmail()) || 'test@kidsko.ai';
      await login(email, passwordInput.trim());
      // Password verified!
      setPasswordInput('');
      setPin('');
      setMode('setup_create_pin');
    } catch {
      setErrorMsg('Incorrect account password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        {/* Ambient radial glow container */}
        <View style={styles.cardContainer}>
          <View style={styles.glowOrb} />

          {/* Close button */}
          <Pressable
            style={styles.closeBtn}
            onPress={onCancel}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>

          {/* Password verification sub-screen (First-time setup or Forgot PIN) */}
          {mode === 'setup_verify_password' || mode === 'forgot_verify_password' ? (
            <View style={styles.contentBox}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconEmoji}>🛡️</Text>
              </View>
              <Text style={styles.title}>Parent Verification</Text>
              <Text style={styles.subtitle}>
                {mode === 'setup_verify_password'
                  ? 'Confirm your account password to set up your 4-digit Parent PIN.'
                  : 'Confirm your account password to reset your 4-digit Parent PIN.'}
              </Text>

              <TextInput
                style={[styles.passwordInput, !!errorMsg && styles.inputError]}
                placeholder="Account password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={passwordInput}
                onChangeText={(t) => {
                  setPasswordInput(t);
                  setErrorMsg(null);
                }}
                onSubmitEditing={handlePasswordSubmit}
              />

              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

              <Pressable
                style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
                onPress={handlePasswordSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionBtnText}>Continue →</Text>
                )}
              </Pressable>

              <Pressable style={styles.cancelTextBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            /* PIN Numpad Screen (Matches kidsko-final.html prototype) */
            <View style={styles.contentBox}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconEmoji}>🔐</Text>
              </View>
              <Text style={styles.title}>
                {mode === 'setup_create_pin'
                  ? 'Create Parent PIN'
                  : mode === 'setup_confirm_pin'
                  ? 'Confirm Parent PIN'
                  : 'Parents Area'}
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'setup_create_pin'
                  ? 'Choose a 4-digit PIN for parent settings'
                  : mode === 'setup_confirm_pin'
                  ? 'Re-enter your 4-digit PIN to confirm'
                  : 'This area is for parents only'}
              </Text>

              {lockoutSec > 0 ? (
                <View style={styles.lockoutBadge}>
                  <Text style={styles.lockoutText}>
                    ⏳ Gate locked. Try again in {lockoutSec}s
                  </Text>
                </View>
              ) : (
                <Text style={styles.hintText}>
                  {mode === 'enter_pin' ? 'Enter your 4-digit PIN' : 'Enter 4 digits'}
                </Text>
              )}

              {/* 4 Animated PIN Dots (id="pin-dots") */}
              <Animated.View
                style={[styles.pinDotsRow, { transform: [{ translateX: shakeAnim }] }]}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <View
                      key={idx}
                      style={[styles.pinDot, isFilled && styles.pinDotFilled]}
                    />
                  );
                })}
              </Animated.View>

              {/* Error message */}
              {errorMsg && lockoutSec === 0 ? (
                <Text style={styles.errorText}>{errorMsg}</Text>
              ) : null}

              {/* 3x4 Glass Numeric Keypad */}
              <View style={styles.keypadGrid}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <Pressable
                    key={digit}
                    style={({ pressed }) => [
                      styles.keyBtn,
                      pressed && styles.keyBtnPressed,
                      lockoutSec > 0 && styles.keyBtnDisabled,
                    ]}
                    onPress={() => handleKeyPress(digit)}
                    disabled={lockoutSec > 0}
                  >
                    <Text style={styles.keyDigit}>{digit}</Text>
                  </Pressable>
                ))}
                {/* Bottom row: Empty placeholder, 0, Backspace */}
                <View style={styles.keyBtnPlaceholder} />
                <Pressable
                  style={({ pressed }) => [
                    styles.keyBtn,
                    pressed && styles.keyBtnPressed,
                    lockoutSec > 0 && styles.keyBtnDisabled,
                  ]}
                  onPress={() => handleKeyPress('0')}
                  disabled={lockoutSec > 0}
                >
                  <Text style={styles.keyDigit}>0</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.keyBtn,
                    styles.keyBtnBack,
                    pressed && styles.keyBtnPressed,
                    lockoutSec > 0 && styles.keyBtnDisabled,
                  ]}
                  onPress={handleBackspace}
                  disabled={lockoutSec > 0}
                  accessibilityLabel="Backspace"
                >
                  <Text style={styles.keyBackSymbol}>⌫</Text>
                </Pressable>
              </View>

              {/* Forgot PIN fallback */}
              {mode === 'enter_pin' && (
                <Pressable
                  style={styles.forgotBtn}
                  onPress={() => setMode('forgot_verify_password')}
                >
                  <Text style={styles.forgotText}>Forgot PIN? Reset with password</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#16213E',
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 12,
  },
  glowOrb: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(41,128,185,0.22)',
    top: -50,
    right: -50,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '800',
  },
  contentBox: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  iconEmoji: {
    fontSize: 42,
  },
  title: {
    fontSize: 22,
    fontFamily: fontFamilies.black,
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  hintText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 24,
  },
  lockoutBadge: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 20,
  },
  lockoutText: {
    color: '#FF8A80',
    fontSize: 12,
    fontFamily: fontFamilies.bold,
  },
  pinDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 28,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pinDotFilled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    marginBottom: 16,
    textAlign: 'center',
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 280,
    gap: 10,
  },
  keyBtn: {
    width: '30%',
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ scale: 0.94 }],
  },
  keyBtnDisabled: {
    opacity: 0.35,
  },
  keyBtnPlaceholder: {
    width: '30%',
    height: 60,
  },
  keyBtnBack: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  keyDigit: {
    fontSize: 24,
    fontFamily: fontFamilies.extraBold,
    color: '#FFFFFF',
  },
  keyBackSymbol: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fontFamilies.bold,
  },
  forgotBtn: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  forgotText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    textDecorationLine: 'underline',
  },
  passwordInput: {
    width: '100%',
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  actionBtn: {
    width: '100%',
    height: 48,
    backgroundColor: colors.coralStrong,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    elevation: 4,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
  },
  cancelTextBtn: {
    marginTop: 14,
    paddingVertical: 8,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamilies.bold,
    fontSize: 13,
  },
});
