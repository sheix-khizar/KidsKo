import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer, setAudioModeAsync, AudioModule } from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { getToken } from './api';
import { getWsUrl } from './config';

export async function forceLoudspeakerAudio(): Promise<void> {
  try {
    await Promise.race([
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'duckOthers',
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('setAudioModeAsync timed out after 2500ms')), 2500)
      ),
    ]);
    console.log('[Mobile Audio Mode]: Audio mode configured to loudspeaker & duckOthers.');
  } catch (err: any) {
    console.warn('[Mobile Audio Mode]: Could not set audio mode:', err?.message || err);
  }
}

let wavFileCounter = 0;

function createWavBase64(pcmBinary: string): string {
  const pcmBytesLength = pcmBinary.length;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF header ("RIFF")
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
  view.setUint32(4, 36 + pcmBytesLength, true);
  // WAVE header ("WAVE")
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);
  // "fmt " chunk
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono (1 channel)
  view.setUint32(24, 24000, true); // Sample rate = 24000 Hz
  view.setUint32(28, 24000 * 2, true); // Byte rate = 48000 bytes/sec
  view.setUint16(32, 2, true); // Block align = 2 bytes
  view.setUint16(34, 16, true); // Bits per sample = 16-bit
  // "data" chunk
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
  view.setUint32(40, pcmBytesLength, true);

  const headerBytes = new Uint8Array(header);
  let binaryHeader = '';
  for (let i = 0; i < headerBytes.length; i++) {
    binaryHeader += String.fromCharCode(headerBytes[i]);
  }

  return btoa(binaryHeader + pcmBinary);
}

async function writePcmSegmentToTempWav(pcmBinary: string): Promise<string> {
  const wavBase64 = createWavBase64(pcmBinary);
  wavFileCounter++;
  const baseDir = FileSystem.cacheDirectory || `${FileSystem.documentDirectory}cache/`;
  const filePath = `${baseDir}kidsko_speech_${Date.now()}_${wavFileCounter}.wav`;
  await Promise.race([
    FileSystem.writeAsStringAsync(filePath, wavBase64, {
      encoding: FileSystem.EncodingType.Base64,
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('FileSystem.writeAsStringAsync timed out after 4000ms')), 4000)
    ),
  ]);
  return filePath;
}

type VoiceCallbacks = {
  onReady: (capSeconds: number) => void;
  onCapReached: () => void;
  onError: (reason: string) => void;
  onClose: (reason?: string | number) => void;
  onTranscript?: (text: string) => void;
  onSnapshotAck?: (remaining: number) => void;
  onSnapshotError?: (reason: string) => void;
  onStateChange?: (state: 'listening' | 'thinking' | 'speaking') => void;
  onNetworkNotice?: (message: string) => void;
};

// 24000 Hz, 16-bit mono PCM = 48000 bytes/sec
// ~1.5s initial buffer = 72000 bytes -> ensures Android AudioTrack buffer is fully primed before initial playback starts
const INITIAL_BUFFER_BYTES = 72000;
// ~1.0s streaming chunk buffer = 48000 bytes -> enables continuous preloading while previous segment is playing
const STREAMING_CHUNK_BYTES = 48000;
// ~0.5s resume buffer = 24000 bytes -> rapidly resumes playback if queue ever empties mid-stream
const RESUME_BUFFER_BYTES = 24000;

type AudioQueueItem = {
  uri: string;
  generation: number;
  chunkId: number;
};

type ActiveAudioPlayer = {
  player: any;
  uri: string;
  generation: number;
  chunkId: number;
};

type TurnEndReason = 'COMPLETED' | 'INTERRUPTED' | 'ERROR' | 'TIMEOUT';

export class VoiceSession {
  private ws: WebSocket | null = null;
  private activePlayer: ActiveAudioPlayer | null = null;
  private preloadedNextPlayer: ActiveAudioPlayer | null = null;
  private callbacks: VoiceCallbacks | null = null;
  private speechSubscriptions: any[] = [];
  private lastSentTranscript = '';
  private isSessionActive = false;
  private isStartingSpeech = false;
  private pendingSpeechRestart = false;
  private speechSilenceTimer: any = null;
  private thinkingWatchdogTimer: any = null;
  private midStreamWatchdogTimer: any = null;
  private speechRestartTimer: any = null;

  // Turn & Generation Ownership Tokens
  private currentTurnId = 0;
  private audioGeneration = 0;
  private currentRecognitionSessionId = 0;

  // Native AudioStream Streaming Mic State (Option B)
  private audioStream: any = null;
  private audioStreamSub: any = null;
  private isStreamingMic = false;
  private inputMode: 'audio' | 'text' = 'text';

  // Configurable Silence Debounce (1.8s in recommended 1.5 - 2s range)
  private silenceDebounceMs = 1800;

  // Streaming Audio Queue State
  private audioQueue: AudioQueueItem[] = [];
  private accumulatedPcmBinary = '';
  private hasStartedPlayback = false;
  private isPlayingQueue = false;
  private receivedChunkCount = 0;
  private queuedChunkCount = 0;
  private isTurnComplete = false;
  private hasLoggedPlaybackStart = false;
  private isFlushing = false;

  // Diagnostic Timers & Handoff Metrics
  private promptSentTime = 0;
  private firstChunkTime = 0;
  private lastSegmentFinishTime = 0;
  private currentSegmentPreloadTime = 0;

  // Starvation Progress Tracking Timestamps
  private lastAudioChunkReceivedAt = 0;
  private lastAudioChunkQueuedAt = 0;
  private lastPlaybackStartedAt = 0;
  private lastPlaybackProgressAt = 0;

