import { fontFamilies, colors } from '../theme';
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getApiUrl, setCustomApiUrl, resetApiUrlToDefault } from '../services/config';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: (newUrl: string) => void;
};

export default function ServerConfigModal({ visible, onClose, onSaved }: Props) {
  const [urlInput, setUrlInput] = useState(getApiUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state whenever modal opens
  React.useEffect(() => {
    if (visible) {
      setUrlInput(getApiUrl());
      setTestResult(null);
    }
  }, [visible]);

  const handleTestAndSave = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setTestResult({ success: false, message: 'Please enter a valid URL.' });
      return;
    }

    let clean = trimmed.replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${clean}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        await setCustomApiUrl(clean);
        setTestResult({ success: true, message: `Connected successfully! (HTTP ${res.status})` });
        onSaved?.(clean);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setTestResult({
          success: false,
          message: `Server returned HTTP ${res.status}. Check backend.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.name === 'AbortError'
          ? 'Connection timed out (4s). Is your PC and phone on the same Wi-Fi?'
          : `Failed: ${err?.message || 'Could not connect'}.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleForceSave = async () => {
    let clean = urlInput.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    await setCustomApiUrl(clean);
    onSaved?.(clean);
    onClose();
  };

  const handleResetDefault = async () => {
    const def = await resetApiUrlToDefault();
    setUrlInput(def);
    setTestResult({ success: true, message: `Reset to default: ${def}` });
    onSaved?.(def);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Server Settings 🌐</Text>
          <Text style={styles.subtitle}>
            When using a real phone, enter your computer's local Wi-Fi IP (e.g. http://192.168.18.95:3003) or an ngrok tunnel URL.
          </Text>

          <Text style={styles.label}>Backend Server URL:</Text>
          <TextInput
            style={styles.input}
            value={urlInput}
            onChangeText={(t) => {
              setUrlInput(t);
              setTestResult(null);
            }}
            placeholder="http://192.168.X.X:3003"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {testResult && (
            <View
              style={[
                styles.resultBadge,
                testResult.success ? styles.resultSuccess : styles.resultError,
              ]}
            >
              <Text
                style={[
                  styles.resultText,
                  testResult.success ? styles.resultSuccessText : styles.resultErrorText,
                ]}
              >
                {testResult.success ? '✅ ' : '❌ '}
                {testResult.message}
              </Text>
            </View>
          )}

          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleTestAndSave}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Test & Connect</Text>
            )}
          </Pressable>

          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnSecondary, styles.halfBtn]}
              onPress={handleForceSave}
            >
              <Text style={styles.btnSecondaryText}>Save Anyway</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnSecondary, styles.halfBtn]}
              onPress={handleResetDefault}
            >
              <Text style={styles.btnSecondaryText}>Reset Default</Text>
            </Pressable>
          </View>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 22,
    shadowColor: colors.text,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: fontFamilies.extraBold,
    color: colors.coralStrong,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.subtext,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  resultBadge: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  resultSuccess: {
    backgroundColor: colors.cardBgMuted,
  },
  resultError: {
    backgroundColor: colors.errorBg,
  },
  resultText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
  },
  resultSuccessText: {
    color: colors.success,
  },
  resultErrorText: {
    color: colors.error,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.coralStrong,
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: colors.white,
    fontSize: 15,
    fontFamily: fontFamilies.bold,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  halfBtn: {
    flex: 1,
  },
  btnSecondary: {
    backgroundColor: colors.borderLight,
  },
  btnSecondaryText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.subtext,
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
  },
});
