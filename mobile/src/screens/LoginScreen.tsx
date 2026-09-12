import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { login, saveToken } from '../services/api';
import { getApiUrl, loadSavedApiUrl } from '../services/config';
import ServerConfigModal from '../components/ServerConfigModal';

type Props = {
  onLoggedIn: () => void;
  onGoToRegister: () => void;
};

export default function LoginScreen({ onLoggedIn, onGoToRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setErrorMsg('Please fill in both fields.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email, password);
      await saveToken(result.session.access_token, result.userId);
      onLoggedIn();
    } catch (err: any) {
      setErrorMsg(err.message);
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
      <Text style={styles.title}>Welcome Back 🦉</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {isNetworkError && (
        <Pressable style={styles.connectionFixCard} onPress={() => setShowServerModal(true)}>
          <Text style={styles.connectionFixTitle}>⚠️ Cannot reach {serverUrl}</Text>
          <Text style={styles.connectionFixSub}>
            Tap here to change Server IP to your computer's local Wi-Fi IP (e.g. http://192.168.18.95:3003)
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </Pressable>

      <Pressable onPress={onGoToRegister}>
        <Text style={styles.link}>New here? Create an account</Text>
      </Pressable>

      <Pressable style={styles.footerContainer} onPress={() => setShowServerModal(true)}>
        <Text style={styles.footerText}>⚙️ Server: {serverUrl} (Tap to change)</Text>
      </Pressable>

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
  container: { flex: 1, backgroundColor: '#f7f9fc', justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a73e8', textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  button: { backgroundColor: '#1a73e8', borderRadius: 14, padding: 15, marginTop: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 },
  link: { color: '#1a73e8', textAlign: 'center', marginTop: 16, fontWeight: '600' },
  error: { color: '#EA4335', marginBottom: 10, textAlign: 'center', fontSize: 13 },
  connectionFixCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  connectionFixTitle: {
    color: '#856404',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
    textAlign: 'center',
  },
  connectionFixSub: {
    color: '#856404',
    fontSize: 12,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  footerContainer: {
    marginTop: 30,
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
});
