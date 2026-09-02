import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { login, saveToken } from '../services/api';

type Props = {
  onLoggedIn: () => void;
  onGoToRegister: () => void;
};

export default function LoginScreen({ onLoggedIn, onGoToRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </Pressable>

      <Pressable onPress={onGoToRegister}>
        <Text style={styles.link}>New here? Create an account</Text>
      </Pressable>
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
  error: { color: '#EA4335', marginBottom: 10, textAlign: 'center' },
});
