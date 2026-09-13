import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { VoiceSession, forceLoudspeakerAudio } from '../services/voiceSocket';
import { pickImageFromGallery } from '../utils/imageHelper';

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
  const [isSendingSnapshot, setIsSendingSnapshot] = useState(false);
  const [snapshotsRemaining, setSnapshotsRemaining] = useState<number | null>(null);
  const [lastSpokenTranscript, setLastSpokenTranscript] = useState<string>('');
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);

  // Live Camera Vision State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

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
          setVoiceState((prevState) => {
            if (prevState !== state) {
              console.log('[LiveVoiceScreen] Voice state changed:', state);
              if (state === 'speaking' || state === 'thinking') {
                setNetworkNotice(null);
              }
              return state;
            }
            return prevState;
          });
        },
        onNetworkNotice: (message) => {
          console.warn('[LiveVoiceScreen] Network notice:', message);
          setNetworkNotice(message);
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

  // Continuous Camera Vision Loop (1 frame every 1.5s when camera is open)
  useEffect(() => {
    let frameInterval: any = null;
    let isCapturing = false;

    if (isCameraActive && status === 'live') {
      console.log('[LiveVoiceScreen] Starting continuous real-time camera streaming loop (1.5s interval)...');
      frameInterval = setInterval(async () => {
        if (!cameraRef.current || isCapturing) return;
        isCapturing = true;
        try {
          const picture = await cameraRef.current.takePictureAsync({
            quality: 0.35,
            base64: true,
            skipProcessing: true,
            shutterSound: false,
          });
          if (picture?.base64 && sessionRef.current) {
            sessionRef.current.sendCameraFrame(picture.base64);
          }
        } catch {
          // Missed frame, will capture on next tick
        } finally {
          isCapturing = false;
        }
      }, 1500);
    }

    return () => {
      if (frameInterval) {
        clearInterval(frameInterval);
        console.log('[LiveVoiceScreen] Stopped camera streaming loop.');
      }
    };
  }, [isCameraActive, status]);

  const handleEnd = async () => {
    setIsCameraActive(false);
    await sessionRef.current?.end();
    onBack();
  };

  const handleToggleCamera = async () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      return;
    }

    if (!cameraPermission?.granted) {
      const perm = await requestCameraPermission();
      if (!perm.granted) {
        setErrorReason('Camera permission is required for live video.');
        return;
      }
    }
    await forceLoudspeakerAudio().catch(() => {});
    setIsCameraActive(true);
  };

  const handlePickGallery = async () => {
    try {
      const result = await pickImageFromGallery();
      await forceLoudspeakerAudio().catch(() => {});
      if (result) {
        sendHomeworkPhoto(result.base64);
      }
    } catch (err: any) {
      setErrorReason(err?.message || 'Could not pick image from gallery.');
    }
  };

  const handleInstantSnapshot = async () => {
    if (!cameraRef.current) return;
    setIsSendingSnapshot(true);
    setErrorReason(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
        skipProcessing: true,
        shutterSound: false,
      });
      if (photo?.base64) {
        sendHomeworkPhoto(photo.base64);
      }
    } catch (err: any) {
      setErrorReason(err?.message || 'Could not take photo');
      setIsSendingSnapshot(false);
    }
  };

  const sendHomeworkPhoto = (base64: string) => {
    setIsSendingSnapshot(true);
    setErrorReason(null);
    const activeCaption = lastSpokenTranscript.trim()
      ? `${lastSpokenTranscript.trim()}. Please look at my homework photo and guide me step-by-step.`
      : 'Please look at my homework photo and guide me step-by-step.';
    console.log('[LiveVoiceScreen] Sending captured homework photo with caption:', activeCaption);
    sessionRef.current?.sendImageCapture(base64, activeCaption);
    setLastSpokenTranscript('');
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

      {networkNotice && status === 'live' && (
        <Pressable style={styles.noticeBanner} onPress={() => setNetworkNotice(null)}>
          <Text style={styles.noticeBannerText}>⚡ {networkNotice}</Text>
          <Text style={styles.noticeDismissText}>Tap to dismiss • Speak anytime</Text>
        </Pressable>
      )}

      {status === 'live' && (
        <>
          {isCameraActive ? (
            /* Live In-App Camera Viewfinder */
            <View style={styles.cameraCard}>
              <CameraView
                ref={cameraRef}
                style={styles.cameraView}
                facing="back"
                animateShutter={false}
              />
              {/* Header Badge */}
              <View style={styles.cameraHeaderOverlay}>
                <View style={styles.liveVisionBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveVisionText}>Live Vision Active</Text>
                </View>
                <Pressable style={styles.closeCameraBtn} onPress={() => setIsCameraActive(false)}>
                  <Text style={styles.closeCameraBtnText}>✕ Close</Text>
                </Pressable>
              </View>

              {/* Footer State Overlay */}
              <View style={styles.cameraFooterOverlay}>
                {voiceState === 'speaking' ? (
                  <Pressable
                    style={styles.floatingSpeakingBadge}
                    onPress={() => sessionRef.current?.interrupt()}
                  >
                    <Text style={styles.floatingSpeakingText}>🔊 Kidsko is Talking... (Tap to speak)</Text>
                  </Pressable>
                ) : voiceState === 'thinking' ? (
                  <View style={styles.floatingThinkingBadge}>
                    <ActivityIndicator size="small" color="#FFD54F" />
                    <Text style={styles.floatingThinkingText}>💡 Thinking...</Text>
                  </View>
                ) : (
                  <View style={styles.floatingListeningBadge}>
                    <Text style={styles.floatingListeningText}>👁️ Kidsko is Watching & Listening...</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* Avatar View */
            <View style={styles.stateCard}>
              {voiceState === 'speaking' ? (
                <Pressable
                  style={[styles.avatarCircle, styles.avatarSpeaking]}
                  onPress={() => sessionRef.current?.interrupt()}
                >
                  <Text style={styles.avatarEmoji}>🦉</Text>
                  <View style={styles.speakingBadge}>
                    <Text style={styles.speakingBadgeText}>🔊 Kidsko is Talking... (Tap to speak)</Text>
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

              {lastSpokenTranscript ? (
                <View style={styles.transcriptBox}>
                  <Text style={styles.transcriptLabel}>You said:</Text>
                  <Text style={styles.transcriptText} numberOfLines={2}>
                    "{lastSpokenTranscript}"
                  </Text>
                </View>
              ) : (
                <Text style={styles.promptHint}>Speak anytime or open camera to show homework!</Text>
              )}
            </View>
          )}

          {/* Action Buttons */}
          {isSendingSnapshot ? (
            <View style={styles.analyzingBox}>
              <ActivityIndicator size="large" color="#FFD54F" />
              <Text style={styles.analyzingText}>🦉 Analyzing homework photo...</Text>
            </View>
          ) : isCameraActive ? (
            <View style={styles.cameraActionsRow}>
              <Pressable style={styles.instantShutterBtn} onPress={handleInstantSnapshot}>
                <Text style={styles.instantShutterText}>✨ Ask About This</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.actionContainer}>
              <Pressable style={styles.openCameraBtn} onPress={handleToggleCamera}>
                <Text style={styles.openCameraBtnText}>📹 Open Camera (Live Vision)</Text>
              </Pressable>
              <Pressable style={styles.galleryLink} onPress={handlePickGallery}>
                <Text style={styles.galleryLinkText}>🖼️ Choose from Gallery instead</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {snapshotsRemaining !== null && (
        <Text style={styles.snapshotCount}>{snapshotsRemaining} photo helps left this week</Text>
      )}

      {errorReason && <Text style={styles.errorSub}>{errorReason}</Text>}

      <Pressable style={styles.endButton} onPress={handleEnd}>
        <Text style={styles.endButtonText}>{status === 'ended' ? 'Close' : 'End Call'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  timer: { fontSize: 16, color: '#FFD54F', fontWeight: '700', marginBottom: 12 },
  errorSub: { fontSize: 14, color: '#FF8A80', fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  endButton: { backgroundColor: '#EA4335', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40, marginTop: 10 },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Vision Camera Styles
  cameraCard: {
    width: '100%',
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  cameraView: {
    width: '100%',
    height: '100%',
  },
  cameraHeaderOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  liveVisionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  liveVisionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  closeCameraBtn: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  closeCameraBtnText: {
    color: '#FFD54F',
    fontSize: 12,
    fontWeight: '700',
  },
  cameraFooterOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  floatingSpeakingBadge: {
    backgroundColor: '#E65100',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  floatingSpeakingText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  floatingThinkingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  floatingThinkingText: {
    color: '#FFD54F',
    fontWeight: '700',
    fontSize: 13,
  },
  floatingListeningBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  floatingListeningText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  cameraActionsRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  instantShutterBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  instantShutterText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },

  actionContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  openCameraBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginBottom: 10,
  },
  openCameraBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  galleryLink: {
    paddingVertical: 6,
  },
  galleryLinkText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  snapshotCount: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 16 },
  analyzingBox: { alignItems: 'center', marginVertical: 16, gap: 8 },
  analyzingText: { color: '#FFD54F', fontSize: 15, fontWeight: '700' },

  stateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 20,
    width: '100%',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  avatarSpeaking: {
    backgroundColor: '#FF9800',
    borderWidth: 4,
    borderColor: '#FFE0B2',
  },
  avatarListening: {
    backgroundColor: '#1e3a8a',
    borderWidth: 4,
    borderColor: '#3b82f6',
  },
  avatarThinking: {
    backgroundColor: '#374151',
    borderWidth: 4,
    borderColor: '#9ca3af',
  },
  avatarEmoji: { fontSize: 60 },
  speakingBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#E65100',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  speakingBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  listeningBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#15803d',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listeningBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  thinkingText: { color: '#FFD54F', fontSize: 14, fontWeight: '700', marginTop: 8 },
  transcriptBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    padding: 10,
    width: '100%',
    alignItems: 'center',
  },
  transcriptLabel: { color: '#FFD54F', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  transcriptText: { color: '#fff', fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  promptHint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },

  noticeBanner: {
    backgroundColor: 'rgba(255,213,79,0.15)',
    borderColor: '#FFD54F',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
  },
  noticeBannerText: { color: '#FFD54F', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  noticeDismissText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
});
