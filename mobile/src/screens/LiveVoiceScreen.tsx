import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, Image } from 'react-native';
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
  const [lastCapturedPhotoBase64, setLastCapturedPhotoBase64] = useState<string | null>(null);

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
      sessionRef.current?.end('unmount');
    };
  }, []);

  const handleEnd = async () => {
    await sessionRef.current?.end('user_tap');
    onBack();
  };

  const handlePickGallery = async () => {
    setShowOptionModal(false);
    try {
      sessionRef.current?.pauseSpeechRecognition();
      const result = await pickImageFromGallery();
      if (result) {
        sendHomeworkPhoto(result.base64);
      }
    } catch (err: any) {
      setErrorReason(err?.message || 'Could not pick image from gallery.');
    } finally {
      sessionRef.current?.resumeSpeechRecognition();
    }
  };

  const handleTakeCamera = async () => {
    setShowOptionModal(false);
    try {
      sessionRef.current?.pauseSpeechRecognition();
      const result = await captureImageFromCamera();
      if (result) {
        sendHomeworkPhoto(result.base64);
      }
    } catch (err: any) {
      setErrorReason(err?.message || 'Could not capture image from camera.');
    } finally {
      sessionRef.current?.resumeSpeechRecognition();
    }
  };

  const sendHomeworkPhoto = (base64: string) => {
    setIsSendingSnapshot(true);
    setErrorReason(null);
    setLastCapturedPhotoBase64(`data:image/jpeg;base64,${base64}`);
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

          {lastCapturedPhotoBase64 && (
            <View style={styles.photoPreviewCard}>
              <Image source={{ uri: lastCapturedPhotoBase64 }} style={styles.photoPreviewThumbnail} />
              <View style={styles.photoPreviewInfo}>
                <Text style={styles.photoPreviewLabel}>🖼️ Photo Shared with Kidsko</Text>
                <Text style={styles.photoPreviewStatus}>Kidsko can see your homework sheet!</Text>
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
  },
  avatarListening: { backgroundColor: '#1b4332', borderWidth: 2, borderColor: '#4E9F3D' },
  avatarThinking: { backgroundColor: '#3d3000', borderWidth: 2, borderColor: '#FFD54F' },
  avatarSpeaking: { backgroundColor: '#1e3a8a', borderWidth: 2, borderColor: '#60A5FA' },
  avatarEmoji: { fontSize: 48 },
  listeningBadge: { backgroundColor: '#4E9F3D', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 6 },
  listeningBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  thinkingText: { color: '#FFD54F', fontSize: 12, fontWeight: '800', marginTop: 6 },
  speakingBadge: { backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 6 },
  speakingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  transcriptBox: { width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 16, alignItems: 'center' },
  transcriptLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  transcriptText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', fontStyle: 'italic' },
  promptHint: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', fontStyle: 'italic' },

  photoPreviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 213, 79, 0.15)', borderWidth: 1, borderColor: '#FFD54F', padding: 10, borderRadius: 16, marginBottom: 12, width: '100%', gap: 12 },
  photoPreviewThumbnail: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#1a1a2e' },
  photoPreviewInfo: { flex: 1 },
  photoPreviewLabel: { color: '#FFD54F', fontSize: 13, fontWeight: '800' },
  photoPreviewStatus: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#252542', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 12 },
  optionButton: { backgroundColor: '#FFD54F', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  optionButtonText: { color: '#1a1a2e', fontWeight: '800', fontSize: 15 },
  optionButtonSecondary: { backgroundColor: '#3B82F6' },
  optionButtonTextSecondary: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancelModalButton: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  cancelModalText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700' },
});
