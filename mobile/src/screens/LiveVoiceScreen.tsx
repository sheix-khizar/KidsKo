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
import { AskieReactionOverlay, triggerAskieReaction } from '../ui/AskieReactions';
import { AppIcon } from '../ui/AppIcon';
import { VoiceSession } from '../services/voiceSocket';
import { getVoiceEligibility, recordVoiceCallStars } from '../services/api';
import { vibrateTap } from '../utils/feedback';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isCompact = SCREEN_HEIGHT < 720;

type Props = {
  studentId: string;
  studentName: string;
  initialMode?: 'voice' | 'video';
  onBack: () => void;
  onLimitReached: (reason?: string) => void;
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
  const limitTriggeredRef = useRef<boolean>(false);
  const summaryFadeAnim = useRef(new Animated.Value(1)).current;
  const isGoingHomeRef = useRef<boolean>(false);

  const cleanupCallResources = useCallback(() => {
    if (quotaTimerRef.current) clearInterval(quotaTimerRef.current);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    quotaTimerRef.current = null;
    durationTimerRef.current = null;
    frameIntervalRef.current = null;
    sessionRef.current?.end();
    setIsVideoActive(false);
  }, []);

  const triggerLimitPaywall = useCallback(
    (reason?: string) => {
      if (limitTriggeredRef.current) return;
      limitTriggeredRef.current = true;
      cleanupCallResources();
      onLimitReached(reason || 'Weekly voice & video limit reached! Upgrade to Premium for more.');
    },
    [cleanupCallResources, onLimitReached]
  );

  useEffect(() => {
    getVoiceEligibility()
      .then((res) => {
        if (res && (!res.allowed || res.minutesRemaining <= 0)) {
          triggerLimitPaywall(res.reason);
          return;
        }
        if (res && typeof res.minutesRemaining === 'number') {
          setSecondsLeft((prev) => (prev === null ? res.minutesRemaining * 60 : prev));
        }
      })
      .catch(() => {});
  }, [triggerLimitPaywall]);
  const [callDuration, setCallDuration] = useState<number>(0);
  const callDurationRef = useRef<number>(0);
  const callEndedRef = useRef<boolean>(false);
  const [endedStarsEarned, setEndedStarsEarned] = useState<number>(0);
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
  const backDevice = useCameraDevice('back');
  const frontDevice = useCameraDevice('front');
  const device = cameraPosition === 'back' ? (backDevice || frontDevice) : (frontDevice || backDevice);
  const photoOutput = usePhotoOutput();
  const outputs = useMemo(() => (photoOutput ? [photoOutput] : []), [photoOutput]);

  const isCameraActive = isVideoActive && isAppForeground && hasPermission && !!device;

  // Auto request camera permission if missing when camera mode active
  useEffect(() => {
    if (isVideoActive && !hasPermission) {
      requestPermission();
    }
  }, [isVideoActive, hasPermission, requestPermission]);

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
    if (!isCameraActive || !isCameraReady || !photoOutput || status !== 'live') {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      return;
    }

    const captureFrame = async () => {
      if (isCapturingRef.current || !isCameraActive || !isCameraReady || !isVideoActive) return;
      isCapturingRef.current = true;
      try {
        if (!isCameraReady || !isCameraActive) return;
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
    limitTriggeredRef.current = false;
    callEndedRef.current = false;
    callDurationRef.current = 0;
    setEndedStarsEarned(0);
    summaryFadeAnim.setValue(1);
    isGoingHomeRef.current = false;
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
            callDurationRef.current += 1;
            setCallDuration((d) => d + 1);
          }, 1000);
        },
        onCapReached: () => {
          triggerLimitPaywall('Weekly voice & video limit reached! Upgrade to Premium for more.');
        },
        onError: (reason) => {
          const msg = reason?.toString() || 'Connection error';
          const lower = msg.toLowerCase();
          if (lower.includes('limit') || lower.includes('used up') || lower.includes('4002')) {
            triggerLimitPaywall(msg);
            return;
          }
          setErrorReason(msg);
          handleEnd();
        },
        onClose: (reason) => {
          const reasonStr = reason?.toString() || '';
          if (
            reason === 4002 ||
            reason === 4003 ||
            reasonStr.toLowerCase().includes('limit') ||
            reasonStr.toLowerCase().includes('used up')
          ) {
            triggerLimitPaywall(reasonStr || 'Weekly voice & video limit reached! Upgrade to Premium for more.');
            return;
          }
          if (reason) setErrorReason(reasonStr);
          handleEnd();
        },
        onTranscript: (text) => {
          if (text && text.trim().length > 0) {
            setLastSpokenTranscript(text.trim());
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
    setVoiceState('listening');
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

    if (!callEndedRef.current) {
      callEndedRef.current = true;
      const elapsedSec = callDurationRef.current;
      // Real earned stars strictly based on genuine active call time (>= 10s), zero fake baseline
      const realStars = elapsedSec >= 10 ? Math.min(20, Math.max(1, Math.floor(elapsedSec / 15))) : 0;
      setEndedStarsEarned(realStars);

      if (realStars > 0) {
        recordVoiceCallStars(studentId, elapsedSec).catch(() => {});
        SecureStore.getItemAsync(`@kidsko_stars_${studentId}`)
          .then((saved) => {
            const cur = saved ? parseInt(saved, 10) : 0;
            const safeCur = isNaN(cur) ? 0 : cur;
            SecureStore.setItemAsync(`@kidsko_stars_${studentId}`, String(safeCur + realStars)).catch(() => {});
          })
          .catch(() => {});
      }
    }

    setStatus('ended');
  };

  // Restart Call from summary screen
  const handleRestartCall = () => {
    setErrorReason(null);
    setLastSpokenTranscript('');
    startSession();
  };

  // Return to home from summary screen with smooth fade-out animation
  const handleGoHome = () => {
    if (isGoingHomeRef.current) return;
    isGoingHomeRef.current = true;
    cleanupCallResources();
    Animated.timing(summaryFadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onBack();
    });
  };

  // Floating Reaction Handler (Google Meet style)
  const handleSendReaction = (emoji: string, e?: any) => {
    vibrateTap('light');
    const x = e?.nativeEvent?.pageX ?? Math.random() * (SCREEN_WIDTH - 120) + 60;
    const y = e?.nativeEvent?.pageY ?? SCREEN_HEIGHT * 0.72;
    triggerAskieReaction(emoji, x, y);
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
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    const realMinutesDisplay = `${mins}:${secs.toString().padStart(2, '0')}`;

    return (
      <Animated.View style={[styles.container, { opacity: summaryFadeAnim }]}>
      <LinearGradient colors={GRADIENTS.ended} style={styles.container}>
        <View
          style={[
            styles.summaryInner,
            {
              paddingTop: Math.max(insets.top, 24) + 28,
              paddingBottom: Math.max(insets.bottom, 20) + 12,
            },
          ]}
        >
          {/* Calm Grounded Mascot Hero - Inside Safe Area */}
          <View style={styles.summaryMascotContainer}>
            <AskieCompanion size="l" state="idle" standing={true} />
          </View>

          {/* Heading */}
          <Text style={styles.summaryTitle}>Great talking, {studentName}! 🎉</Text>
          <Text style={styles.summarySubtitle}>You are getting so smart!</Text>

          {/* 2 Real Stat Cards in a Row (Minutes & Stars) */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{realMinutesDisplay}</Text>
              <Text style={styles.statLabel}>⏱️ Minutes</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>+{endedStarsEarned}</Text>
              <Text style={styles.statLabel}>⭐ Stars</Text>
            </View>
          </View>

          {/* Two Big CTAs */}
          <View style={styles.summaryButtonsCol}>
            <Pressable
              style={({ pressed }) => [
                styles.big3DButton,
                styles.buttonHome,
                pressed && { transform: [{ scale: 0.98 }], borderBottomWidth: 2, marginTop: 3 },
              ]}
              onPress={handleGoHome}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
            >
              <Text style={styles.buttonHomeText}>Back to home 🏠</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.big3DButton,
                styles.buttonTalkAgain,
                pressed && { transform: [{ scale: 0.98 }], borderBottomWidth: 2, marginTop: 3 },
              ]}
              onPress={handleRestartCall}
              accessibilityRole="button"
              accessibilityLabel="Talk again"
            >
              <Text style={styles.buttonTalkAgainText}>🎤 Talk again</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
      </Animated.View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SCREEN 2: FULL-SCREEN CAMERA / VISION AI (IMAGE 3)
  // Controls: Flip on left, Interrupt in center, Stop on right
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
            enableNativeZoomGesture={false}
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

        {/* Minimal Live Pill at Top Center with Speaking / Interrupt Status */}
        <View style={[styles.cameraTopHeader, { paddingTop: insets.top + 8 }]}>
          <View style={styles.liveBadgePill}>
            <View style={styles.liveBlinkDot} />
            <Text style={styles.liveBadgeText}>LIVE {formatTimer(callDuration)}</Text>
          </View>
          {voiceState === 'speaking' && (
            <View style={styles.camSpeakingPill}>
              <Text style={styles.camSpeakingText}>🔊 Kidsko is talking • Tap ✋ to stop</Text>
            </View>
          )}
        </View>

        {/* Viewfinder Target Reticle [ ] */}
        <View style={styles.viewfinderBox} pointerEvents="none">
          <View style={[styles.reticleCorner, styles.reticleTL]} />
          <View style={[styles.reticleCorner, styles.reticleTR]} />
          <View style={[styles.reticleCorner, styles.reticleBL]} />
          <View style={[styles.reticleCorner, styles.reticleBR]} />
        </View>

        {/* Bottom Dock: Flip on Left, Interrupt in Center, Stop on Right */}
        <View style={[styles.cameraBottomDock, { paddingBottom: insets.bottom + 20 }]}>
          {/* Flip Button (Left side) */}
          <View style={styles.camDockItem}>
            <Pressable
              style={({ pressed }) => [
                styles.camRoundBtnSecondary,
                pressed && { transform: [{ scale: 0.93 }] },
              ]}
              onPress={handleFlipCamera}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <Text style={styles.camRoundBtnIcon}>🔄</Text>
            </Pressable>
            <Text style={styles.camDockLabel}>Flip</Text>
          </View>

          {/* Interrupt Button (Center - Prominent so kid can stop Kidsko anytime) */}
          <View style={styles.camDockItem}>
            <Pressable
              style={({ pressed }) => [
                styles.camRoundBtnInterrupt,
                voiceState === 'speaking' && styles.camRoundBtnInterruptActive,
                pressed && { transform: [{ scale: 0.93 }] },
              ]}
              onPress={handleInterrupt}
              accessibilityRole="button"
              accessibilityLabel="Interrupt Kidsko"
            >
              <Text style={styles.camRoundBtnInterruptIcon}>✋</Text>
            </Pressable>
            <Text style={styles.camDockLabel}>Interrupt</Text>
          </View>

          {/* Stop Button (Right side - Exits camera mode back to voice) */}
          <View style={styles.camDockItem}>
            <Pressable
              style={({ pressed }) => [
                styles.camRoundBtnStop,
                pressed && { transform: [{ scale: 0.93 }] },
              ]}
              onPress={() => setIsVideoActive(false)}
              accessibilityRole="button"
              accessibilityLabel="Stop camera mode"
            >
              <AppIcon name="close" size={22} color="#FFFFFF" strokeWidth={2.8} />
            </Pressable>
            <Text style={styles.camDockLabel}>Stop</Text>
          </View>
        </View>

        {/* Floating Google Meet Reactions in Camera Mode */}
        <AskieReactionOverlay />
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
      <View
        style={[
          styles.voiceInner,
          {
            paddingTop: insets.top + (isCompact ? 4 : 8),
            paddingBottom: isCompact ? Math.max(insets.bottom, 10) : insets.bottom + 16,
          },
        ]}
      >
        {/* Top Header Row: Safe call & Quota */}
        <View style={styles.topRow}>
          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>🔒 Safe call</Text>
          </View>

          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>
              ⏱️ {secondsLeft !== null ? `${Math.ceil(secondsLeft / 60)} min left` : '10 min left'}
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
              size={isCompact ? 'l' : 'xl'}
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

        {/* Live Caption Card */}
        <View style={styles.captionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: voiceState === 'speaking' ? '#FFE66D' : '#C8FFF9',
              }}
            />
            <Text
              style={[
                styles.captionSpeaker,
                { color: voiceState === 'speaking' ? '#FFE66D' : '#C8FFF9' },
              ]}
            >
              {voiceState === 'speaking' ? 'KIDSKO' : studentName.toUpperCase()}
            </Text>
          </View>
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
              onPress={(e) => handleSendReaction(emoji, e)}
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
            <Pressable
              style={({ pressed }) => [
                styles.dockRoundButton,
                styles.dockBtnInterrupt,
                pressed && { transform: [{ scale: 0.93 }], borderBottomWidth: 2, marginTop: 3 },
              ]}
              onPress={handleInterrupt}
              accessibilityRole="button"
              accessibilityLabel="Interrupt Kidsko"
            >
              <Text style={styles.dockBtnIcon}>✋</Text>
            </Pressable>
            <Text style={styles.dockBtnLabel}>Interrupt</Text>
          </View>

          {/* Show Me Button (Toggles Camera Mode) */}
          <View style={styles.dockItem}>
            <Pressable
              style={({ pressed }) => [
                styles.dockRoundButton,
                styles.dockBtnShowMe,
                pressed && { transform: [{ scale: 0.93 }], borderBottomWidth: 2, marginTop: 3 },
              ]}
              onPress={handleToggleVideo}
              accessibilityRole="button"
              accessibilityLabel="Show me something"
            >
              <Text style={styles.dockBtnIcon}>📷</Text>
            </Pressable>
            <Text style={styles.dockBtnLabel}>Show me</Text>
          </View>

          {/* Bye! Button (Ends Call -> Summary Screen) */}
          <View style={styles.dockItem}>
            <Pressable
              style={({ pressed }) => [
                styles.dockRoundButton,
                styles.dockBtnBye,
                pressed && { transform: [{ scale: 0.93 }], borderBottomWidth: 2, marginTop: 3 },
              ]}
              onPress={handleEnd}
              accessibilityRole="button"
              accessibilityLabel="End call"
            >
              <Text style={styles.dockBtnIcon}>👋</Text>
            </Pressable>
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

      {/* Floating Google Meet Reactions in Call Screen */}
      <AskieReactionOverlay />
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
    marginVertical: isCompact ? 4 : 10,
  },
  soundwaveRing: {
    position: 'absolute',
    width: isCompact ? 165 : 210,
    height: isCompact ? 165 : 210,
    borderRadius: isCompact ? 83 : 105,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  mascotDisc: {
    width: isCompact ? 135 : 175,
    height: isCompact ? 135 : 175,
    borderRadius: isCompact ? 68 : 88,
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
    fontSize: isCompact ? 11 : 12,
    fontFamily: fontFamilies.extraBold,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: isCompact ? 6 : 12,
  },
  statePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 4,
    paddingHorizontal: isCompact ? 16 : 20,
    paddingVertical: isCompact ? 6 : 8,
    borderRadius: 22,
    marginTop: isCompact ? 6 : 8,
  },
  statePillText: {
    color: '#FFFFFF',
    fontSize: isCompact ? 14 : 16,
    fontFamily: fontFamilies.black,
  },
  equalizerRow: {
    marginTop: isCompact ? 6 : 10,
    height: isCompact ? 22 : 28,
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
    paddingHorizontal: isCompact ? 14 : 18,
    paddingVertical: isCompact ? 8 : 14,
    minHeight: isCompact ? 68 : 100,
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
    fontSize: isCompact ? 14 : 17,
    fontFamily: fontFamilies.extraBold,
    lineHeight: isCompact ? 19 : 24,
  },

  // Reactions Row
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: isCompact ? 8 : 12,
    marginVertical: isCompact ? 2 : 4,
  },
  reactionButton: {
    width: isCompact ? 44 : 52,
    height: isCompact ? 40 : 48,
    borderRadius: isCompact ? 14 : 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: isCompact ? 20 : 24,
  },

  // Bottom Control Dock
  bottomDock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: isCompact ? 4 : 8,
  },
  dockItem: {
    alignItems: 'center',
    width: isCompact ? 76 : 90,
  },
  dockRoundButton: {
    width: isCompact ? 60 : 72,
    height: isCompact ? 60 : 72,
    borderRadius: isCompact ? 30 : 36,
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
    fontSize: isCompact ? 24 : 30,
  },
  dockBtnLabel: {
    color: '#FFFFFF',
    fontSize: isCompact ? 12 : 13,
    fontFamily: fontFamilies.black,
    marginTop: isCompact ? 4 : 8,
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
  camSpeakingPill: {
    backgroundColor: 'rgba(255, 94, 126, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginTop: 8,
  },
  camSpeakingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fontFamilies.black,
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
  camRoundBtnInterrupt: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FFD08A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  camRoundBtnInterruptActive: {
    backgroundColor: '#FFE66D',
    borderColor: '#FFA502',
    transform: [{ scale: 1.05 }],
  },
  camRoundBtnInterruptIcon: {
    fontSize: 32,
  },
  camRoundBtnStop: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FF5E7E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF5E7E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  camRoundBtnStopIcon: {
    color: '#FFFFFF',
    fontSize: 26,
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
    width: 175,
    height: 155,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  summaryTitle: {
    fontSize: isCompact ? 24 : 30,
    color: '#FFFFFF',
    fontFamily: fontFamilies.black,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: isCompact ? 4 : 8,
  },
  summarySubtitle: {
    fontSize: isCompact ? 14 : 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: fontFamilies.extraBold,
    textAlign: 'center',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: isCompact ? 8 : 12,
    width: '100%',
    marginVertical: isCompact ? 8 : 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 20,
    paddingVertical: isCompact ? 10 : 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: isCompact ? 22 : 28,
    color: '#FFFFFF',
    fontFamily: fontFamilies.black,
    lineHeight: isCompact ? 26 : 32,
  },
  statLabel: {
    fontSize: isCompact ? 11 : 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: fontFamilies.extraBold,
    marginTop: 2,
  },
  summaryButtonsCol: {
    width: '100%',
    gap: isCompact ? 8 : 14,
    marginTop: isCompact ? 4 : 10,
  },
  summaryBtnScale: {
    width: '100%',
  },
  big3DButton: {
    width: '100%',
    height: isCompact ? 54 : 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomWidth: 4,
  },
  buttonHome: {
    backgroundColor: '#FF6B6B',
    borderBottomColor: '#D94A4A',
  },
  buttonHomeText: {
    color: '#FFFFFF',
    fontSize: isCompact ? 17 : 19,
    fontFamily: fontFamilies.black,
  },
  buttonTalkAgain: {
    backgroundColor: '#5B7CFA',
    borderBottomColor: '#3F5EFB',
  },
  buttonTalkAgainText: {
    color: '#FFFFFF',
    fontSize: isCompact ? 17 : 19,
    fontFamily: fontFamilies.black,
  },
});
