import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { VoiceSession } from '../services/voiceSocket';
import { pickImageFromGallery, captureImageFromCamera } from '../utils/imageHelper';

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
  onLimitReached: () => void;
};

export default function LiveVoiceScreen({ studentId, studentName, onBack, onLimitReached }: Props) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended'>('connecting');
  const [voiceState, setVoiceState] = useState<'listening' | 'thinking' | 'speaking'>('listening');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [isSendingSnapshot, setIsSendingSnapshot] = useState(false);
  const [snapshotsRemaining, setSnapshotsRemaining] = useState<number | null>(null);
  const [lastSpokenTranscript, setLastSpokenTranscript] = useState<string>('');

  const sessionRef = useRef<VoiceSession | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const session = new VoiceSession();
    sessionRef.current = session;

    session.start(
      {
        onReady: (capSeconds) => {
          setStatus('live');
          setSecondsLeft(capSeconds);
          timerRef.current = setInterval(() => {
            setSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0));
          }, 1000);
        },
        onCapReached: () => {
          setStatus('ended');
          setErrorReason('Voice limit for this session reached.');
          if (timerRef.current) clearInterval(timerRef.current);
        },
        onError: (reason) => {
          if (reason && reason.toString().toLowerCase().includes('limit')) onLimitReached();
          setErrorReason(reason?.toString() || 'Connection error');
          setStatus('ended');
        },
        onClose: (reason) => {
          if (reason) setErrorReason(reason.toString());
          setStatus('ended');
        },
        onTranscript: (text) => {
          if (text && text.trim().length > 0) {
            console.log('[LiveVoiceScreen] Captured student spoken transcript:', text);
            setLastSpokenTranscript(text.trim());
          }
        },
        onStateChange: (state) => {
          console.log('[LiveVoiceScreen] Voice state changed:', state);
          setVoiceState(state);
        },
        onSnapshotAck: (remaining) => {
          setSnapshotsRemaining(remaining);
          setIsSendingSnapshot(false);
        },
        onSnapshotError: (reason) => {
          setIsSendingSnapshot(false);
          if (reason.toLowerCase().includes('upgrade') || reason.toLowerCase().includes('used up')) {
            onLimitReached();
          } else {
            setErrorReason(reason);
          }
        },
      },
      studentId
    );

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sessionRef.current?.end();
    };
  }, []);

  const handleEnd = async () => {
    await sessionRef.current?.end();
    onBack();
  };

  const handleInterrupt = () => {
    console.log('[LiveVoiceScreen] User triggered Tap to Interrupt!');
    sessionRef.current?.interrupt();
  };

  const handlePickGallery = async () => {
    setShowOptionModal(false);
    try {
      const result = await pickImageFromGallery();
      if (result) {
        sendHomeworkPhoto(result.base64);
      }
    } catch (err: any) {
      setErrorReason(err?.message || 'Could not pick image from gallery.');
    }
  };

  const handleTakeCamera = async () => {
    setShowOptionModal(false);
    try {
      const result = await captureImageFromCamera();
      if (result) {
        sendHomeworkPhoto(result.base64);
      }
    } catch (err: any) {
      setErrorReason(err?.message || 'Could not capture image from camera.');
    }
  };

  const sendHomeworkPhoto = (base64: string) => {
    setIsSendingSnapshot(true);
    setErrorReason(null);
    const activeCaption = lastSpokenTranscript.trim() || sessionRef.current?.getLastTranscript() || 'Please look at this and help me with my homework.';
    console.log('[LiveVoiceScreen] Sending captured homework photo with caption:', activeCaption);
    sessionRef.current?.sendImageCapture(base64, activeCaption);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {status === 'connecting'
          ? 'Connecting to Kidsko Live...'
          : status === 'live'
          ? `Talking to Kidsko (${studentName})`
          : 'Voice Session Ended'}
      </Text>

      {secondsLeft !== null && status === 'live' && (
        <Text style={styles.timer}>{secondsLeft}s remaining</Text>
      )}

      {status === 'live' && (
        <View style={styles.stateCard}>
          {voiceState === 'speaking' ? (
            <Pressable style={[styles.avatarCircle, styles.avatarSpeaking]} onPress={handleInterrupt}>
              <Text style={styles.avatarEmoji}>🦉</Text>
              <View style={styles.speakingBadge}>
                <Text style={styles.speakingBadgeText}>🔊 Kidsko is Talking...</Text>
              </View>
            </Pressable>
          ) : voiceState === 'thinking' ? (
            <View style={[styles.avatarCircle, styles.avatarThinking]}>
              <ActivityIndicator size="large" color="#FFD54F" />
              <Text style={styles.thinkingText}>💡 Thinking...</Text>
            </View>
          ) : (
            <View style={[styles.avatarCircle, styles.avatarListening]}>
              <Text style={styles.avatarEmoji}>🎙️</Text>
              <View style={styles.listeningBadge}>
                <Text style={styles.listeningBadgeText}>🟢 Listening to You...</Text>
              </View>
            </View>
          )}

          {voiceState === 'speaking' && (
            <Pressable style={styles.interruptBanner} onPress={handleInterrupt}>
              <Text style={styles.interruptBannerText}>✋ Tap to Interrupt</Text>
            </Pressable>
          )}

          {lastSpokenTranscript ? (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>You said:</Text>
              <Text style={styles.transcriptText} numberOfLines={2}>
                "{lastSpokenTranscript}"
              </Text>
            </View>
          ) : (
            <Text style={styles.promptHint}>Speak anytime or tap "Show Homework" to share a photo!</Text>
          )}
        </View>
      )}

      {isSendingSnapshot ? (
        <View style={styles.analyzingBox}>
          <ActivityIndicator size="large" color="#FFD54F" />
          <Text style={styles.analyzingText}>🦉 Looking at your homework...</Text>
        </View>
      ) : (
        status === 'live' && (
          <Pressable style={styles.showButton} onPress={() => setShowOptionModal(true)}>
            <Text style={styles.showButtonText}>📷 Show Homework</Text>
          </Pressable>
        )
      )}

      {snapshotsRemaining !== null && (
        <Text style={styles.snapshotCount}>{snapshotsRemaining} photo helps left this week</Text>
      )}

      {errorReason && <Text style={styles.errorSub}>{errorReason}</Text>}

      <Pressable style={styles.endButton} onPress={handleEnd}>
        <Text style={styles.endButtonText}>{status === 'ended' ? 'Close' : 'End Call'}</Text>
      </Pressable>

      {/* Option Sheet Modal */}
      <Modal visible={showOptionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Show Homework to Kidsko</Text>
            <Text style={styles.modalSubtitle}>How would you like to provide the homework photo?</Text>

            <Pressable style={styles.optionButton} onPress={handleTakeCamera}>
              <Text style={styles.optionButtonText}>📸 Take Photo with Camera</Text>
            </Pressable>

            <Pressable style={[styles.optionButton, styles.optionButtonSecondary]} onPress={handlePickGallery}>
              <Text style={styles.optionButtonTextSecondary}>🖼️ Choose from Gallery</Text>
            </Pressable>

            <Pressable style={styles.cancelModalButton} onPress={() => setShowOptionModal(false)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  timer: { fontSize: 16, color: '#FFD54F', fontWeight: '700', marginBottom: 16 },
  errorSub: { fontSize: 14, color: '#FF8A80', fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  endButton: { backgroundColor: '#EA4335', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40, marginTop: 10 },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  showButton: { backgroundColor: '#1a73e8', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 12 },
  showButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  snapshotCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 20 },
  analyzingBox: { alignItems: 'center', marginVertical: 20, gap: 10 },
  analyzingText: { color: '#FFD54F', fontSize: 16, fontWeight: '700' },

  // State Card Styles
  stateCard: {
    width: '100%',
    backgroundColor: '#252542',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarListening: {
    backgroundColor: '#1b3a2b',
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  avatarThinking: {
    backgroundColor: '#3a351b',
    borderWidth: 3,
    borderColor: '#FFC107',
  },
  avatarSpeaking: {
    backgroundColor: '#3a251b',
    borderWidth: 3,
    borderColor: '#FF9800',
  },
  avatarEmoji: { fontSize: 44 },
  thinkingText: { color: '#FFD54F', fontWeight: '700', fontSize: 13, marginTop: 6 },

  listeningBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listeningBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  speakingBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#e65100',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  speakingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  interruptBanner: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginBottom: 14,
    elevation: 3,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  interruptBannerText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },

  transcriptBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  transcriptLabel: { color: '#FFD54F', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  transcriptText: { color: '#fff', fontSize: 13, fontWeight: '600', fontStyle: 'italic', textAlign: 'center' },
  promptHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#22223b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  modalSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8, textAlign: 'center' },
  optionButton: { width: '100%', backgroundColor: '#1a73e8', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  optionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  optionButtonSecondary: { backgroundColor: '#333355', borderWidth: 1, borderColor: '#555577' },
  optionButtonTextSecondary: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelModalButton: { marginTop: 8, paddingVertical: 10 },
  cancelModalText: { color: '#FF8A80', fontWeight: '700', fontSize: 15 },
});