  setSilenceDebounceMs(ms: number) {
    this.silenceDebounceMs = Math.max(500, ms);
  }

  getSilenceDebounceMs(): number {
    return this.silenceDebounceMs;
  }

  getLastTranscript(): string {
    return this.lastSentTranscript;
  }

  getAudioGeneration(): number {
    return this.audioGeneration;
  }

  private isKidskoActivelySpeakingAudio(): boolean {
    return (
      this.isPlayingQueue ||
      this.audioQueue.length > 0 ||
      this.preloadedNextPlayer !== null ||
      this.activePlayer !== null ||
      (this.hasStartedPlayback && !this.isTurnComplete)
    );
  }

  private isKidskoSpeaking(): boolean {
    return this.isKidskoActivelySpeakingAudio() || this.promptSentTime > 0;
  }

  private configurePlayerSettings(player: any) {
    try {
      player.volume = 1.0;
      player.muted = false;
      if (typeof player.setPlaybackRate === 'function') player.setPlaybackRate(1.0);
      else if (typeof player.setRate === 'function') player.setRate(1.0);
      else player.playbackRate = 1.0;
    } catch {}
  }

  async start(callbacks: VoiceCallbacks, studentId?: string) {
    const token = await getToken();
    if (!token) {
      callbacks.onError('Not authenticated');
      return;
    }

    this.callbacks = callbacks;
    this.isSessionActive = true;
    forceLoudspeakerAudio().catch(() => {});
    const studentParam = studentId ? `&studentId=${studentId}` : '';
    const inputModeParam = process.env.EXPO_PUBLIC_ENABLE_NATIVE_AUDIO_INPUT === 'true' ? '&inputMode=audio' : '';
    const socketUrl = `${getWsUrl()}/ws/voice?token=${token}${studentParam}${inputModeParam}`;
    console.log('Connecting Voice WebSocket to:', socketUrl);
    this.ws = new WebSocket(socketUrl);

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ready') {
          this.inputMode = msg.inputMode || 'text';
          console.log(`[Mobile WS Ready Frame]: Session cap = ${msg.capSeconds}s, inputMode = ${this.inputMode}. Waiting for Kidsko greeting...`);
          this.callbacks?.onStateChange?.('thinking');
          callbacks.onReady(msg.capSeconds);

          if (this.inputMode === 'audio') {
            this.startAudioStream().catch((err) => {
              console.error('[AudioStream Mic] Failed to start native audio stream:', err);
            });
          }

          // Fallback safety timer: if no initial greeting audio arrives within 5s, transition to listening
          setTimeout(() => {
            if (this.isSessionActive && !this.hasStartedPlayback && !this.isTurnComplete && this.receivedChunkCount === 0) {
              console.log('[Mobile WS]: Initial greeting fallback timeout -> transition to listening');
              this.callbacks?.onStateChange?.('listening');
              if (this.inputMode === 'text') {
                this.restartSpeechRecognition(100);
              }
            }
          }, 5000);
        } else if (msg.type === 'cap_reached') {
          console.log('[Mobile WS Cap Reached Frame]: Server sent cap_reached signal.');
          this.isSessionActive = false;
          this.stopAudioStream();
          this.stopSpeechRecognition();
          this.stopAudioPlayback();
          callbacks.onCapReached();
        } else if (msg.type === 'interrupted') {
          console.log(`[Mobile WS Interrupted Frame]: Server confirmed interruption for turnId=${msg.turnId}`);
          this.completeTurn('INTERRUPTED');
          this.resetTurnState();
        } else if (msg.type === 'error') {
          console.error('[Mobile WS Error Frame]: Server error =', msg.reason);
          callbacks.onError(msg.reason);
        } else if (msg.type === 'audio') {
          if (typeof msg.turnId === 'number' && msg.turnId !== this.currentTurnId) {
            console.log(`[Mobile Audio] Discarding stray audio chunk from old turn ${msg.turnId} (current turnId: ${this.currentTurnId}, generation: ${this.audioGeneration})`);
            return;
          }

          const currentGen = this.audioGeneration;
          const now = Date.now();
          this.receivedChunkCount++;
          this.lastAudioChunkReceivedAt = now;

          if (this.thinkingWatchdogTimer) {
            clearTimeout(this.thinkingWatchdogTimer);
            this.thinkingWatchdogTimer = null;
          }

          if (this.receivedChunkCount === 1) {
            this.firstChunkTime = now;
            const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
            console.log(`[Mobile Audio] First chunk received: +${latencyToFirstChunk} ms after prompt sent (turnId=${this.currentTurnId}, generation=${currentGen})`);
          }

          const queueBefore = this.audioQueue.length;

          // Append incoming chunk to binary PCM accumulator
          this.accumulatedPcmBinary += atob(msg.data);

          // Clear stall watchdog if new chunk arrived
          this.clearMidStreamWatchdog();
        } else if (msg.type === 'turn_complete') {
          if (typeof msg.turnId === 'number' && msg.turnId !== this.currentTurnId) {
            console.log(`[Mobile Audio] Discarding stray turn_complete frame from old turn ${msg.turnId} (current turnId: ${this.currentTurnId}, generation: ${this.audioGeneration})`);
            return;
          }

          const currentGen = this.audioGeneration;
          this.clearMidStreamWatchdog();

          const turnCompleteTime = Date.now();
          const latencyToTurnComplete = this.promptSentTime > 0 ? turnCompleteTime - this.promptSentTime : 0;
          console.log(`[Mobile Audio] Turn complete: +${latencyToTurnComplete} ms after prompt sent. Total chunks collected = ${this.receivedChunkCount} (generation=${currentGen})`);

          this.isTurnComplete = true;

          if (this.accumulatedPcmBinary.length === 0) {
            console.log('[Mobile Audio] No audio collected for turn; completing turn.');
            this.completeTurn('COMPLETED', currentGen);
            return;
          }

          // Play the complete turn cleanly with ONE single AudioPlayer
          this.playCompleteTurnAudio(currentGen);
        } else if (msg.type === 'text') {
          // AI response text from Gemini Live — preserved without spamming student speech transcript
        } else if (msg.type === 'snapshot_ack') {
          console.log(`[Mobile Snapshot Ack]: ${msg.remaining} remaining this week`);
          callbacks.onSnapshotAck?.(msg.remaining);
        } else if (msg.type === 'snapshot_error') {
          console.warn('[Mobile Snapshot Error]:', msg.reason);
          callbacks.onSnapshotError?.(msg.reason);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    this.ws.onclose = (e) => {
      console.log(`[Mobile WebSocket Close Event]: code = ${e.code}, reason = ${e.reason || 'None'}`);
      this.isSessionActive = false;
      this.clearMidStreamWatchdog();
      this.stopAudioStream();
      this.stopSpeechRecognition();
      this.stopAudioPlayback();
      callbacks.onClose(e.reason || e.code);
    };

    this.ws.onerror = (e: any) => {
      console.error('[Mobile WebSocket Error Event]:', e?.message || e);
      this.clearMidStreamWatchdog();
      callbacks.onError(e?.message || 'Connection error');
    };
  }

