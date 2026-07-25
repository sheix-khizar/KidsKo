import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { register, saveToken } from '../services/api';

type Props = {
  onRegistered: () => void;
  onGoToLogin: () => void;
};

export default function RegisterScreen({ onRegistered, onGoToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMsg(null);
    if (!email || !password) {
      setErrorMsg('Please fill in both fields.');
      return;
    }
    setLoading(true);
    try {
      const result = await register(email, password);
      await saveToken(result.session.access_token);
      onRegistered();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account 🦉</Text>

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
        placeholder="Password (min 6 characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
      </Pressable>

      <Pressable onPress={onGoToLogin}>
        <Text style={styles.link}>Already have an account? Sign In</Text>
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
