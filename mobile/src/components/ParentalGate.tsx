import { fontFamilies, colors, radii, shadows } from '../theme';
import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal } from 'react-native';
import { FadeSlideIn, PressScale } from '../ui/motion';

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <FadeSlideIn duration={200} style={styles.cardWrapper}>
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
              onSubmitEditing={handleSubmit}
            />
            {error && <Text style={styles.errorText}>That's not quite right — try again.</Text>}
            <Pressable onPress={handleSubmit} style={styles.buttonScale}>
              <View style={styles.button}>
                <Text style={styles.buttonText}>Continue</Text>
              </View>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.cancelScale}>
              <View style={styles.cancelBtn}>
                <Text style={styles.cancel}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </FadeSlideIn>
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
    padding: 24,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.card,
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: {
    fontSize: 18,
    fontFamily: fontFamilies.extraBold,
    color: colors.text,
    marginBottom: 8,
  },
  question: {
    fontSize: 16,
    fontFamily: fontFamilies.bold,
    color: colors.parentBlue,
    marginBottom: 12,
  },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 8,
  },
  inputError: { borderColor: colors.error },
  errorText: {
    color: colors.error,
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    marginBottom: 8,
  },
  buttonScale: {
    width: '100%',
    marginTop: 6,
  },
  button: {
    backgroundColor: colors.parentBlue,
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
  },
  cancelScale: {
    marginTop: 8,
  },
  cancelBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cancel: {
    color: colors.subtext,
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
  },
});
