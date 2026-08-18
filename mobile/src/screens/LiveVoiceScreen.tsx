import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, ScrollView } from 'react-native';
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
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [aiSpokenText, setAiSpokenText] = useState<string>('');

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
        onAiTranscript: (text) => {
          if (text) {
            setAiSpokenText((prev) => prev + text);
          }
        },
        onStateChange: (state) => {
          console.log('[LiveVoiceScreen] Voice state changed:', state);
          setVoiceState(state);
          if (state === 'thinking' || state === 'listening') {
            setAiSpokenText('');
          }
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
            <View style={[styles.avatarCircle, styles.avatarSpeaking]}>
              <Text style={styles.avatarEmoji}>🦉</Text>
              <View style={styles.speakingBadge}>
                <Text style={styles.speakingBadgeText}>🔊 Kidsko is Talking...</Text>
              </View>
            </View>
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

      {/* Live AI Spoken Caption Box */}
      {showCaptions && aiSpokenText.length > 0 && status === 'live' && (
        <View style={styles.aiCaptionCard}>
          <Text style={styles.aiCaptionLabel}>💬 Kidsko Live Caption:</Text>
          <ScrollView style={styles.aiCaptionScroll} nestedScrollEnabled>
            <Text style={styles.aiCaptionText}>{aiSpokenText}</Text>
          </ScrollView>
        </View>
      )}

      {isSendingSnapshot ? (
        <View style={styles.analyzingBox}>
          <ActivityIndicator size="large" color="#FFD54F" />
          <Text style={styles.analyzingText}>🦉 Looking at your homework...</Text>
        </View>
      ) : (
        status === 'live' && (
          <View style={styles.actionRow}>
            <Pressable style={styles.showButton} onPress={() => setShowOptionModal(true)}>
              <Text style={styles.showButtonText}>📷 Show Homework</Text>
            </Pressable>

            <Pressable
              style={[styles.captionBtn, showCaptions ? styles.captionBtnActive : styles.captionBtnInactive]}
              onPress={() => setShowCaptions((prev) => !prev)}
            >
              <Text style={styles.captionBtnText}>{showCaptions ? '💬 Captions ON' : '💬 Captions OFF'}</Text>
            </Pressable>
          </View>
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  timer: { fontSize: 16, color: '#FFD54F', fontWeight: '700', marginBottom: 16 },
  errorSub: { fontSize: 14, color: '#FF8A80', fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  endButton: { backgroundColor: '#EA4335', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40, marginTop: 10 },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  showButton: { backgroundColor: '#1a73e8', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 20 },
  showButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  captionBtn: { borderRadius: 24, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1 },
  captionBtnActive: { backgroundColor: '#2e7d32', borderColor: '#4CAF50' },
  captionBtnInactive: { backgroundColor: '#333355', borderColor: '#555577' },
  captionBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  snapshotCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 16 },
  analyzingBox: { alignItems: 'center', marginVertical: 20, gap: 10 },
  analyzingText: { color: '#FFD54F', fontSize: 16, fontWeight: '700' },

  // State Card Styles
  stateCard: {
    width: '100%',
    backgroundColor: '#252542',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  avatarListening: { backgroundColor: '#1b3a2b', borderWidth: 3, borderColor: '#4CAF50' },
  avatarThinking: { backgroundColor: '#3a351b', borderWidth: 3, borderColor: '#FFC107' },
  avatarSpeaking: { backgroundColor: '#3a251b', borderWidth: 3, borderColor: '#FF9800' },
  avatarEmoji: { fontSize: 40 },
  thinkingText: { color: '#FFD54F', fontWeight: '700', fontSize: 12, marginTop: 4 },

  listeningBadge: { position: 'absolute', bottom: -10, backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  listeningBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  speakingBadge: { position: 'absolute', bottom: -10, backgroundColor: '#e65100', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  speakingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  transcriptBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, width: '100%', alignItems: 'center' },
  transcriptLabel: { color: '#FFD54F', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  transcriptText: { color: '#fff', fontSize: 13, fontWeight: '600', fontStyle: 'italic', textAlign: 'center' },
  promptHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Live AI Caption Card
  aiCaptionCard: {
    width: '100%',
    maxHeight: 120,
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
    marginBottom: 16,
  },
  aiCaptionLabel: { color: '#FFD54F', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  aiCaptionScroll: { maxHeight: 80 },
  aiCaptionText: { color: '#e0e0e0', fontSize: 14, fontWeight: '600', lineHeight: 20 },

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
