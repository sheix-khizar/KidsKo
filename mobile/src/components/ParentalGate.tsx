import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from '../ui';
import { colors, radii, gradients } from '../theme';

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
    const trimmed = answer.trim();
    if (parseInt(trimmed, 10) === a + b || trimmed === '1234') {
      setAnswer('');
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Glass Lock Icon */}
          <View style={styles.lockBadge}>
            <Text style={styles.emoji}>🔐</Text>
          </View>

          <Text style={styles.title}>Parents Only</Text>
          <Text style={styles.subtitle}>This area is protected for parents</Text>

          {/* Math Challenge Question */}
          <View style={styles.questionBox}>
            <Text style={styles.questionLabel}>Solve this math problem to continue:</Text>
            <Text style={styles.question}>
              What is <Text style={styles.mathHighlight}>{a} + {b}</Text>?
            </Text>
          </View>

          <TextInput
            style={[styles.input, error && styles.inputError]}
            keyboardType="number-pad"
            value={answer}
            onChangeText={(t) => {
              setAnswer(t);
              setError(false);
            }}
            placeholder="Type answer (or PIN: 1234)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            autoFocus
          />

          {error && (
            <Text style={styles.errorText}>That's not quite right — try again!</Text>
          )}

          <Pressable
            style={styles.submitPressable}
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Continue →</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={styles.cancelBtn}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E2433',
    borderRadius: 28,
    padding: 26,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 10,
  },
  lockBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginBottom: 18,
  },
  questionBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  questionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  question: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mathHighlight: {
    color: '#FFE66D',
    fontWeight: '900',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  inputError: {
    borderColor: colors.coralStrong,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  errorText: {
    color: colors.coralStrong,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  submitPressable: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 4,
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  cancelBtn: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '700',
    fontSize: 14,
  },
});
