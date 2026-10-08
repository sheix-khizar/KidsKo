import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal } from 'react-native';

type Props = {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

export default function ParentalGate({ visible, onSuccess, onCancel }: Props) {
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);

  // Regenerate a new random problem each time the gate opens
  const { a, b } = useMemo(() => {
    return { a: Math.floor(Math.random() * 15) + 5, b: Math.floor(Math.random() * 15) + 5 };
  }, [visible]);

  const handleSubmit = () => {
    if (parseInt(answer, 10) === a + b) {
      setAnswer('');
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.title}>Parents Only</Text>
          <Text style={styles.question}>
            What is {a} + {b}?
          </Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            keyboardType="number-pad"
            value={answer}
            onChangeText={(t) => {
              setAnswer(t);
              setError(false);
            }}
            placeholder="Type the answer"
            autoFocus
          />
          {error && <Text style={styles.errorText}>That's not quite right — try again.</Text>}
          <Pressable style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
          <Pressable onPress={onCancel}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '80%', alignItems: 'center' },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 12 },
  question: { fontSize: 16, fontWeight: '700', color: '#1a73e8', marginBottom: 12 },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 8,
  },
  inputError: { borderColor: '#EA4335' },
  errorText: { color: '#EA4335', fontSize: 12, marginBottom: 8 },
  button: { backgroundColor: '#1a73e8', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: '700' },
  cancel: { color: '#9ca3af', marginTop: 12, fontWeight: '600' },
});
