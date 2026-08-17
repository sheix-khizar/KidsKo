import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { VoiceSession } from '../services/voiceSocket';
import { pickImageFromGallery, captureImageFromCamera } from '../utils/imageHelper';

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
  onLimitReached: () => void;
};

export const VOICE_OPTIONS = [
  { id: 'Kore', label: '🌸 Friendly Girl (Kore)', type: 'Female', desc: 'Warm & friendly tutor' },
  { id: 'Aoede', label: '✨ Cheerful Girl (Aoede)', type: 'Female', desc: 'Energetic & cheerful' },
  { id: 'Puck', label: '🎈 Playful Boy (Puck)', type: 'Male', desc: 'Playful & fun' },
  { id: 'Fenrir', label: '⚡ Energetic Boy (Fenrir)', type: 'Male', desc: 'Confident & energetic' },
  { id: 'Charon', label: '🌙 Calm Boy (Charon)', type: 'Male', desc: 'Calm & gentle' },
];

export default function LiveVoiceScreen({ studentId, studentName, onBack, onLimitReached }: Props) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended'>('connecting');
  const [voiceState, setVoiceState] = useState<'listening' | 'thinking' | 'speaking'>('listening');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [isSendingSnapshot, setIsSendingSnapshot] = useState(false);
  const [snapshotsRemaining, setSnapshotsRemaining] = useState<number | null>(null);
  const [lastSpokenTranscript, setLastSpokenTranscript] = useState<string>('');

  const sessionRef = useRef<VoiceSession | null>(null);
  const timerRef = useRef<any>(null);

  const startSession = (voiceId: string) => {
    if (sessionRef.current) {
      sessionRef.current.end();
      sessionRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setStatus('connecting');
    const session = new VoiceSession();
    sessionRef.current = session;

    session.start(
      {
        onReady: (capSeconds) => {
          setStatus('live');
          setSecondsLeft(capSeconds);
          if (timerRef.current) clearInterval(timerRef.current);
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
      studentId,
      voiceId
    );
  };

  useEffect(() => {
    SecureStore.getItemAsync('kidsko_preferred_voice').then((savedVoice: string | null) => {
      const activeVoice = savedVoice || 'Kore';
      setSelectedVoice(activeVoice);
      startSession(activeVoice);
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sessionRef.current?.end();
    };
  }, []);

  const handleSelectVoice = async (voiceId: string) => {
    setShowVoiceModal(false);
    setSelectedVoice(voiceId);
    try {
      await SecureStore.setItemAsync('kidsko_preferred_voice', voiceId);
    } catch {}

    // 🎙️ Send transparent change_voice frame over existing WebSocket connection (0 disconnect, 0 timer reset, 0 session end)
    console.log('[LiveVoiceScreen] Selected new voice:', voiceId, '-> Sending transparent voice change request...');
    sessionRef.current?.setVoice(voiceId);
  };

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

  const currentVoiceObj = VOICE_OPTIONS.find((v) => v.id === selectedVoice) || VOICE_OPTIONS[0];

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
        <Pressable style={styles.voiceBadgeButton} onPress={() => setShowVoiceModal(true)}>
          <Text style={styles.voiceBadgeText}>🎭 Voice: {currentVoiceObj.label}</Text>
        </Pressable>
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
            <Pressable style={styles.changeVoiceButton} onPress={() => setShowVoiceModal(true)}>
              <Text style={styles.changeVoiceButtonText}>🎙️ Change Voice</Text>
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

      {/* Voice Selection Modal */}
      <Modal visible={showVoiceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Kidsko's Voice</Text>
            <Text style={styles.modalSubtitle}>Select a voice personality for your AI tutor:</Text>

            <ScrollView style={{ width: '100%', maxHeight: 300 }}>
              {VOICE_OPTIONS.map((item) => {
                const isSelected = item.id === selectedVoice;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.voiceItem, isSelected && styles.voiceItemSelected]}
                    onPress={() => handleSelectVoice(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.voiceItemTitle, isSelected && styles.voiceItemTitleSelected]}>
                        {item.label}
                      </Text>
                      <Text style={styles.voiceItemDesc}>{item.desc}</Text>
                    </View>
                    {isSelected && <Text style={styles.checkMark}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.cancelModalButton} onPress={() => setShowVoiceModal(false)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6, textAlign: 'center' },
  timer: { fontSize: 15, color: '#FFD54F', fontWeight: '700', marginBottom: 12 },
  voiceBadgeButton: {
    backgroundColor: '#2e2e4a',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4e4e7a',
  },
  voiceBadgeText: { color: '#FFD54F', fontSize: 13, fontWeight: '700' },
  errorSub: { fontSize: 14, color: '#FF8A80', fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  endButton: { backgroundColor: '#EA4335', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40, marginTop: 10 },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  showButton: { backgroundColor: '#1a73e8', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 20 },
  showButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  changeVoiceButton: { backgroundColor: '#3b3b5e', borderRadius: 24, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: '#5b5b8e' },
  changeVoiceButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  snapshotCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 16 },
  analyzingBox: { alignItems: 'center', marginVertical: 20, gap: 10 },
  analyzingText: { color: '#FFD54F', fontSize: 16, fontWeight: '700' },

  // State Card Styles
  stateCard: {
    width: '100%',
    backgroundColor: '#252542',
    borderRadius: 24,
    padding: 20,
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
  avatarEmoji: { fontSize: 40 },
  thinkingText: { color: '#FFD54F', fontWeight: '700', fontSize: 12, marginTop: 6 },

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

  // Voice Modal Styles
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#2d2d48',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  voiceItemSelected: {
    backgroundColor: '#1b3a5a',
    borderColor: '#1a73e8',
  },
  voiceItemTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  voiceItemTitleSelected: { color: '#64B5F6' },
  voiceItemDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  checkMark: { color: '#64B5F6', fontSize: 18, fontWeight: '800', marginLeft: 8 },

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
