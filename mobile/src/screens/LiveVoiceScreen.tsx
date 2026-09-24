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
      console.log('[LiveVoiceScreen] captureFrame called! isCapturing:', isCapturingRef.current, 'isCameraActive:', isCameraActive, 'isCameraReady:', isCameraReady);
      if (isCapturingRef.current || !isCameraActive || !isCameraReady) return;
      isCapturingRef.current = true;
      try {
        console.log('[LiveVoiceScreen] Calling photoOutput.capturePhoto()...');
        const photo = await photoOutput.capturePhoto({ enableShutterSound: false }, {});
        console.log('[LiveVoiceScreen] photo captured! Fetching data...');
        try {
          const fileData = await photo.getFileDataAsync();
          if (fileData && fileData.byteLength > 0) {
            const base64 = arrayBufferToBase64(fileData);
            console.log('[LiveVoiceScreen] sendVideoFrame base64 length:', base64.length);
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
              <Pressable style={styles.cameraOverlayToggle} onPress={handleToggleVideo}>
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
          >
            <Text style={styles.videoToggleButtonText}>
              {isVideoActive ? '📹 Turn Off Video' : '📹 Start Live Video'}
            </Text>
          </Pressable>
        </View>
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
  timer: { fontSize: 16, color: '#FFD54F', fontWeight: '700', marginBottom: 16 },
  errorSub: { fontSize: 14, color: '#FF8A80', fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  endButton: { backgroundColor: '#EA4335', borderRadius: 30, paddingVertical: 14, paddingHorizontal: 40, marginTop: 10 },
  endButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  videoToggleButton: {
    backgroundColor: '#00897B',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  videoToggleButtonActive: {
    backgroundColor: '#D32F2F',
  },
  videoToggleButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

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
  cameraContainer: {
    width: '100%',
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    backgroundColor: '#000',
  },
  liveVideoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
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

  noticeBanner: {
    backgroundColor: '#3e2723',
    borderColor: '#ffb74d',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    alignItems: 'center',
    width: '100%',
  },
  noticeBannerText: { color: '#ffe082', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  noticeDismissText: { color: 'rgba(255,224,130,0.7)', fontSize: 11, fontWeight: '600', marginTop: 3 },
});