  sendImageCapture(base64Jpeg: string, caption?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[Mobile Sending Image Capture]:', base64Jpeg.length, 'base64 chars, caption:', caption || '(none)');
      this.stopSpeechRecognition();
      this.resetTurnState();
      this.callbacks?.onStateChange?.('thinking');
      this.promptSentTime = Date.now();
      // Allow up to 25s for image upload, Sharp compression, and Gemini multimodal vision reasoning
      this.startThinkingWatchdog(25000);
      forceLoudspeakerAudio().catch(() => {});
      this.ws.send(JSON.stringify({ type: 'image_capture', data: base64Jpeg, caption, turnId: this.currentTurnId }));
    }
  }

  sendCameraFrame(base64Jpeg: string) {
    if (this.ws?.readyState === WebSocket.OPEN && base64Jpeg) {
      this.ws.send(JSON.stringify({ type: 'camera_frame', data: base64Jpeg }));
    }
  }

  interrupt() {
    if (!this.isSessionActive) return;
    console.log('[Mobile Voice Input]: User explicitly requested interruption of Kidsko playback.');
    this.completeTurn('INTERRUPTED');
    this.resetTurnState();
    this.lastSentTranscript = '';
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt', turnId: this.currentTurnId }));
    }
  }

  private completeTurn(reason: TurnEndReason, expectedGen?: number) {
    const currentGen = this.audioGeneration;
    if (typeof expectedGen === 'number' && expectedGen !== currentGen) {
      console.log(`[Turn State] Discarding completeTurn call from stale generation ${expectedGen} (current: ${currentGen})`);
      return;
    }

    console.log(`[Turn State]: Ending turnId=${this.currentTurnId}, generation=${currentGen} with explicit reason: ${reason}`);

    this.clearMidStreamWatchdog();
    if (this.thinkingWatchdogTimer) {
      clearTimeout(this.thinkingWatchdogTimer);
      this.thinkingWatchdogTimer = null;
    }

    this.isTurnComplete = true;
    this.promptSentTime = 0;
    this.lastSentTranscript = '';
    this.isPlayingQueue = false;

    if (reason === 'INTERRUPTED') {
      this.stopAudioPlayback();
    }

    if (this.isSessionActive) {
      this.callbacks?.onStateChange?.('listening');
      if (this.inputMode === 'text') {
        this.restartSpeechRecognition(400);
      }
    }
  }

  private resetTurnState() {
    this.currentTurnId++;
    this.audioGeneration++;
    this.clearMidStreamWatchdog();
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }
    if (this.thinkingWatchdogTimer) {
      clearTimeout(this.thinkingWatchdogTimer);
      this.thinkingWatchdogTimer = null;
    }
    if (this.speechRestartTimer) {
      clearTimeout(this.speechRestartTimer);
      this.speechRestartTimer = null;
    }
    this.stopAudioPlayback();
    this.pendingSpeechRestart = false;
    this.promptSentTime = 0;
    this.firstChunkTime = 0;
    this.lastSegmentFinishTime = 0;
    this.currentSegmentPreloadTime = 0;
    this.receivedChunkCount = 0;
    this.queuedChunkCount = 0;
    this.accumulatedPcmBinary = '';
    this.audioQueue = [];
    this.hasStartedPlayback = false;
    this.isPlayingQueue = false;
    this.isTurnComplete = false;
    this.hasLoggedPlaybackStart = false;
    this.lastAudioChunkReceivedAt = 0;
    this.lastAudioChunkQueuedAt = 0;
    this.lastPlaybackStartedAt = 0;
    this.lastPlaybackProgressAt = 0;
  }

  private startThinkingWatchdog(timeoutMs = 8000) {
    if (this.thinkingWatchdogTimer) clearTimeout(this.thinkingWatchdogTimer);
    const gen = this.audioGeneration;
    this.thinkingWatchdogTimer = setTimeout(() => {
      this.thinkingWatchdogTimer = null;
      if (this.audioGeneration !== gen) return;
      if (this.isSessionActive && !this.hasStartedPlayback && !this.isTurnComplete) {
        console.warn(`[Mobile Voice Input] ⚠️ ${Math.round(timeoutMs / 1000)}s Thinking Watchdog Timer fired: Gemini response stalled.`);
        this.promptSentTime = 0;
        this.callbacks?.onNetworkNotice?.('Network response taking longer than usual. Speak again or tap End Call.');
        this.completeTurn('TIMEOUT', gen);
      }
    }, timeoutMs);
  }

  private stopAudioPlayback() {
    if (this.activePlayer || this.preloadedNextPlayer || this.audioQueue.length > 0 || this.isPlayingQueue) {
      console.log('[Mobile Turn Interrupted]: Discarding queued audio and stopping active/preloaded players.');
    }

    const filesToDelete: string[] = [];
    for (const item of this.audioQueue) {
      if (item.uri) filesToDelete.push(item.uri);
    }
    if (this.activePlayer?.uri) filesToDelete.push(this.activePlayer.uri);
    if (this.preloadedNextPlayer?.uri) filesToDelete.push(this.preloadedNextPlayer.uri);

    for (const uri of filesToDelete) {
      if (uri && uri.startsWith('file://')) {
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    }

    this.audioQueue = [];
    this.accumulatedPcmBinary = '';
    this.hasStartedPlayback = false;
    this.isPlayingQueue = false;
    this.lastSegmentFinishTime = 0;
    this.currentSegmentPreloadTime = 0;

    if (this.activePlayer?.player) {
      try {
        this.activePlayer.player.remove();
      } catch {}
      this.activePlayer = null;
    }

    if (this.preloadedNextPlayer?.player) {
      try {
        this.preloadedNextPlayer.player.remove();
      } catch {}
      this.preloadedNextPlayer = null;
    }
  }

  private restartSpeechRecognition(delayMs = 300) {
    if (this.inputMode === 'audio') return;
    if (!this.isSessionActive || this.ws?.readyState !== WebSocket.OPEN) return;
    if (this.speechRestartTimer) {
      clearTimeout(this.speechRestartTimer);
      this.speechRestartTimer = null;
    }
    this.callbacks?.onStateChange?.('listening');
    this.speechRestartTimer = setTimeout(() => {
      this.speechRestartTimer = null;
      if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && !this.isKidskoSpeaking()) {
        try {
          console.log('[SpeechRec Lifecycle]: Starting fresh speech recognition session...');
          this.startSpeechRecognition();
        } catch (err: any) {
          console.error('[SpeechRec Lifecycle]: Error restarting speech recognition:', err?.message || err);
        }
      }
    }, delayMs);
  }

  private finalizeSpokenTurn(transcript: string) {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }

    const cleanTranscript = transcript?.trim();
    if (
      cleanTranscript &&
      cleanTranscript.length > 0 &&
      cleanTranscript.toLowerCase() !== this.lastSentTranscript.toLowerCase() &&
      this.ws?.readyState === WebSocket.OPEN
    ) {
      // Immediately abort speech recognition to release microphone hardware lock
      this.stopSpeechRecognition();
      this.resetTurnState();
      this.callbacks?.onStateChange?.('thinking');
      this.promptSentTime = Date.now();
      this.startThinkingWatchdog();
      console.log(`[Mobile Voice Input] Finalized spoken turn -> Sending prompt to Gemini Live (turnId=${this.currentTurnId}, generation=${this.audioGeneration}):`, cleanTranscript);
      this.lastSentTranscript = cleanTranscript;
      this.ws.send(JSON.stringify({ type: 'text_prompt', data: cleanTranscript, turnId: this.currentTurnId }));
    }
  }

  private async startSpeechRecognition() {
    if (this.inputMode === 'audio') return;
    if (!this.isSessionActive || this.isStartingSpeech) return;
    if (this.isKidskoSpeaking()) {
      console.log('[SpeechRec Lifecycle] Suppressing startSpeechRecognition while Kidsko is actively speaking or thinking.');
      return;
    }
    this.isStartingSpeech = true;

    try {
      const perm = await Promise.race([
        ExpoSpeechRecognitionModule.requestPermissionsAsync(),
        new Promise<{ granted: boolean }>((resolve) =>
          setTimeout(() => {
            console.warn('[SpeechRec Lifecycle]: requestPermissionsAsync timed out after 5000ms');
            resolve({ granted: false });
          }, 5000)
        ),
      ]);
      if (!perm.granted) {
        console.warn('[SpeechRec Lifecycle]: Permission not granted');
        this.isStartingSpeech = false;
        return;
      }

      this.clearSpeechSubscriptions();

      this.currentRecognitionSessionId++;
      const sessionId = this.currentRecognitionSessionId;

      const subStart = ExpoSpeechRecognitionModule.addListener('start', () => {
        if (this.currentRecognitionSessionId !== sessionId) return;
        console.log(`[SpeechRec Lifecycle]: Started listening for spoken user turns (sessionId=${sessionId})...`);
        this.callbacks?.onStateChange?.('listening');
      });

      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        if (this.currentRecognitionSessionId !== sessionId) return;

        const transcript = event.results?.[0]?.transcript?.trim();
        const isFinal = event.isFinal || event.results?.[0]?.isFinal;

        if (!transcript || transcript.length <= 1) return;

        // Ignore incoming speech results if Kidsko is already thinking or speaking
        if (this.isKidskoSpeaking()) {
          console.log('[SpeechRec Lifecycle] Ignoring speech result while Kidsko is speaking/thinking:', transcript);
          return;
        }

        // Ignore duplicate transcript that matches what was already sent
        if (this.lastSentTranscript && transcript.toLowerCase() === this.lastSentTranscript.toLowerCase()) {
          return;
        }

        // Real-time live transcript streaming to UI screen
        this.callbacks?.onTranscript?.(transcript);

        if (this.speechSilenceTimer) {
          clearTimeout(this.speechSilenceTimer);
          this.speechSilenceTimer = null;
        }

        if (isFinal) {
          console.log(`[SpeechRec Lifecycle]: Received final speech frame (sessionId=${sessionId}) -> dispatching turn immediately:`, transcript);
          this.finalizeSpokenTurn(transcript);
        } else {
          // Natural pause endpoint detection: configurable debounce (default 1800ms)
          this.speechSilenceTimer = setTimeout(() => {
            if (this.currentRecognitionSessionId !== sessionId) return;
            console.log(`[SpeechRec Lifecycle]: ${this.silenceDebounceMs}ms silence detected after user speech (sessionId=${sessionId}) -> dispatching turn:`, transcript);
            this.finalizeSpokenTurn(transcript);
          }, this.silenceDebounceMs);
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        if (this.currentRecognitionSessionId !== sessionId) return;
        console.warn(`[SpeechRec Lifecycle]: Recognition error event (sessionId=${sessionId}) =`, event.error);
        if (event.error === 'no-speech' && !this.isKidskoSpeaking()) {
          this.restartSpeechRecognition();
        }
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        if (this.currentRecognitionSessionId !== sessionId) return;
        console.log(`[SpeechRec Lifecycle]: Recognition session ended (sessionId=${sessionId}).`);
        if (this.isSessionActive && !this.isKidskoSpeaking()) {
          this.restartSpeechRecognition();
        }
      });

      this.speechSubscriptions.push(subStart, subResult, subError, subEnd);

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      });
    } catch (err: any) {
      console.error('[SpeechRec Lifecycle]: Start exception =', err?.message || err);
    } finally {
      this.isStartingSpeech = false;
    }
  }

  private clearSpeechSubscriptions() {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }
    if (this.speechRestartTimer) {
      clearTimeout(this.speechRestartTimer);
      this.speechRestartTimer = null;
    }
    for (const sub of this.speechSubscriptions) {
      try {
        sub.remove();
      } catch {}
    }
    this.speechSubscriptions = [];
  }

  private stopSpeechRecognition() {
    console.log('[SpeechRec Lifecycle]: Stopping speech recognition and cleaning listeners...');
    this.clearSpeechSubscriptions();
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {}
    }
  }

  private async startAudioStream() {
    if (!this.isSessionActive || this.isStreamingMic) return;
    try {
      console.log('[AudioStream Lifecycle]: Requesting microphone recording permissions...');
      const perm = await Promise.race([
        AudioModule.requestRecordingPermissionsAsync(),
        new Promise<{ granted: boolean }>((resolve) =>
          setTimeout(() => {
            console.warn('[AudioStream Lifecycle]: requestRecordingPermissionsAsync timed out after 5000ms');
            resolve({ granted: false });
          }, 5000)
        ),
      ]);

      if (!perm.granted) {
        console.warn('[AudioStream Lifecycle]: Recording permission not granted.');
        return;
      }

      this.stopAudioStream();

      console.log('[AudioStream Lifecycle]: Initializing AudioStream (16000Hz, mono, int16)...');
      this.audioStream = new AudioModule.AudioStream({
        sampleRate: 16000,
        channels: 1,
        encoding: 'int16',
      });

      this.audioStreamSub = this.audioStream.addListener('audioStreamBuffer', (buffer: any) => {
        if (!this.isSessionActive || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!buffer?.data) return;

        // Suppress mic transmission while Kidsko is actively speaking out of the loudspeaker
        // to prevent loudspeaker echo from feeding back into Gemini Live and self-interrupting
        if (this.isKidskoSpeaking()) {
          return;
        }

        try {
          const bytes = new Uint8Array(buffer.data);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Chunk = btoa(binary);
          this.ws.send(JSON.stringify({
            type: 'audio_chunk',
            data: base64Chunk,
            isRawPcm: true,
          }));
        } catch (streamErr) {
          console.error('[AudioStream Lifecycle] Error sending audio chunk:', streamErr);
        }
      });

      await Promise.race([
        this.audioStream.start(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('AudioStream.start() timed out after 4000ms')), 4000)
        ),
      ]);
      this.isStreamingMic = true;
      console.log('[AudioStream Lifecycle]: AudioStream capturing and streaming mic PCM.');
    } catch (err: any) {
      console.error('[AudioStream Lifecycle]: Exception starting AudioStream:', err?.message || err);
      this.stopAudioStream();
    }
  }

  private stopAudioStream() {
    if (this.audioStreamSub) {
      try {
        this.audioStreamSub.remove();
      } catch {}
      this.audioStreamSub = null;
    }
    if (this.audioStream) {
      try {
        this.audioStream.stop();
      } catch {}
      this.audioStream = null;
    }
    this.isStreamingMic = false;
  }

  private async flushBufferedPcmToQueue(forceAll = false, expectedGen?: number): Promise<void> {
    const currentGen = this.audioGeneration;
    if (typeof expectedGen === 'number' && expectedGen !== currentGen) return;

    if (this.isFlushing) {
      if (forceAll) {
        const flushWaitStart = Date.now();
        while (this.isFlushing) {
          if (Date.now() - flushWaitStart > 3000) {
            console.warn('[Mobile Audio] Stalled isFlushing lock detected (>3000ms). Force-releasing lock.');
            this.isFlushing = false;
            break;
          }
          await new Promise((r) => setTimeout(r, 40));
        }
      } else {
        return;
      }
    }
    this.isFlushing = true;
    try {
      while (this.accumulatedPcmBinary.length > 0) {
        if (this.audioGeneration !== currentGen) break;

        const bytesPerSegment = !this.hasStartedPlayback
          ? INITIAL_BUFFER_BYTES
          : (!this.isPlayingQueue ? RESUME_BUFFER_BYTES : STREAMING_CHUNK_BYTES);

        if (!forceAll && this.accumulatedPcmBinary.length < bytesPerSegment) {
          break;
        }

        const pcmSegmentLength = forceAll
          ? this.accumulatedPcmBinary.length
          : Math.min(bytesPerSegment, this.accumulatedPcmBinary.length);

        if (pcmSegmentLength <= 0) break;

        const pcmSegmentBinary = this.accumulatedPcmBinary.slice(0, pcmSegmentLength);
        this.accumulatedPcmBinary = this.accumulatedPcmBinary.slice(pcmSegmentLength);

        try {
          const filePath = await writePcmSegmentToTempWav(pcmSegmentBinary);
          if (this.audioGeneration === currentGen) {
            this.queuedChunkCount++;
            this.audioQueue.push({ uri: filePath, generation: currentGen, chunkId: this.queuedChunkCount });
            this.lastAudioChunkQueuedAt = Date.now();
          } else {
            // Turn changed while file was being written; delete immediately
            FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {});
          }
        } catch (err) {
          console.error('[Mobile Audio] Error saving temp WAV segment:', err);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private async playCompleteTurnAudio(expectedGen: number) {
    if (this.audioGeneration !== expectedGen) return;
    if (this.accumulatedPcmBinary.length === 0) return;

    const pcmData = this.accumulatedPcmBinary;
    this.accumulatedPcmBinary = '';

    // Stop speech recognition and release any previous player
    this.stopSpeechRecognition();
    this.stopAudioPlayback();
    forceLoudspeakerAudio().catch(() => {});

    try {
      const filePath = await writePcmSegmentToTempWav(pcmData);
      if (this.audioGeneration !== expectedGen) {
        FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {});
        return;
      }

      console.log(`[Mobile Audio Playback]: Starting complete turn playback (gen=${expectedGen}) from: ${filePath}`);
      const player = createAudioPlayer({ uri: filePath });
      this.configurePlayerSettings(player);

      this.activePlayer = {
        player,
        uri: filePath,
        generation: expectedGen,
        chunkId: 1,
      };
      this.hasStartedPlayback = true;
      this.isPlayingQueue = true;
      this.callbacks?.onStateChange?.('speaking');

      let hasFinished = false;
      const onDone = () => {
        if (hasFinished) return;
        hasFinished = true;
        if (this.audioGeneration !== expectedGen) return;
        console.log(`[Mobile Audio Playback]: Turn finished cleanly (gen=${expectedGen})`);
        this.stopAudioPlayback();
        this.completeTurn('COMPLETED', expectedGen);
      };

      player.addListener('playbackStatusUpdate', (status: any) => {
        if (this.audioGeneration !== expectedGen) return;
        if (status.error) {
          console.error('[Mobile Audio Playback Error Status]:', status.error);
          onDone();
          return;
        }
        if (
          status.didJustFinish ||
          status.playbackState === 'ended' ||
          (status.playing === false && status.currentTime > 0 && status.duration > 0 && status.currentTime >= status.duration - 0.08)
        ) {
          onDone();
        }
      });

      player.play();
    } catch (err: any) {
      console.error('[Mobile Audio Playback Exception]:', err?.message || err);
      this.completeTurn('ERROR', expectedGen);
    }
  }

  private startAudioQueuePlayback(expectedGen?: number) {
    const currentGen = this.audioGeneration;
    if (typeof expectedGen === 'number' && expectedGen !== currentGen) return;
    if (this.isPlayingQueue) return;

    // Immediately stop speech recognition to release microphone hardware and avoid speaker muting
    this.stopSpeechRecognition();
    forceLoudspeakerAudio().catch(() => {});

    this.hasStartedPlayback = true;
    this.callbacks?.onStateChange?.('speaking');
    this.playNextAudioSegment(currentGen);
  }

  private preloadNextSegment(expectedGen?: number) {
    const currentGen = this.audioGeneration;
    if (typeof expectedGen === 'number' && expectedGen !== currentGen) return;
    if (this.preloadedNextPlayer || this.audioQueue.length === 0) return;

    // Drop any stale chunks from old generations
    while (this.audioQueue.length > 0 && this.audioQueue[0].generation !== currentGen) {
      const staleItem = this.audioQueue.shift()!;
      if (staleItem.uri?.startsWith('file://')) {
        FileSystem.deleteAsync(staleItem.uri, { idempotent: true }).catch(() => {});
      }
    }

    if (this.audioQueue.length === 0) return;

    const nextSegmentItem = this.audioQueue.shift()!;
    try {
      console.log(`[Mobile Audio Preload]: Pre-creating audio player for gen=${currentGen}, chunk=${nextSegmentItem.chunkId}:`, nextSegmentItem.uri);
      const player = createAudioPlayer({ uri: nextSegmentItem.uri });
      this.configurePlayerSettings(player);
      this.preloadedNextPlayer = {
        player,
        uri: nextSegmentItem.uri,
        generation: currentGen,
        chunkId: nextSegmentItem.chunkId,
      };
      this.currentSegmentPreloadTime = Date.now();
    } catch (err) {
      console.error('[Mobile Audio Preload Error]: Could not pre-create audio player:', err);
      this.audioQueue.unshift(nextSegmentItem);
    }
  }

  private playNextAudioSegment(expectedGen?: number) {
    const currentGen = this.audioGeneration;
    if (typeof expectedGen === 'number' && expectedGen !== currentGen) {
      console.log(`[AudioPlayback] Discarding playNextAudioSegment call from stale generation ${expectedGen} (current: ${currentGen})`);
      return;
    }
    if (!this.isSessionActive) return;

    let currentItem: ActiveAudioPlayer | null = null;
    const isPreloaded = !!this.preloadedNextPlayer && this.preloadedNextPlayer.generation === currentGen;

    if (isPreloaded) {
      currentItem = this.preloadedNextPlayer;
      this.preloadedNextPlayer = null;
    } else if (this.audioQueue.length > 0) {
      // Purge any stale chunks belonging to old generations
      while (this.audioQueue.length > 0 && this.audioQueue[0].generation !== currentGen) {
        const stale = this.audioQueue.shift()!;
        if (stale.uri?.startsWith('file://')) {
          FileSystem.deleteAsync(stale.uri, { idempotent: true }).catch(() => {});
        }
      }

      if (this.audioQueue.length > 0) {
        const nextSegmentItem = this.audioQueue.shift()!;
        try {
          console.log(`[Mobile Audio Playback]: Creating audio player for gen=${currentGen}, chunk=${nextSegmentItem.chunkId}:`, nextSegmentItem.uri);
          const player = createAudioPlayer({ uri: nextSegmentItem.uri });
          this.configurePlayerSettings(player);
          currentItem = {
            player,
            uri: nextSegmentItem.uri,
            generation: currentGen,
            chunkId: nextSegmentItem.chunkId,
          };
        } catch (err) {
          console.error('[Mobile Playback Error]: Exception creating audio player for:', nextSegmentItem.uri, err);
          if (nextSegmentItem.uri.startsWith('file://')) {
            FileSystem.deleteAsync(nextSegmentItem.uri, { idempotent: true }).catch(() => {});
          }
        }
      }
    }

    if (!currentItem || !currentItem.player) {
      this.isPlayingQueue = false;
      if (this.isTurnComplete) {
        const playbackEndTime = Date.now();
        const totalTurnTime = this.promptSentTime > 0 ? playbackEndTime - this.promptSentTime : 0;
        console.log(`[Mobile Audio] Playback finished: +${totalTurnTime} ms after prompt sent. Session remains WAITING FOR NEXT USER TURN.`);
        this.completeTurn('COMPLETED', currentGen);
      } else {
        // Structured log when queue is empty mid-stream waiting for next chunk (Requirement 5)
        console.log(`[AudioStream]\ngeneration=${currentGen}\nqueueSize=0\nwaitingForNextChunk=true`);
        this.scheduleMidStreamWatchdog(currentGen);
      }
      return;
    }

    this.isPlayingQueue = true;
    this.callbacks?.onStateChange?.('speaking');

    const now = Date.now();
    this.lastPlaybackProgressAt = now;

    if (!this.hasLoggedPlaybackStart) {
      this.hasLoggedPlaybackStart = true;
      this.lastPlaybackStartedAt = now;
      const timeToFirstAudio = this.promptSentTime > 0 ? now - this.promptSentTime : 0;
      console.log(`[Mobile Audio] Playback started: +${timeToFirstAudio} ms after prompt sent (turnId=${this.currentTurnId}, generation=${currentGen})`);
    }

    // Structured playback start log (Requirement 5)
    console.log(`[AudioPlayback]\ngeneration=${currentGen}\nchunk=${currentItem.chunkId}\nplaybackStartedAt=${now}`);

    const previousItem = this.activePlayer;
    this.activePlayer = currentItem;
    const { player: playerToPlay, uri: playingUri } = currentItem;

    let hasHandledCompletion = false;

    // Safety watchdog: prevents ever freezing in dead silence if native audio layer fails to emit playback completion
    const safetyTimer = setTimeout(() => {
      if (!hasHandledCompletion && this.activePlayer === currentItem) {
        if (this.audioGeneration !== currentGen) return;
        console.warn('[Mobile Audio Playback] ⚠️ Segment safety watchdog fired for segment:', playingUri);
        handleCompletion();
      }
    }, 4000);

    const handleCompletion = () => {
      if (hasHandledCompletion) return;
      hasHandledCompletion = true;
      clearTimeout(safetyTimer);

      if (this.audioGeneration !== currentGen) {
        // Callback from previous interrupted turn: release resources without triggering next segment
        try {
          playerToPlay.remove();
        } catch {}
        if (playingUri && playingUri.startsWith('file://')) {
          FileSystem.deleteAsync(playingUri, { idempotent: true }).catch(() => {});
        }
        return;
      }

      this.lastSegmentFinishTime = Date.now();
      this.lastPlaybackProgressAt = this.lastSegmentFinishTime;

      if (this.activePlayer === currentItem) {
        this.activePlayer = null;
      }

      // Asynchronously delete the temporary WAV file
      if (playingUri && playingUri.startsWith('file://')) {
        FileSystem.deleteAsync(playingUri, { idempotent: true }).catch(() => {});
      }

      // Seamless Handoff: Start playing the next preloaded segment IMMEDIATELY
      this.playNextAudioSegment(currentGen);
    };

    playerToPlay.addListener('playbackStatusUpdate', (status: any) => {
      if (this.audioGeneration !== currentGen) {
        return;
      }
      if (status.error) {
        console.error('[Mobile Audio Playback Error Status]:', status.error);
        handleCompletion();
        return;
      }

      const isFinished =
        status.didJustFinish ||
        status.playbackState === 'ended' ||
        (status.playing === false && status.currentTime > 0 && status.duration > 0 && status.currentTime >= status.duration - 0.08);

      if (isFinished) {
        handleCompletion();
      }
    });

    try {
      playerToPlay.play();
    } catch (playErr) {
      console.error('[Mobile Audio Play Error]:', playErr);
      handleCompletion();
      return;
    }

    // Clean up previous player asynchronously after new player has started playing
    if (previousItem && previousItem !== currentItem) {
      setTimeout(() => {
        try {
          previousItem.player?.remove?.();
          if (previousItem.uri && previousItem.uri.startsWith('file://')) {
            FileSystem.deleteAsync(previousItem.uri, { idempotent: true }).catch(() => {});
          }
        } catch {}
      }, 500);
    }

    // Immediately preload the NEXT segment player in background while current segment plays
    this.preloadNextSegment(currentGen);
  }

  private clearMidStreamWatchdog() {
    if (this.midStreamWatchdogTimer) {
      clearTimeout(this.midStreamWatchdogTimer);
      this.midStreamWatchdogTimer = null;
    }
  }

  private scheduleMidStreamWatchdog(expectedGeneration: number) {
    this.clearMidStreamWatchdog();
    this.midStreamWatchdogTimer = setTimeout(() => {
      this.midStreamWatchdogTimer = null;
      this.checkMidStreamWatchdog(expectedGeneration);
    }, 3000);
  }

  private checkMidStreamWatchdog(expectedGeneration: number) {
    if (this.audioGeneration !== expectedGeneration) {
      // Stale watchdog belonging to prior turn/interruption; ignore
      return;
    }
    if (!this.isSessionActive || this.isTurnComplete) {
      return;
    }

    const now = Date.now();
    const elapsedSinceLastChunk = this.lastAudioChunkReceivedAt > 0 ? now - this.lastAudioChunkReceivedAt : 999999;
    const elapsedSincePlaybackProgress = this.lastPlaybackProgressAt > 0 ? now - this.lastPlaybackProgressAt : 999999;
    const isPlaying = this.isPlayingQueue || this.activePlayer !== null;

    // Structured watchdog diagnostic log (Requirement 5)
    console.log(
      `[Watchdog]\ngeneration=${expectedGeneration}\nelapsedSinceLastChunk=${elapsedSinceLastChunk}\nelapsedSincePlaybackProgress=${elapsedSincePlaybackProgress}\nqueueSize=${this.audioQueue.length}\nisPlaying=${isPlaying}\nisTurnComplete=${this.isTurnComplete}`
    );

    // If audio is actively playing or queued, this is NOT starvation: reschedule watchdog
    if (isPlaying || this.audioQueue.length > 0) {
      this.scheduleMidStreamWatchdog(expectedGeneration);
      return;
    }

    // If chunks are still arriving from Gemini within the last 3000ms, wait for next chunk
    if (elapsedSinceLastChunk < 3000) {
      this.scheduleMidStreamWatchdog(expectedGeneration);
      return;
    }

    // If buffered PCM bytes exist in memory, flush them and continue playback instead of timing out
    if (this.accumulatedPcmBinary.length > 0) {
      console.log(`[Watchdog] Flushing ${this.accumulatedPcmBinary.length} buffered PCM bytes to prevent starvation`);
      this.flushBufferedPcmToQueue(true, expectedGeneration).then(() => {
        if (this.audioGeneration === expectedGeneration && !this.isPlayingQueue) {
          this.playNextAudioSegment(expectedGeneration);
        }
      });
      return;
    }

    // Genuine Starvation: No audio queued, not playing, no chunks arrived for >= 3000ms
    console.warn(
      `[Watchdog Starvation Fired]:\ngeneration=${expectedGeneration}\nturnId=${this.currentTurnId}\nqueue size=${this.audioQueue.length}\nisPlaying=${isPlaying}\nisTurnComplete=${this.isTurnComplete}\nlast chunk timestamp=${this.lastAudioChunkReceivedAt}\nlast playback timestamp=${this.lastPlaybackProgressAt}\ntime since last chunk=${elapsedSinceLastChunk}ms\ntime since last playback=${elapsedSincePlaybackProgress}ms\nWebSocket state=${this.ws?.readyState}`
    );

    this.completeTurn('TIMEOUT', expectedGeneration);
  }

  async end() {
    console.log('[Mobile Session End Call]: User manually ending voice session...');
    this.isSessionActive = false;
    this.pendingSpeechRestart = false;
    this.clearMidStreamWatchdog();
    this.stopAudioStream();
    if (this.thinkingWatchdogTimer) {
      clearTimeout(this.thinkingWatchdogTimer);
      this.thinkingWatchdogTimer = null;
    }
    if (this.speechRestartTimer) {
      clearTimeout(this.speechRestartTimer);
      this.speechRestartTimer = null;
    }
    this.clearSpeechSubscriptions();
    this.stopAudioPlayback();
    if (this.ws) {
      this.ws.close();
    }
  }
}

