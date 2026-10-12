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
    backgroundColor: '#1A1D27',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  timerPill: {
    backgroundColor: '#262A38',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 13,
    color: '#FFE66D',
    fontWeight: '800',
  },
  errorSub: {
    fontSize: 14,
    color: '#FF8A80',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  endButton: {
    backgroundColor: '#D94A4A',
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 4,
    shadowColor: '#D94A4A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  endButtonEnded: {
    width: 'auto',
    minWidth: 140,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 32,
  },
  endButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
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
    backgroundColor: '#2E3547',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  videoToggleButtonActive: {
    backgroundColor: '#D94A4A',
    borderColor: '#D94A4A',
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
    backgroundColor: '#232838',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#333A4D',
  },
  cameraContainer: {
    width: '100%',
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  liveVideoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
  },
  liveVideoBadgeText: {
    color: '#00E676',
    fontSize: 10,
    fontWeight: '800',
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
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    position: 'relative',
  },
  avatarListening: {
    backgroundColor: '#152E22',
    borderWidth: 3,
    borderColor: '#00B894',
  },
  avatarThinking: {
    backgroundColor: '#2E2815',
    borderWidth: 3,
    borderColor: '#FFE66D',
  },
  avatarSpeaking: {
    backgroundColor: '#2E1C15',
    borderWidth: 3,
    borderColor: '#FF9F43',
  },
  avatarEmoji: { fontSize: 50 },
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
    backgroundColor: '#FF9F43',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  speakingBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  transcriptBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  transcriptLabel: { color: '#FFE66D', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  transcriptText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', fontStyle: 'italic', textAlign: 'center' },
  promptHint: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  noticeBanner: {
    backgroundColor: '#35211B',
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
