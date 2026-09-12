import * as FileSystem from 'expo-file-system/legacy';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { getToken } from './api';
import { getWsUrl } from './config';

export async function forceLoudspeakerAudio(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'doNotMix',
    });
    console.log('[Mobile Audio Mode]: Audio mode forced to loudspeaker & doNotMix.');
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

  // fmt subchunk ("fmt ")
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);        // Subchunk1Size = 16 (PCM)
  view.setUint16(20, 1, true);         // AudioFormat = 1 (PCM)
  view.setUint16(22, 1, true);         // NumChannels = 1 (mono)
  view.setUint32(24, 24000, true);     // SampleRate = 24000 Hz
  view.setUint32(28, 24000 * 2, true); // ByteRate = 24000 * 1 * 16/8 = 48000
  view.setUint16(32, 2, true);         // BlockAlign = 1 * 16/8 = 2
  view.setUint16(34, 16, true);        // BitsPerSample = 16

  // data subchunk ("data")
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
  await FileSystem.writeAsStringAsync(filePath, wavBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
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
// ~300ms initial buffer = 14400 bytes -> instant early playback start on first burst
const INITIAL_BUFFER_BYTES = 14400;
// ~1.2s chunk buffer = 57600 bytes -> unifies turn chunks into single smooth WAV tracks
const CHUNK_BUFFER_BYTES = 57600;

export class VoiceSession {
  private ws: WebSocket | null = null;
  private activePlayer: { player: any; uri: string } | null = null;
  private preloadedNextPlayer: { player: any; uri: string } | null = null;
  private callbacks: VoiceCallbacks | null = null;
  private speechSubscriptions: any[] = [];
  private lastSentTranscript = '';
  private isSessionActive = false;
  private isStartingSpeech = false;
  private pendingSpeechRestart = false;
  private speechSilenceTimer: any = null;
  private thinkingWatchdogTimer: any = null;
  private currentTurnId = 0;

  // Streaming Audio Queue State
  private audioQueue: string[] = [];
  private accumulatedPcmBinary = '';
  private flushingPromise: Promise<void> | null = null;
  private hasStartedPlayback = false;
  private isPlayingQueue = false;
  private receivedChunkCount = 0;
  private isTurnComplete = false;
  private hasLoggedPlaybackStart = false;

  // Diagnostic Timers & Handoff Metrics
  private promptSentTime = 0;
  private firstChunkTime = 0;
  private lastSegmentFinishTime = 0;
  private currentSegmentPreloadTime = 0;

  getLastTranscript(): string {
    return this.lastSentTranscript;
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

  async start(callbacks: VoiceCallbacks, studentId?: string) {
    const token = await getToken();
    if (!token) {
      callbacks.onError('Not authenticated');
      return;
    }

    this.callbacks = callbacks;
    this.isSessionActive = true;
    await forceLoudspeakerAudio().catch(() => {});
    const studentParam = studentId ? `&studentId=${studentId}` : '';
    const socketUrl = `${getWsUrl()}/ws/voice?token=${token}${studentParam}`;
    console.log('Connecting Voice WebSocket to:', socketUrl);
    this.ws = new WebSocket(socketUrl);

    this.ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ready') {
          console.log(`[Mobile WS Ready Frame]: Session cap = ${msg.capSeconds}s`);
          this.callbacks?.onStateChange?.('listening');
          callbacks.onReady(msg.capSeconds);
        } else if (msg.type === 'cap_reached') {
          console.log('[Mobile WS Cap Reached Frame]: Server sent cap_reached signal.');
          this.isSessionActive = false;
          this.stopSpeechRecognition();
          this.stopAudioPlayback();
          callbacks.onCapReached();
        } else if (msg.type === 'error') {
          console.error('[Mobile WS Error Frame]: Server error =', msg.reason);
          callbacks.onError(msg.reason);
        } else if (msg.type === 'audio') {
          if (typeof msg.turnId === 'number' && msg.turnId !== this.currentTurnId) {
            console.log(`[Mobile Audio] Discarding stray audio chunk from old turn ${msg.turnId} (current turnId: ${this.currentTurnId})`);
            return;
          }
          this.receivedChunkCount++;
          if (this.thinkingWatchdogTimer) {
            clearTimeout(this.thinkingWatchdogTimer);
            this.thinkingWatchdogTimer = null;
          }
          if (this.receivedChunkCount === 1) {
            this.firstChunkTime = Date.now();
            const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
            console.log(`[Mobile Audio] First chunk received: +${latencyToFirstChunk} ms after prompt sent`);
          }

          // Append incoming chunk to binary PCM accumulator
          this.accumulatedPcmBinary += atob(msg.data);

          // Check if initial buffer threshold (~300ms) reached to start streaming playback
          if (!this.hasStartedPlayback) {
            if (this.accumulatedPcmBinary.length >= INITIAL_BUFFER_BYTES) {
              await this.flushBufferedPcmToQueue();
              this.startAudioQueuePlayback();
            }
          } else {
            // Once streaming has started, flush chunks whenever chunk threshold (~1.2s) is reached
            if (this.accumulatedPcmBinary.length >= CHUNK_BUFFER_BYTES) {
              await this.flushBufferedPcmToQueue();
              if (!this.isPlayingQueue) {
                this.playNextAudioSegment();
              } else if (!this.preloadedNextPlayer) {
                this.preloadNextSegment();
              }
            }
          }
        } else if (msg.type === 'turn_complete') {
          if (typeof msg.turnId === 'number' && msg.turnId !== this.currentTurnId) {
            console.log(`[Mobile Audio] Discarding stray turn_complete frame from old turn ${msg.turnId} (current turnId: ${this.currentTurnId})`);
            return;
          }
          const turnCompleteTime = Date.now();
          const latencyToTurnComplete = this.promptSentTime > 0 ? turnCompleteTime - this.promptSentTime : 0;
          console.log(`[Mobile Audio] Turn complete: +${latencyToTurnComplete} ms after prompt sent. Total chunks collected = ${this.receivedChunkCount}`);

          // Ignore stray turn_complete frames from cancelled turns with 0 chunks
          if (this.receivedChunkCount === 0 && !this.hasStartedPlayback) {
            console.log('[Mobile Audio] Ignoring turn_complete frame from cancelled turn (0 chunks collected).');
            return;
          }

          this.isTurnComplete = true;

          // Flush any remaining accumulated PCM bytes to temp WAV file
          if (this.accumulatedPcmBinary.length > 0) {
            await this.flushBufferedPcmToQueue(true);
          }

          // If playback hasn't started yet (e.g. short 1-chunk reply), start it now
          if (!this.hasStartedPlayback) {
            this.startAudioQueuePlayback();
          } else if (!this.isPlayingQueue) {
            this.playNextAudioSegment();
          } else if (!this.preloadedNextPlayer) {
            this.preloadNextSegment();
          }
        } else if (msg.type === 'text') {
          callbacks.onTranscript?.(msg.data);
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
      console.log(`[Mobile WebSocket Closed]: Code ${e.code} - ${e.reason || 'Closed'}`);
      this.isSessionActive = false;
      this.stopSpeechRecognition();
      this.stopAudioPlayback();
      callbacks.onClose(e.reason || e.code);
    };

    this.ws.onerror = (e: any) => {
      console.error('[Mobile WebSocket Error Event]:', e?.message || e);
      callbacks.onError(e?.message || 'Connection error');
    };

    await this.startSpeechRecognition();
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
    this.stopAudioPlayback();
    this.resetTurnState();
    this.lastSentTranscript = '';
    this.callbacks?.onStateChange?.('listening');
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt', turnId: this.currentTurnId }));
    }
    this.restartSpeechRecognition();
  }

  private resetTurnState() {
    this.currentTurnId++;
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }
    if (this.thinkingWatchdogTimer) {
      clearTimeout(this.thinkingWatchdogTimer);
      this.thinkingWatchdogTimer = null;
    }
    this.stopAudioPlayback();
    this.pendingSpeechRestart = false;
    this.promptSentTime = 0;
    this.firstChunkTime = 0;
    this.lastSegmentFinishTime = 0;
    this.currentSegmentPreloadTime = 0;
    this.receivedChunkCount = 0;
    this.accumulatedPcmBinary = '';
    this.audioQueue = [];
    this.hasStartedPlayback = false;
    this.isPlayingQueue = false;
    this.isTurnComplete = false;
    this.hasLoggedPlaybackStart = false;
  }

  private startThinkingWatchdog(timeoutMs = 8000) {
    if (this.thinkingWatchdogTimer) clearTimeout(this.thinkingWatchdogTimer);
    this.thinkingWatchdogTimer = setTimeout(() => {
      if (this.isSessionActive && !this.hasStartedPlayback && !this.isTurnComplete) {
        console.warn(`[Mobile Voice Input] ⚠️ ${Math.round(timeoutMs / 1000)}s Thinking Watchdog Timer fired: Gemini response stalled.`);
        this.promptSentTime = 0;
        this.callbacks?.onStateChange?.('listening');
        this.callbacks?.onNetworkNotice?.('Network response taking longer than usual. Speak again or tap End Call.');
        this.restartSpeechRecognition();
      }
    }, timeoutMs);
  }

  private stopAudioPlayback() {
    if (this.activePlayer || this.preloadedNextPlayer || this.audioQueue.length > 0 || this.isPlayingQueue) {
      console.log('[Mobile Turn Interrupted]: Discarding queued audio and stopping active/preloaded players.');
    }

    const filesToDelete = [...this.audioQueue];
    if (this.activePlayer?.uri) filesToDelete.push(this.activePlayer.uri);
    if (this.preloadedNextPlayer?.uri) filesToDelete.push(this.preloadedNextPlayer.uri);

    for (const uri of filesToDelete) {
      if (uri.startsWith('file://')) {
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
      } catch { }
      this.activePlayer = null;
    }

    if (this.preloadedNextPlayer?.player) {
      try {
        this.preloadedNextPlayer.player.remove();
      } catch { }
      this.preloadedNextPlayer = null;
    }
  }

  private restartSpeechRecognition() {
    if (!this.isSessionActive || this.ws?.readyState !== WebSocket.OPEN) return;
    this.callbacks?.onStateChange?.('listening');
    setTimeout(() => {
      if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && !this.isKidskoSpeaking()) {
        try {
          console.log('[SpeechRec Lifecycle]: Starting fresh speech recognition session...');
          this.startSpeechRecognition();
        } catch (err: any) {
          console.error('[SpeechRec Lifecycle]: Error restarting speech recognition:', err?.message || err);
        }
      }
    }, 300);
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
      // 1. Immediately stop speech recognition while Kidsko thinks and speaks
      this.stopSpeechRecognition();
      this.resetTurnState();
      this.callbacks?.onStateChange?.('thinking');
      this.promptSentTime = Date.now();
      this.startThinkingWatchdog();
      console.log(`[Mobile Voice Input] Finalized spoken turn -> Sending prompt to Gemini Live (turnId=${this.currentTurnId}):`, cleanTranscript);
      this.lastSentTranscript = cleanTranscript;
      this.ws.send(JSON.stringify({ type: 'text_prompt', data: cleanTranscript, turnId: this.currentTurnId }));
    }
  }

  private async startSpeechRecognition() {
    if (!this.isSessionActive || this.isStartingSpeech) return;
    this.isStartingSpeech = true;

    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        console.warn('[SpeechRec Lifecycle]: Permission not granted');
        this.isStartingSpeech = false;
        return;
      }

      this.clearSpeechSubscriptions();

      const subStart = ExpoSpeechRecognitionModule.addListener('start', () => {
        console.log('[SpeechRec Lifecycle]: Started listening for spoken user turns...');
        this.callbacks?.onStateChange?.('listening');
      });

      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const transcript = event.results?.[0]?.transcript || '';
        if (transcript) {
          this.callbacks?.onTranscript?.(transcript);

          // Reset trailing silence debounce timer on every new speech chunk
          if (this.speechSilenceTimer) {
            clearTimeout(this.speechSilenceTimer);
          }

          if (event.isFinal) {
            console.log('[SpeechRec Lifecycle]: Engine delivered final speech segment:', transcript);
            this.finalizeSpokenTurn(transcript);
          } else {
            // Natural silence end-pointing: 850ms silence after speech concludes a turn
            this.speechSilenceTimer = setTimeout(() => {
              console.log('[SpeechRec Lifecycle]: 850ms trailing silence detected -> finalizing spoken turn:', transcript);
              this.finalizeSpokenTurn(transcript);
            }, 850);
          }
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.warn('[SpeechRec Lifecycle]: Recognition error:', event.error, event.message);
        if (this.isSessionActive && !this.isKidskoSpeaking() && this.ws?.readyState === WebSocket.OPEN) {
          console.log('[SpeechRec Lifecycle]: Auto-recovering speech recognition from error...');
          this.restartSpeechRecognition();
        }
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        console.log('[SpeechRec Lifecycle]: Recognition ended.');
        if (this.isSessionActive && !this.isKidskoSpeaking() && this.ws?.readyState === WebSocket.OPEN) {
          console.log('[SpeechRec Lifecycle]: Speech ended while Kidsko not speaking -> restarting...');
          this.restartSpeechRecognition();
        }
      });

      this.speechSubscriptions = [subStart, subResult, subError, subEnd];

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      });

      this.isStartingSpeech = false;
    } catch (err: any) {
      console.error('[SpeechRec Lifecycle]: Exception starting speech recognition:', err?.message || err);
      this.isStartingSpeech = false;
    }
  }

  private clearSpeechSubscriptions() {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }
    for (const sub of this.speechSubscriptions) {
      try {
        sub.remove();
      } catch { }
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
      } catch { }
    }
    forceLoudspeakerAudio().catch(() => {});
  }

  private async flushBufferedPcmToQueue(forceAll = false): Promise<void> {
    while (this.flushingPromise) {
      await this.flushingPromise;
    }
    this.flushingPromise = (async () => {
      try {
        while (this.accumulatedPcmBinary.length > 0) {
          const bytesPerSegment = !this.hasStartedPlayback ? INITIAL_BUFFER_BYTES : CHUNK_BUFFER_BYTES;
          if (!forceAll && this.accumulatedPcmBinary.length < bytesPerSegment) {
            break;
          }

          const pcmSegmentLength = forceAll
            ? this.accumulatedPcmBinary.length
            : Math.min(bytesPerSegment, this.accumulatedPcmBinary.length);

          const pcmSegmentBinary = this.accumulatedPcmBinary.slice(0, pcmSegmentLength);
          this.accumulatedPcmBinary = this.accumulatedPcmBinary.slice(pcmSegmentLength);

          try {
            const filePath = await writePcmSegmentToTempWav(pcmSegmentBinary);
            this.audioQueue.push(filePath);
          } catch (err) {
            console.error('[Mobile Audio] Error saving temp WAV segment:', err);
          }
        }
      } finally {
        this.flushingPromise = null;
      }
    })();
    await this.flushingPromise;
  }

  private startAudioQueuePlayback() {
    if (this.isPlayingQueue) return;
    this.hasStartedPlayback = true;
    this.callbacks?.onStateChange?.('speaking');
    forceLoudspeakerAudio().catch(() => {});
    this.playNextAudioSegment();
  }

  private preloadNextSegment() {
    if (this.preloadedNextPlayer || this.audioQueue.length === 0) return;

    const nextSegmentUri = this.audioQueue.shift()!;
    try {
      console.log('[Mobile Audio Preload]: Pre-creating audio player for:', nextSegmentUri);
      const player = createAudioPlayer({ uri: nextSegmentUri });
      try {
        player.volume = 1.0;
        if (typeof (player as any).setPlaybackRate === 'function') (player as any).setPlaybackRate(1.0);
        else if (typeof (player as any).setRate === 'function') (player as any).setRate(1.0);
        else (player as any).playbackRate = 1.0;
      } catch { }
      this.preloadedNextPlayer = { player, uri: nextSegmentUri };
      this.currentSegmentPreloadTime = Date.now();
    } catch (err) {
      console.error('[Mobile Audio Preload Error]: Could not pre-create audio player:', err);
      this.audioQueue.unshift(nextSegmentUri);
    }
  }

  private playNextAudioSegment() {
    let currentItem: { player: any; uri: string } | null = null;
    const isPreloaded = !!this.preloadedNextPlayer;

    if (isPreloaded) {
      currentItem = this.preloadedNextPlayer;
      this.preloadedNextPlayer = null;
    } else if (this.audioQueue.length > 0) {
      const nextSegmentUri = this.audioQueue.shift()!;
      try {
        console.log('[Mobile Audio Playback]: Creating audio player for:', nextSegmentUri);
        const player = createAudioPlayer({ uri: nextSegmentUri });
        try {
          player.volume = 1.0;
          if (typeof (player as any).setPlaybackRate === 'function') (player as any).setPlaybackRate(1.0);
          else if (typeof (player as any).setRate === 'function') (player as any).setRate(1.0);
          else (player as any).playbackRate = 1.0;
        } catch { }
        currentItem = { player, uri: nextSegmentUri };
      } catch (err) {
        console.error('[Mobile Playback Error]: Exception creating audio player for:', nextSegmentUri, err);
        if (nextSegmentUri.startsWith('file://')) {
          FileSystem.deleteAsync(nextSegmentUri, { idempotent: true }).catch(() => {});
        }
      }
    }

    if (!currentItem || !currentItem.player) {
      this.isPlayingQueue = false;
      if (this.isTurnComplete) {
        const playbackEndTime = Date.now();
        const totalTurnTime = this.promptSentTime > 0 ? playbackEndTime - this.promptSentTime : 0;
        console.log(`[Mobile Audio] Playback finished: +${totalTurnTime} ms after prompt sent. Session remains WAITING FOR NEXT USER TURN.`);
        this.promptSentTime = 0;
        this.lastSentTranscript = '';
        this.callbacks?.onStateChange?.('listening');

        // Trigger speech recognition restart after Kidsko has finished speaking
        this.pendingSpeechRestart = false;
        console.log('[SpeechRec Lifecycle]: Playback finished -> Triggering speech recognition restart for next user turn...');
        this.restartSpeechRecognition();
      } else {
        console.log('[Mobile Audio Stream]: Queue emptied mid-stream, awaiting next audio chunk...');
      }
      return;
    }

    this.isPlayingQueue = true;
    this.callbacks?.onStateChange?.('speaking');

    if (!this.hasLoggedPlaybackStart) {
      this.hasLoggedPlaybackStart = true;
      const playbackStartTime = Date.now();
      const timeToFirstAudio = this.promptSentTime > 0 ? playbackStartTime - this.promptSentTime : 0;
      console.log(`[Mobile Audio] Playback started: +${timeToFirstAudio} ms after prompt sent`);
    }

    const previousItem = this.activePlayer;
    this.activePlayer = currentItem;
    const { player: playerToPlay, uri: playingUri } = currentItem;

    let hasHandledCompletion = false;

    // Safety watchdog: if player fails or never fires finished event within 15 seconds, don't freeze the state
    const safetyTimer = setTimeout(() => {
      if (!hasHandledCompletion && this.activePlayer === currentItem) {
        console.warn('[Mobile Audio Playback] ⚠️ Safety watchdog fired for segment:', playingUri);
        handleCompletion();
      }
    }, 15000);

    const handleCompletion = () => {
      if (hasHandledCompletion) return;
      hasHandledCompletion = true;
      clearTimeout(safetyTimer);

      this.lastSegmentFinishTime = Date.now();
      if (this.activePlayer === currentItem) {
        this.activePlayer = null;
      }

      // Asynchronously delete the temporary WAV file
      if (playingUri && playingUri.startsWith('file://')) {
        FileSystem.deleteAsync(playingUri, { idempotent: true }).catch(() => {});
      }

      // ⚡ Seamless Handoff: Start playing the next preloaded segment IMMEDIATELY
      this.playNextAudioSegment();

      // Asynchronously cleanup native player
      setTimeout(() => {
        try {
          playerToPlay.remove();
        } catch { }
      }, 50);
    };

    playerToPlay.addListener('playbackStatusUpdate', (status: any) => {
      if (status.error) {
        console.error('[Mobile Audio Playback Error Status]:', status.error);
        handleCompletion();
        return;
      }

      if (status.didJustFinish) {
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
        } catch { }
      }, 50);
    }

    // ⚡ Immediately preload the NEXT segment player in background while current segment plays
    this.preloadNextSegment();
  }

  async end() {
    console.log('[Mobile Session End Call]: User manually ending voice session...');
    this.isSessionActive = false;
    this.pendingSpeechRestart = false;
    this.clearSpeechSubscriptions();
    this.stopAudioPlayback();
    if (this.ws) {
      this.ws.close();
    }
  }
}
