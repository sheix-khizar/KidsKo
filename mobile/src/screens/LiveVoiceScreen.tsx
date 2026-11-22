import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import * as SecureStore from 'expo-secure-store';
import { colors, fontFamilies } from '../theme';
import { LinearGradient } from '../ui/LinearGradient';
import { WaveBars, PressScale } from '../ui/motion';
import { AskieCompanion } from '../ui/AskieCompanion';
import { VoiceSession } from '../services/voiceSocket';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = {
  studentId: string;
  studentName: string;
  initialMode?: 'voice' | 'video';
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

// Gradient color themes according to voice state
const GRADIENTS = {
  idle: ['#8A6BFF', '#5B7CFA', '#3FA7D6'] as const,
  connecting: ['#8A6BFF', '#5B7CFA', '#3FA7D6'] as const,
  listening: ['#18B5A8', '#2E86DE', '#3F5EFB'] as const,
  thinking: ['#8E5CF7', '#6A4CE0', '#4A3DB5'] as const,
  speaking: ['#FF7A59', '#FF5E7E', '#C84FB8'] as const,
  ended: ['#8A6BFF', '#5B7CFA', '#3FA7D6'] as const,
};

export default function LiveVoiceScreen({
  studentId,
  studentName,
  initialMode = 'voice',
  onBack,
  onLimitReached,
}: Props) {
  const insets = useSafeAreaInsets();

  // Core Call State
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended'>('connecting');
  const [voiceState, setVoiceState] = useState<'listening' | 'thinking' | 'speaking'>('listening');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [questionCount, setQuestionCount] = useState<number>(1);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [lastSpokenTranscript, setLastSpokenTranscript] = useState<string>('');
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);

  // Live Camera / Vision State
  const [isVideoActive, setIsVideoActive] = useState(initialMode === 'video');
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAppForeground, setIsAppForeground] = useState(true);
  const [cameraAllowedByParent, setCameraAllowedByParent] = useState(true);

  // Vision Camera Hooks
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(cameraPosition);
  const photoOutput = usePhotoOutput(PHOTO_CONFIG);
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  const isCameraActive = status === 'live' && isVideoActive && isAppForeground && hasPermission && !!device;

  const sessionRef = useRef<VoiceSession | null>(null);
  const quotaTimerRef = useRef<any>(null);
  const durationTimerRef = useRef<any>(null);
  const frameIntervalRef = useRef<any>(null);
  const isCapturingRef = useRef<boolean>(false);
  const lastInterruptTapRef = useRef<number>(0);

  // Pulse animation for soundwave rings around mascot
  const ringScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.12,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ringScale]);

  // AppState listener for camera lifecycle safety
  useEffect(() => {
    SecureStore.getItemAsync('kidsko_parent_allow_camera')
      .then((val) => {
        if (val !== null) setCameraAllowedByParent(val === 'true');
      })
      .catch(() => {});

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setIsAppForeground(nextState === 'active');
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Frame sampling loop for Vision AI
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

  // Start Voice Session
  const startSession = useCallback(() => {
    setStatus('connecting');
    setCallDuration(0);

    const session = new VoiceSession();
    sessionRef.current = session;

    session.start(
      {
        onReady: (capSeconds) => {
          setStatus('live');
          setSecondsLeft(capSeconds);

          // Quota countdown timer
          quotaTimerRef.current = setInterval(() => {
            setSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0));
          }, 1000);

          // Call duration counter
          durationTimerRef.current = setInterval(() => {
            setCallDuration((d) => d + 1);
          }, 1000);
        },
        onCapReached: () => {
          handleEnd();
          setErrorReason('Voice & video limit reached for this session.');
        },
        onError: (reason) => {
          if (reason && reason.toString().toLowerCase().includes('limit')) onLimitReached();
          setErrorReason(reason?.toString() || 'Connection error');
          handleEnd();
        },
        onClose: (reason) => {
          if (reason) setErrorReason(reason.toString());
          handleEnd();
        },
        onTranscript: (text) => {
          if (text && text.trim().length > 0) {
            setLastSpokenTranscript(text.trim());
            setQuestionCount((prev) => prev + 1);
          }
        },
        onStateChange: (state) => {
          setVoiceState((prevState) => {
            if (prevState !== state) {
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
  }, [studentId, onLimitReached]);

  useEffect(() => {
    startSession();

    return () => {
      if (quotaTimerRef.current) clearInterval(quotaTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      sessionRef.current?.end();
    };
  }, [startSession]);

  // Interrupt AI speech (Debounced)
  const handleInterrupt = () => {
    const now = Date.now();
    if (now - lastInterruptTapRef.current < 400) return;
    lastInterruptTapRef.current = now;
    sessionRef.current?.interrupt();
  };

  // Toggle Video / Full Screen Camera Mode
  const handleToggleVideo = async () => {
    if (!cameraAllowedByParent) {
      setErrorReason('Camera access is disabled in Parental Controls.');
      return;
    }
    if (isVideoActive) {
      setIsCameraReady(false);
      setIsVideoActive(false);
    } else {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setErrorReason('Camera permission is required for live video.');
          return;
        }
      }
      setIsVideoActive(true);
    }
  };

  // Flip Camera between back and front
  const handleFlipCamera = () => {
    setCameraPosition((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // End Call -> Transitions to Post-Call Summary Screen (Image 4)
  const handleEnd = () => {
    if (quotaTimerRef.current) clearInterval(quotaTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    sessionRef.current?.end();
    setIsVideoActive(false);
    setStatus('ended');
  };

  // Restart Call from summary screen
  const handleRestartCall = () => {
    setErrorReason(null);
    setLastSpokenTranscript('');
    startSession();
  };

  // Floating Reaction Handler
  const handleSendReaction = (emoji: string) => {
    setActiveReaction(emoji);
    setTimeout(() => {
      setActiveReaction(null);
    }, 1500);
  };

  // Format MM:SS for call timer
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Current active gradient
  const currentGradient: readonly [string, string, ...string[]] =
    status === 'ended'
      ? GRADIENTS.ended
      : status === 'connecting'
      ? GRADIENTS.connecting
      : isVideoActive
      ? ['#0B1B17', '#142E28', '#1F473E']
      : voiceState === 'speaking'
      ? GRADIENTS.speaking
      : voiceState === 'thinking'
      ? GRADIENTS.thinking
      : GRADIENTS.listening;

  // ═══════════════════════════════════════════════════════════════
  // SCREEN 3: POST-CALL SUMMARY SCREEN (IMAGE 4)
  // ═══════════════════════════════════════════════════════════════
  if (status === 'ended') {
    const durationMinutes = Math.max(1, Math.round(callDuration / 60));
    const starsEarned = Math.max(5, questionCount * 2 + 5);

    return (
      <LinearGradient colors={GRADIENTS.ended} style={styles.container}>
        <View style={[styles.summaryInner, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
          {/* Celebrating Mascot Hero */}
          <View style={styles.summaryMascotContainer}>
            <AskieCompanion size="xl" state="celebrate" />
          </View>

          {/* Heading */}
          <Text style={styles.summaryTitle}>Great talking, {studentName}! 🎉</Text>
          <Text style={styles.summarySubtitle}>You are getting so smart!</Text>

          {/* 3 Stat Cards in a Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{durationMinutes}</Text>
              <Text style={styles.statLabel}>⏱️ Minutes</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{questionCount}</Text>
              <Text style={styles.statLabel}>❓ Questions</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>+{starsEarned}</Text>
              <Text style={styles.statLabel}>⭐ Stars</Text>
            </View>
          </View>

          {/* Two Big CTAs */}
          <View style={styles.summaryButtonsCol}>
            <PressScale onPress={onBack} style={styles.summaryBtnScale}>
              <Pressable
                style={[styles.big3DButton, styles.buttonHome]}
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Back to home"
              >
                <Text style={styles.buttonHomeText}>Back to home 🏠</Text>
              </Pressable>
            </PressScale>

            <PressScale onPress={handleRestartCall} style={styles.summaryBtnScale}>
              <Pressable
                style={[styles.big3DButton, styles.buttonTalkAgain]}
                onPress={handleRestartCall}
                accessibilityRole="button"
                accessibilityLabel="Talk again"
              >
                <Text style={styles.buttonTalkAgainText}>🎤 Talk again</Text>
              </Pressable>
            </PressScale>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SCREEN 2: FULL-SCREEN CAMERA / VISION AI (IMAGE 3)
  // Controls: Flip on left, Stop in center (no top buttons, no suggestions, no mascot box)
  // ═══════════════════════════════════════════════════════════════
  if (isVideoActive) {
    return (
      <View style={styles.fullCameraContainer}>
        {/* Full-Screen Camera Surface */}
        {hasPermission && device ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isCameraActive}
            outputs={outputs}
            resizeMode="cover"
            onStarted={() => setIsCameraReady(true)}
            onStopped={() => setIsCameraReady(false)}
            onError={(err) => console.error('[LiveVoiceScreen] Camera error:', err)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.cameraPlaceholder]}>
            <ActivityIndicator size="large" color="#00E676" />
            <Text style={styles.cameraPlaceholderText}>Connecting camera...</Text>
          </View>
        )}

        {/* Minimal Live Pill at Top Center (No top buttons!) */}
        <View style={[styles.cameraTopHeader, { paddingTop: insets.top + 8 }]}>
          <View style={styles.liveBadgePill}>
            <View style={styles.liveBlinkDot} />
            <Text style={styles.liveBadgeText}>LIVE {formatTimer(callDuration)}</Text>
          </View>
        </View>

        {/* Viewfinder Target Reticle [ ] */}
        <View style={styles.viewfinderBox} pointerEvents="none">
          <View style={[styles.reticleCorner, styles.reticleTL]} />
          <View style={[styles.reticleCorner, styles.reticleTR]} />
          <View style={[styles.reticleCorner, styles.reticleBL]} />
          <View style={[styles.reticleCorner, styles.reticleBR]} />
        </View>

        {/* Bottom Dock: Flip on Left, Stop in Center, Talk on Right */}
        <View style={[styles.cameraBottomDock, { paddingBottom: insets.bottom + 20 }]}>
          {/* Flip Button (Left side) */}
          <View style={styles.camDockItem}>
            <PressScale onPress={handleFlipCamera}>
              <Pressable
                style={styles.camRoundBtnSecondary}
                onPress={handleFlipCamera}
                accessibilityRole="button"
                accessibilityLabel="Flip camera"
              >
                <Text style={styles.camRoundBtnIcon}>🔄</Text>
              </Pressable>
            </PressScale>
            <Text style={styles.camDockLabel}>Flip</Text>
          </View>

          {/* Stop Button (Center - Prominent) */}
          <View style={styles.camDockItem}>
            <PressScale onPress={() => setIsVideoActive(false)}>
              <Pressable
                style={styles.camRoundBtnStop}
                onPress={() => setIsVideoActive(false)}
                accessibilityRole="button"
                accessibilityLabel="Stop camera mode"
              >
                <Text style={styles.camRoundBtnStopIcon}>✕</Text>
              </Pressable>
            </PressScale>
            <Text style={styles.camDockLabel}>Stop</Text>
          </View>

          {/* Talk / Voice Button (Right side) */}
          <View style={styles.camDockItem}>
            <PressScale onPress={() => setIsVideoActive(false)}>
              <Pressable
                style={styles.camRoundBtnSecondary}
                onPress={() => setIsVideoActive(false)}
                accessibilityRole="button"
                accessibilityLabel="Switch to voice"
              >
                <Text style={styles.camRoundBtnIcon}>🎤</Text>
              </Pressable>
            </PressScale>
            <Text style={styles.camDockLabel}>Talk</Text>
          </View>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SCREEN 1: ACTIVE LIVE VOICE CALL (IMAGE 2)
  // Controls: Interrupt ✋ on left, Show me 📷 in center, Bye! 👋 on right (No suggestions)
  // ═══════════════════════════════════════════════════════════════
  const captionText =
    voiceState === 'speaking'
      ? lastSpokenTranscript || 'Sunlight is made of many colors! 🌈'
      : voiceState === 'thinking'
      ? 'Thinking about the best answer for you... 💭'
      : lastSpokenTranscript
      ? `"${lastSpokenTranscript}"`
      : "I'm listening! Ask me anything about science, animals, or space! ✨";

  return (
    <LinearGradient colors={currentGradient} style={styles.container}>
      <View style={[styles.voiceInner, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        {/* Top Header Row: Safe call & Quota */}
        <View style={styles.topRow}>
          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>🔒 Safe call</Text>
          </View>

          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>
              ⏱️ {secondsLeft !== null ? `${Math.ceil(secondsLeft / 60)} min left` : '18 min left'}
            </Text>
          </View>
        </View>

        {/* Call Title & Duration Counter */}
        <View style={styles.callHeader}>
          <Text style={styles.callHeaderTitle}>Kidsko</Text>
          <Text style={styles.callHeaderTimer}>{formatTimer(callDuration)}</Text>
        </View>

        {/* Center Stage: Ripple Soundwave Rings & Animated Companion */}
        <View style={styles.stageCenter}>
          {/* Animated Outer Pulse Ring */}
          <Animated.View
            style={[
              styles.soundwaveRing,
              {
                transform: [{ scale: ringScale }],
                borderColor: voiceState === 'speaking' ? '#FFE66D' : 'rgba(255,255,255,0.45)',
              },
            ]}
          />

          {/* Interactive Mascot */}
          <Pressable
            style={styles.mascotDisc}
            onPress={handleInterrupt}
            accessibilityRole="button"
            accessibilityLabel="Tap mascot to interrupt"
          >
            <AskieCompanion
              size="xl"
              state={status === 'connecting' ? 'idle' : voiceState}
              interactive={true}
              onPress={handleInterrupt}
            />
          </Pressable>

          {/* Tap hint text */}
          <Text style={styles.tapInterruptHint}>Tap me to interrupt</Text>

          {/* State Pill */}
          <View style={styles.statePill}>
            <Text style={styles.statePillText}>
              {status === 'connecting'
                ? '⏳ Connecting...'
                : voiceState === 'speaking'
                ? '🔊 Kidsko is talking'
                : voiceState === 'thinking'
                ? '⏳ Kidsko is thinking...'
                : '🎙️ Kidsko is listening'}
            </Text>
          </View>

          {/* Audio Equalizer Bars */}
          <View style={styles.equalizerRow}>
            <WaveBars
              count={14}
              color="#FFE66D"
              active={voiceState === 'speaking' || voiceState === 'listening'}
            />
          </View>
        </View>

        {/* Floating Reaction Animation */}
        {activeReaction && (
          <View style={styles.reactionPopWrapper} pointerEvents="none">
            <Text style={styles.reactionPopEmoji}>{activeReaction}</Text>
          </View>
        )}

        {/* Live Caption Card */}
        <View style={styles.captionCard}>
          <Text
            style={[
              styles.captionSpeaker,
              { color: voiceState === 'speaking' ? '#FFE66D' : '#C8FFF9' },
            ]}
          >
            ● {voiceState === 'speaking' ? 'KIDSKO' : studentName.toUpperCase()}
          </Text>
          <Text style={styles.captionText} numberOfLines={3}>
            {captionText}
          </Text>
        </View>

        {/* Floating Reactions Row */}
        <View style={styles.reactionsRow}>
          {['👍', '❤️', '😂', '🤯', '🎉'].map((emoji) => (
            <Pressable
              key={emoji}
              style={styles.reactionButton}
              onPress={() => handleSendReaction(emoji)}
              accessibilityRole="button"
              accessibilityLabel={`React ${emoji}`}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        {/* Bottom Dock: [Interrupt ✋] [Show me 📷] [Bye! 👋] */}
        <View style={styles.bottomDock}>
          {/* Interrupt Button (Replaces Mic On per user rule) */}
          <View style={styles.dockItem}>
            <PressScale onPress={handleInterrupt}>
              <Pressable
                style={[styles.dockRoundButton, styles.dockBtnInterrupt]}
                onPress={handleInterrupt}
                accessibilityRole="button"
                accessibilityLabel="Interrupt Kidsko"
              >
                <Text style={styles.dockBtnIcon}>✋</Text>
              </Pressable>
            </PressScale>
            <Text style={styles.dockBtnLabel}>Interrupt</Text>
          </View>

          {/* Show Me Button (Toggles Camera Mode) */}
          <View style={styles.dockItem}>
            <PressScale onPress={handleToggleVideo}>
              <Pressable
                style={[styles.dockRoundButton, styles.dockBtnShowMe]}
                onPress={handleToggleVideo}
                accessibilityRole="button"
                accessibilityLabel="Show me something"
              >
                <Text style={styles.dockBtnIcon}>📷</Text>
              </Pressable>
            </PressScale>
            <Text style={styles.dockBtnLabel}>Show me</Text>
          </View>

          {/* Bye! Button (Ends Call -> Summary Screen) */}
          <View style={styles.dockItem}>
            <PressScale onPress={handleEnd}>
              <Pressable
                style={[styles.dockRoundButton, styles.dockBtnBye]}
                onPress={handleEnd}
                accessibilityRole="button"
                accessibilityLabel="End call"
              >
                <Text style={styles.dockBtnIcon}>👋</Text>
              </Pressable>
            </PressScale>
            <Text style={styles.dockBtnLabel}>Bye!</Text>
          </View>
        </View>

        {/* Network Notice Toast if active */}
        {networkNotice && (
          <Pressable style={styles.noticeToast} onPress={() => setNetworkNotice(null)}>
            <Text style={styles.noticeToastText}>⚡ {networkNotice}</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  voiceInner: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },

  // Top Header Pills
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  headerPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fontFamilies.extraBold,
  },

  // Call Header Title & Ticker
  callHeader: {
    alignItems: 'center',
    marginTop: 4,
  },
  callHeaderTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    fontFamily: fontFamilies.black,
    letterSpacing: -0.4,
  },
  callHeaderTimer: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: fontFamilies.bold,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  // Center Stage
  stageCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  soundwaveRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  mascotDisc: {
    width: 175,
    height: 175,
    borderRadius: 88,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  tapInterruptHint: {
    fontSize: 12,
    fontFamily: fontFamilies.extraBold,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 12,
  },
  statePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 22,
    marginTop: 8,
  },
  statePillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fontFamilies.black,
  },
  equalizerRow: {
    marginTop: 10,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Reaction Pop
  reactionPopWrapper: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    zIndex: 99,
  },
  reactionPopEmoji: {
    fontSize: 70,
  },

  // Live Caption Card
  captionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 100,
    justifyContent: 'center',
  },
  captionSpeaker: {
    fontSize: 11,
    fontFamily: fontFamilies.black,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fontFamilies.extraBold,
    lineHeight: 24,
  },

  // Reactions Row
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 4,
  },
  reactionButton: {
    width: 52,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 24,
  },

  // Bottom Control Dock
  bottomDock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
  },
  dockItem: {
    alignItems: 'center',
    width: 90,
  },
  dockRoundButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0, 0, 0, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  dockBtnInterrupt: {
    backgroundColor: '#FFFFFF',
  },
  dockBtnShowMe: {
    backgroundColor: '#18B5A8',
  },
  dockBtnBye: {
    backgroundColor: '#FF5E7E',
  },
  dockBtnIcon: {
    fontSize: 30,
  },
  dockBtnLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fontFamilies.black,
    marginTop: 8,
  },

  // Network Notice Toast
  noticeToast: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
    marginTop: 6,
  },
  noticeToastText: {
    color: '#FFE66D',
    fontSize: 12,
    fontFamily: fontFamilies.bold,
  },

  // ═══════════════════════════════════════════════════════════════
  // FULL SCREEN CAMERA STYLES (IMAGE 3)
  // ═══════════════════════════════════════════════════════════════
  fullCameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B1B17',
  },
  cameraPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fontFamilies.bold,
    marginTop: 12,
  },
  cameraTopHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  liveBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
  },
  liveBlinkDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF4D4D',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: fontFamilies.black,
    letterSpacing: 0.5,
  },

  // Viewfinder Reticle [ ]
  viewfinderBox: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.22,
    left: 40,
    right: 40,
    height: SCREEN_HEIGHT * 0.42,
  },
  reticleCorner: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderColor: '#FFFFFF',
  },
  reticleTL: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 14,
  },
  reticleTR: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 14,
  },
  reticleBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 14,
  },
  reticleBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 14,
  },

  // Camera Bottom Dock
  cameraBottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
    zIndex: 10,
  },
  camDockItem: {
    alignItems: 'center',
    width: 80,
  },
  camRoundBtnSecondary: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camRoundBtnIcon: {
    fontSize: 26,
  },
  camRoundBtnStop: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FF5E7E',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF5E7E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  camRoundBtnStopIcon: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: fontFamilies.black,
  },
  camDockLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fontFamilies.black,
    marginTop: 6,
  },

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY SCREEN STYLES (IMAGE 4)
  // ═══════════════════════════════════════════════════════════════
  summaryInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  summaryMascotContainer: {
    width: 190,
    height: 190,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  summaryTitle: {
    fontSize: 30,
    color: '#FFFFFF',
    fontFamily: fontFamilies.black,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  summarySubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: fontFamilies.extraBold,
    textAlign: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginVertical: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 28,
    color: '#FFFFFF',
    fontFamily: fontFamilies.black,
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: fontFamilies.extraBold,
    marginTop: 4,
  },
  summaryButtonsCol: {
    width: '100%',
    gap: 14,
    marginTop: 10,
  },
  summaryBtnScale: {
    width: '100%',
  },
  big3DButton: {
    width: '100%',
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 5,
  },
  buttonHome: {
    backgroundColor: '#FF6B6B',
    borderBottomColor: '#D94A4A',
  },
  buttonHomeText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontFamily: fontFamilies.black,
  },
  buttonTalkAgain: {
    backgroundColor: '#5B7CFA',
    borderBottomColor: '#3F5EFB',
  },
  buttonTalkAgainText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontFamily: fontFamilies.black,
  },
});
