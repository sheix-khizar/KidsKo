import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { VoiceSession } from '../services/voiceSocket';

type Props = {
  studentId: string;
  studentName: string;
  onBack: () => void;
  onLimitReached: () => void;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

const PHOTO_CONFIG = {
  containerFormat: 'jpeg' as const,
  quality: 0.5,
  qualityPrioritization: 'speed' as const,
  targetResolution: { width: 640, height: 480 },
};

export default function LiveVoiceScreen({ studentId, studentName, onBack, onLimitReached }: Props) {
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended'>('connecting');
  const [voiceState, setVoiceState] = useState<'listening' | 'thinking' | 'speaking'>('listening');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [lastSpokenTranscript, setLastSpokenTranscript] = useState<string>('');
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);

  // Live Video State & Camera Hooks (Phase B2)
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAppForeground, setIsAppForeground] = useState(true);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput(PHOTO_CONFIG);
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  const isCameraActive = status === 'live' && isVideoActive && isAppForeground && hasPermission && !!device;

  const sessionRef = useRef<VoiceSession | null>(null);
  const timerRef = useRef<any>(null);
  const frameIntervalRef = useRef<any>(null);
  const isCapturingRef = useRef<boolean>(false);

  // AppState listener for lifecycle safety (Ticket B2.4)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setIsAppForeground(nextState === 'active');
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Frame sampling loop (Ticket B2.2 & B2.4)
  useEffect(() => {
    if (!isCameraActive || !isCameraReady || !photoOutput) {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      return;
    }

    const captureFrame = async () => {
      if (isCapturingRef.current || !isCameraActive || !isCameraReady) return;
      isCapturingRef.current = true;
      try {
        const photo = await photoOutput.capturePhoto({ enableShutterSound: false }, {});
        try {
          const fileData = await photo.getFileDataAsync();
          if (fileData && fileData.byteLength > 0) {
            const base64 = arrayBufferToBase64(fileData);
            sessionRef.current?.sendVideoFrame(base64);
          }
        } finally {
          photo.dispose();
        }
      } catch (err: any) {
        console.warn('[LiveVoiceScreen] Video frame capture skipped:', err?.message || err);
      } finally {
        isCapturingRef.current = false;
      }
    };

    const initialTimeout = setTimeout(captureFrame, 1000);
    frameIntervalRef.current = setInterval(captureFrame, 2500);

    return () => {
      clearTimeout(initialTimeout);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isCameraActive, isCameraReady, photoOutput]);

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
          setErrorReason('Voice & video limit reached for this session.');
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
      },
      studentId
    );

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      sessionRef.current?.end();
    };
  }, []);

  const handleToggleVideo = async () => {
    console.log('[LiveVoiceScreen] handleToggleVideo tapped! Current isVideoActive:', isVideoActive, 'hasPermission:', hasPermission);
    if (isVideoActive) {
      setIsCameraReady(false);
      setIsVideoActive(false);
    } else {
      if (!hasPermission) {
        console.log('[LiveVoiceScreen] Requesting camera permission...');
        const granted = await requestPermission();
        console.log('[LiveVoiceScreen] Permission result:', granted);
        if (!granted) {
          setErrorReason('Camera permission is required for live video.');
          return;
        }
      }
      console.log('[LiveVoiceScreen] Enabling isVideoActive = true, device exists:', !!device);
      setIsVideoActive(true);
    }
  };

  const handleEnd = async () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsVideoActive(false);
    await sessionRef.current?.end();
    onBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {status === 'connecting'
          ? 'Connecting to Kidsko Live...'
          : status === 'live'
          ? `Talking to Kidsko (${studentName})`
          : 'Call Ended'}
      </Text>

      {secondsLeft !== null && status === 'live' && (
        <View style={styles.timerPill}>
          <Text style={styles.timerText}>⏱️ {secondsLeft}s remaining</Text>
        </View>
      )}

      {networkNotice && status === 'live' && (
        <Pressable style={styles.noticeBanner} onPress={() => setNetworkNotice(null)}>
          <Text style={styles.noticeBannerText}>⚡ {networkNotice}</Text>
          <Text style={styles.noticeDismissText}>Tap to dismiss • Speak anytime</Text>
        </Pressable>
      )}

      {status === 'live' && (
        <View style={styles.stateCard}>
          {isVideoActive && isCameraActive && device ? (
            <View style={styles.cameraContainer}>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={isCameraActive}
                outputs={outputs}
                resizeMode="cover"
                onStarted={() => {
                  console.log('[LiveVoiceScreen] Camera onStarted!');
                  setIsCameraReady(true);
                }}
                onStopped={() => {
                  console.log('[LiveVoiceScreen] Camera onStopped!');
                  setIsCameraReady(false);
                }}
                onError={(err) => {
                  console.error('[LiveVoiceScreen] Camera onError:', err);
                  setIsCameraReady(false);
                }}
              />
              <View style={styles.liveVideoBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveVideoBadgeText}>LIVE VIDEO</Text>
              </View>
              <Pressable
                style={styles.cameraOverlayToggle}
                onPress={handleToggleVideo}
                accessibilityRole="button"
                accessibilityLabel="Turn off live camera"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.cameraOverlayToggleText}>✕ Turn Off</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {voiceState === 'speaking' ? (
                <Pressable
                  style={[styles.avatarCircle, styles.avatarSpeaking]}
                  onPress={() => sessionRef.current?.interrupt()}
                >
                  <Text style={styles.avatarEmoji}>🦉</Text>
                  <View style={styles.speakingBadge}>
                    <Text style={styles.speakingBadgeText}>Kidsko is talking… (Tap to speak)</Text>
                  </View>
                </Pressable>
              ) : voiceState === 'thinking' ? (
                <View style={[styles.avatarCircle, styles.avatarThinking]}>
                  <ActivityIndicator size="large" color="#FFE66D" />
                  <Text style={styles.thinkingText}>Thinking…</Text>
                </View>
              ) : (
                <View style={[styles.avatarCircle, styles.avatarListening]}>
                  <Text style={styles.avatarEmoji}>🎙️</Text>
                  <View style={styles.listeningBadge}>
                    <Text style={styles.listeningBadgeText}>Listening…</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {lastSpokenTranscript ? (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>You said:</Text>
              <Text style={styles.transcriptText} numberOfLines={2}>
                "{lastSpokenTranscript}"
              </Text>
            </View>
          ) : (
            <Text style={styles.promptHint}>
              {isVideoActive
                ? 'Live video is on! Kidsko can see your work.'
                : 'Speak anytime or turn on Live Video to show your work!'}
            </Text>
          )}
        </View>
      )}

      {/* Live Video Toggle Action */}
      {status === 'live' && (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.videoToggleButton, isVideoActive && styles.videoToggleButtonActive]}
            onPress={handleToggleVideo}
            accessibilityRole="button"
            accessibilityLabel={isVideoActive ? 'Turn off live video' : 'Start live video'}
          >
            <Text style={styles.videoToggleButtonText}>
              {isVideoActive ? '📹 Turn Off Video' : '📹 Start Live Video'}
            </Text>
          </Pressable>
        </View>
      )}

      {errorReason && <Text style={styles.errorSub}>{errorReason}</Text>}

      <Pressable
        style={[styles.endButton, status === 'ended' && styles.endButtonEnded]}
        onPress={handleEnd}
        accessibilityRole="button"
        accessibilityLabel={status === 'ended' ? 'Close call' : 'End call'}
      >
        <Text style={styles.endButtonText}>{status === 'ended' ? 'Close' : '✕ End'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  timerPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 13,
    color: '#FFE66D',
    fontWeight: '800',
    letterSpacing: 1,
  },
  errorSub: {
    fontSize: 14,
    color: '#FF8A80',
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  endButton: {
    backgroundColor: '#EF4444',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    elevation: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
  },
  endButtonEnded: {
    width: 'auto',
    minWidth: 150,
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 32,
    backgroundColor: '#FF6B6B',
  },
  endButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  videoToggleButton: {
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(78, 205, 196, 0.4)',
  },
  videoToggleButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  videoToggleButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  // State Card Styles
  stateCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 4,
  },
  cameraContainer: {
    width: '100%',
    height: 240,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'rgba(78, 205, 196, 0.4)',
  },
  liveVideoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00B894',
  },
  liveVideoBadgeText: {
    color: '#00B894',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cameraOverlayToggle: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cameraOverlayToggleText: {
    color: '#FF8A80',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarCircle: {
    width: 118,
    height: 118,
    borderRadius: 59,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    position: 'relative',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
  },
  avatarListening: {
    backgroundColor: 'rgba(0, 184, 148, 0.15)',
    borderWidth: 3,
    borderColor: '#00B894',
  },
  avatarThinking: {
    backgroundColor: 'rgba(255, 230, 109, 0.15)',
    borderWidth: 3,
    borderColor: '#FFE66D',
  },
  avatarSpeaking: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  avatarEmoji: { fontSize: 56 },
  thinkingText: { color: '#FFE66D', fontWeight: '800', fontSize: 13, marginTop: 6 },

  listeningBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#00B894',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listeningBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  speakingBadge: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  speakingBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  transcriptBox: {
    backgroundColor: 'rgba(10, 10, 20, 0.65)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.25)',
  },
  transcriptLabel: { color: '#4ECDC4', fontSize: 11, fontWeight: '800', marginBottom: 3, letterSpacing: 0.5 },
  transcriptText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', fontStyle: 'italic', textAlign: 'center' },
  promptHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },

  noticeBanner: {
    backgroundColor: 'rgba(255, 159, 67, 0.15)',
    borderColor: '#FF9F43',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  noticeBannerText: { color: '#FFE082', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  noticeDismissText: { color: 'rgba(255,224,130,0.7)', fontSize: 11, fontWeight: '600', marginTop: 3 },
});
