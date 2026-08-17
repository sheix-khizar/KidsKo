import { createAudioPlayer } from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { getToken } from './api';
import { WS_URL } from './config';

export type VoiceTurnState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTING'
  | 'ERROR'
  | 'DISCONNECTED';

type VoiceCallbacks = {
  onReady: (capSeconds: number) => void;
  onCapReached: () => void;
  onError: (reason: string) => void;
  onClose: (reason?: string | number) => void;
  onTranscript?: (text: string) => void;
  onSnapshotAck?: (remaining: number) => void;
  onSnapshotError?: (reason: string) => void;
  onStateChange?: (state: VoiceTurnState) => void;
};

// 24000 Hz, 16-bit mono PCM = 48000 bytes/sec
// ~400ms initial buffer = 19200 bytes (~4 chunks) -> preserves fast first-chunk latency (~900ms-1150ms)
const INITIAL_BUFFER_BYTES = 19200;
// ~1200ms chunk buffer = 57600 bytes per queued segment -> drastically reduces segment boundaries
const CHUNK_BUFFER_BYTES = 57600;

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

export class VoiceSession {
  private ws: WebSocket | null = null;
  private activePlayer: any = null;
  private preloadedNextPlayer: any = null;
  private callbacks: VoiceCallbacks | null = null;
  private speechSubscriptions: any[] = [];
  
  // Phase 1: Authoritative State Machine
  private state: VoiceTurnState = 'IDLE';

  // Phase 2 & 12: Turn ID Management
  private currentTurnId = 0;
  private lastSubmittedTranscript = '';
  private lastSubmittedAt = 0;
  private currentPartialTranscript = '';

  // Phase 17 & 18: Language Preference State
  private languagePreference: 'auto' | 'ur' | 'en' = 'auto';

  // Phase 3: Single Speech Recognition Instance Guard
  private isSessionActive = false;
  private isStartingSpeech = false;
  private isRecognitionActive = false;
  private pendingSpeechRestart = false;

  // Streaming Audio Queue State
  private audioQueue: string[] = [];
  private accumulatedPcmBinary = '';
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

  getState(): VoiceTurnState {
    return this.state;
  }

  getCurrentTurnId(): number {
    return this.currentTurnId;
  }

  getLastTranscript(): string {
    return this.lastSubmittedTranscript;
  }

  getLanguagePreference(): string {
    return this.languagePreference;
  }

  private setState(newState: VoiceTurnState) {
    if (this.state === newState) return;
    console.log(`[VoiceTurnState] ${this.state} ➔ ${newState} (Turn #${this.currentTurnId})`);
    this.state = newState;
    this.callbacks?.onStateChange?.(newState);
  }

  private isKidskoSpeaking(): boolean {
    return (
      this.isPlayingQueue ||
      this.audioQueue.length > 0 ||
      this.preloadedNextPlayer !== null ||
      this.activePlayer !== null ||
      (this.hasStartedPlayback && !this.isTurnComplete)
    );
  }

  async start(callbacks: VoiceCallbacks, studentId?: string) {
    const token = await getToken();
    if (!token) {
      callbacks.onError('Not authenticated');
      return;
    }

    this.callbacks = callbacks;
    this.isSessionActive = true;
    this.setState('LISTENING');

    const studentParam = studentId ? `&studentId=${studentId}` : '';
    const socketUrl = `${WS_URL}/ws/voice?token=${token}${studentParam}`;
    console.log('Connecting Voice WebSocket to:', socketUrl);
    this.ws = new WebSocket(socketUrl);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Phase 12: Ignore stale audio/frames from an interrupted previous turn
        if (msg.turnId && msg.turnId !== this.currentTurnId) {
          console.log(`[TURN #${msg.turnId}] Discarding stale WebSocket frame (Active turn = #${this.currentTurnId})`);
          return;
        }

        if (msg.type === 'ready') {
          console.log(`[Mobile WS Ready Frame]: Session cap = ${msg.capSeconds}s`);
          callbacks.onReady(msg.capSeconds);
        } else if (msg.type === 'cap_reached') {
          console.log('[Mobile WS Cap Reached Frame]: Server sent cap_reached signal.');
          this.isSessionActive = false;
          this.setState('DISCONNECTED');
          this.stopSpeechRecognition();
          this.stopAudioPlayback();
          callbacks.onCapReached();
        } else if (msg.type === 'error') {
          console.error('[Mobile WS Error Frame]: Server error =', msg.reason);
          this.setState('ERROR');
          callbacks.onError(msg.reason);
        } else if (msg.type === 'audio') {
          this.receivedChunkCount++;
          if (this.receivedChunkCount === 1) {
            this.firstChunkTime = Date.now();
            const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
            console.log(`[TURN #${this.currentTurnId}] First chunk received: +${latencyToFirstChunk} ms (TTFA)`);
          }
          console.log(`[TURN #${this.currentTurnId}] Inbound Audio Chunk #${this.receivedChunkCount}: base64 len = ${msg.data.length}`);

          // Append incoming chunk to binary PCM accumulator
          this.accumulatedPcmBinary += atob(msg.data);

          // Check if initial buffer threshold (~400ms) reached to start streaming playback
          if (!this.hasStartedPlayback) {
            if (this.accumulatedPcmBinary.length >= INITIAL_BUFFER_BYTES) {
              this.flushBufferedPcmToQueue();
              this.startAudioQueuePlayback();
            }
          } else {
            // Once streaming has started, flush chunks whenever chunk threshold (~1200ms) is reached
            if (this.accumulatedPcmBinary.length >= CHUNK_BUFFER_BYTES) {
              this.flushBufferedPcmToQueue();
              if (!this.isPlayingQueue) {
                this.playNextAudioSegment();
              } else if (!this.preloadedNextPlayer) {
                this.preloadNextSegment();
              }
            }
          }
        } else if (msg.type === 'turn_complete') {
          const turnCompleteTime = Date.now();
          const latencyToTurnComplete = this.promptSentTime > 0 ? turnCompleteTime - this.promptSentTime : 0;
          console.log(`[TURN #${this.currentTurnId}] Turn complete: +${latencyToTurnComplete} ms. Total chunks = ${this.receivedChunkCount}`);

          this.isTurnComplete = true;

          // Flush any remaining accumulated PCM bytes
          if (this.accumulatedPcmBinary.length > 0) {
            this.flushBufferedPcmToQueue(true);
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
      console.log(`[Mobile WebSocket Closed Event]: Code=${e.code}, Reason="${e.reason || 'None'}"`);
      this.isSessionActive = false;
      this.setState('DISCONNECTED');
      this.stopSpeechRecognition();
      this.stopAudioPlayback();
      callbacks.onClose(e.reason || e.code);
    };

    this.ws.onerror = (e: any) => {
      console.error('[Mobile WebSocket Error Event]:', e?.message || e);
      this.setState('ERROR');
      callbacks.onError(e?.message || 'Connection error');
    };

    await this.startSpeechRecognition();
  }

  // Phase 8: Authoritative Gateway Function for Submitting User Turns
  private submitUserTurn(rawTranscript: string) {
    const normalized = rawTranscript.trim().replace(/\s+/g, ' ');
    if (!normalized) return;

    const now = Date.now();
    // Phase 7: Final Transcript Deduplication (2000ms guard)
    if (normalized === this.lastSubmittedTranscript && (now - this.lastSubmittedAt) < 2000) {
      console.log(`[VoiceTurnManager] Deduplicating identical final transcript: "${normalized}"`);
      return;
    }

    if (this.ws?.readyState !== WebSocket.OPEN) return;

    // Phase 2: Increment Turn ID
    this.currentTurnId++;
    const turnId = this.currentTurnId;
    this.setState('THINKING');

    this.lastSubmittedTranscript = normalized;
    this.lastSubmittedAt = now;
    this.currentPartialTranscript = '';

    // Phase 17/18: Language Preference Auto-Detection
    this.detectLanguagePreference(normalized);

    console.log(`[TURN #${turnId}] USER_FINAL: "${normalized}" (Language = ${this.languagePreference})`);
    this.promptSentTime = Date.now();
    this.firstChunkTime = 0;

    this.ws.send(JSON.stringify({
      type: 'text_prompt',
      data: normalized,
      turnId: turnId,
      language: this.languagePreference,
    }));
  }

  // Phase 17 & 18: Language Preference Auto-Detection & Persistence
  private detectLanguagePreference(transcript: string) {
    const lower = transcript.toLowerCase();
    if (lower.includes('urdu mein') || lower.includes('urdu mai') || lower.includes('speak urdu') || lower.includes('talk in urdu')) {
      this.languagePreference = 'ur';
      console.log('[VoiceTurnManager] Language preference updated to URDU');
    } else if (lower.includes('english mein') || lower.includes('english mai') || lower.includes('speak english') || lower.includes('talk in english')) {
      this.languagePreference = 'en';
      console.log('[VoiceTurnManager] Language preference updated to ENGLISH');
    }
  }

  sendImageCapture(base64Jpeg: string, caption?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.currentTurnId++;
      const turnId = this.currentTurnId;
      console.log(`[TURN #${turnId}] IMAGE_CAPTURE: ${base64Jpeg.length} base64 chars, caption: "${caption || '(none)'}"`);
      this.resetTurnState();
      this.promptSentTime = Date.now();
      this.setState('THINKING');

      this.ws.send(JSON.stringify({
        type: 'image_capture',
        data: base64Jpeg,
        caption: caption,
        turnId: turnId,
        language: this.languagePreference,
      }));
    }
  }

  private resetTurnState() {
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

  private stopAudioPlayback() {
    if (this.activePlayer || this.preloadedNextPlayer || this.audioQueue.length > 0 || this.isPlayingQueue) {
      console.log(`[TURN #${this.currentTurnId}] DISCARDING_AUDIO: Stopping active & preloaded players.`);
    }
    this.audioQueue = [];
    this.accumulatedPcmBinary = '';
    this.hasStartedPlayback = false;
    this.isPlayingQueue = false;
    this.lastSegmentFinishTime = 0;
    this.currentSegmentPreloadTime = 0;

    if (this.activePlayer) {
      try {
        this.activePlayer.remove();
      } catch {}
      this.activePlayer = null;
    }

    if (this.preloadedNextPlayer) {
      try {
        this.preloadedNextPlayer.remove();
      } catch {}
      this.preloadedNextPlayer = null;
    }
  }

  private restartSpeechRecognition() {
    if (!this.isSessionActive || this.ws?.readyState !== WebSocket.OPEN) return;
    setTimeout(() => {
      if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && !this.isKidskoSpeaking()) {
        try {
          console.log('[SpeechRec Lifecycle]: Started listening for spoken user turns...');
          this.setState('LISTENING');
          ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
        } catch (err: any) {
          console.error('[SpeechRec Lifecycle]: Error restarting speech recognition:', err?.message || err);
        }
      }
    }, 300);
  }

  private async startSpeechRecognition() {
    if (!this.isSessionActive || this.isStartingSpeech || this.isRecognitionActive) return;
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
        this.isRecognitionActive = true;
        this.setState('LISTENING');
      });

      // Phase 4: Separate Partial vs. Final Transcript
      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const resultObj = event.results?.[0];
        const transcript = resultObj?.transcript?.trim();
        const isFinal = event.isFinal || resultObj?.isFinal || false;

        if (transcript && transcript.length > 0) {
          this.currentPartialTranscript = transcript;
          this.callbacks?.onTranscript?.(transcript);

          // Phase 9: Barge-In Interrupt Trigger
          if (this.isKidskoSpeaking()) {
            console.log(`[TURN #${this.currentTurnId}] INTERRUPTED_BY_USER! Stopping audio & resetting turn state.`);
            this.setState('INTERRUPTING');
            this.resetTurnState();
          }

          // ONLY submit user turn when FINAL transcript is emitted by speech recognition engine
          if (isFinal) {
            console.log(`[SpeechRec Lifecycle] Final transcript detected: "${transcript}"`);
            this.submitUserTurn(transcript);
          }
        }
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        console.log('[SpeechRec Lifecycle]: Recognition cycle ended natively.');
        this.isRecognitionActive = false;

        // Finalize any pending partial transcript on utterance end
        if (this.currentPartialTranscript && this.currentPartialTranscript !== this.lastSubmittedTranscript) {
          console.log(`[SpeechRec Lifecycle] Finalizing pending partial transcript on end: "${this.currentPartialTranscript}"`);
          this.submitUserTurn(this.currentPartialTranscript);
        }

        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
          if (this.isKidskoSpeaking()) {
            console.log('[SpeechRec Lifecycle]: Kidsko is still speaking -> Deferring speech recognition restart until playback finishes.');
            this.pendingSpeechRestart = true;
          } else {
            console.log('[SpeechRec Lifecycle]: Kidsko is not speaking -> Auto-restarting speech recognition for next user turn...');
            this.restartSpeechRecognition();
          }
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.error('[SpeechRec Lifecycle]: Error event =', event.error, event.message);
        this.isRecognitionActive = false;
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && event.error !== 'no-match') {
          if (this.isKidskoSpeaking()) {
            console.log('[SpeechRec Lifecycle]: Error event during playback -> Deferring speech recognition restart.');
            this.pendingSpeechRestart = true;
          } else {
            this.restartSpeechRecognition();
          }
        }
      });

      this.speechSubscriptions = [subStart, subResult, subEnd, subError];

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      });
    } catch (err: any) {
      console.error('[SpeechRec Lifecycle]: Start exception =', err?.message || err);
      this.isRecognitionActive = false;
    } finally {
      this.isStartingSpeech = false;
    }
  }

  private clearSpeechSubscriptions() {
    for (const sub of this.speechSubscriptions) {
      try {
        sub.remove();
      } catch {}
    }
    this.speechSubscriptions = [];
    this.isRecognitionActive = false;
  }

  private stopSpeechRecognition() {
    console.log('[SpeechRec Lifecycle]: Stopping speech recognition and cleaning listeners...');
    this.clearSpeechSubscriptions();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
  }

  private flushBufferedPcmToQueue(forceAll = false) {
    if (this.accumulatedPcmBinary.length === 0) return;

    let bytesPerSegment = CHUNK_BUFFER_BYTES;
    if (!this.hasStartedPlayback) {
      bytesPerSegment = INITIAL_BUFFER_BYTES;
    }

    while (this.accumulatedPcmBinary.length > 0) {
      if (!forceAll && this.accumulatedPcmBinary.length < bytesPerSegment) {
        break; // Keep partial buffer until more chunks arrive or turn completes
      }

      const pcmSegmentLength = forceAll
        ? this.accumulatedPcmBinary.length
        : Math.min(bytesPerSegment, this.accumulatedPcmBinary.length);

      const pcmSegmentBinary = this.accumulatedPcmBinary.slice(0, pcmSegmentLength);
      this.accumulatedPcmBinary = this.accumulatedPcmBinary.slice(pcmSegmentLength);

      const t0 = Date.now();
      const wavBase64 = createWavBase64(pcmSegmentBinary);
      const t1 = Date.now();
      console.log(`[Mobile Audio Overhead]: createWavBase64 took ${t1 - t0} ms for ${pcmSegmentLength} bytes PCM.`);

      this.audioQueue.push(`data:audio/wav;base64,${wavBase64}`);
    }
  }

  private startAudioQueuePlayback() {
    if (this.isPlayingQueue) return;
    this.hasStartedPlayback = true;
    this.setState('SPEAKING');
    this.playNextAudioSegment();
  }

  private preloadNextSegment() {
    if (this.preloadedNextPlayer || this.audioQueue.length === 0) return;

    const nextSegmentUri = this.audioQueue.shift()!;
    const t0 = Date.now();
    try {
      console.log(`[Mobile Audio Preload]: Pre-creating background audio player for next segment (${nextSegmentUri.length} chars URI)...`);
      this.preloadedNextPlayer = createAudioPlayer({ uri: nextSegmentUri });
      const t1 = Date.now();
      this.currentSegmentPreloadTime = t1;
      console.log(`[Mobile Audio Overhead]: Preload createAudioPlayer took ${t1 - t0} ms.`);
    } catch (err) {
      console.error('[Mobile Audio Preload Error]: Could not pre-create audio player:', err);
      this.audioQueue.unshift(nextSegmentUri);
    }
  }

  private playNextAudioSegment() {
    const segmentStartTime = Date.now();

    if (this.lastSegmentFinishTime > 0) {
      const handoffGap = segmentStartTime - this.lastSegmentFinishTime;
      console.log(`[Mobile Audio Gap]: Handoff gap between segments = ${handoffGap} ms`);
    }

    let playerToPlay: any = null;
    const isPreloaded = !!this.preloadedNextPlayer;

    if (isPreloaded) {
      playerToPlay = this.preloadedNextPlayer;
      this.preloadedNextPlayer = null;
      const leadTime = this.currentSegmentPreloadTime > 0 ? segmentStartTime - this.currentSegmentPreloadTime : 0;
      console.log(`[Mobile Audio Preload Race]: Preloaded player WIN (Ready ${leadTime} ms before handoff). Utilizing for zero-gap playback.`);
    } else if (this.audioQueue.length > 0) {
      console.log('[Mobile Audio Preload Race]: Preload MISS (Queue was empty at preload time). Creating player on-demand...');
      const nextSegmentUri = this.audioQueue.shift()!;
      const t0 = Date.now();
      try {
        playerToPlay = createAudioPlayer({ uri: nextSegmentUri });
      } catch (err) {
        console.error('[Mobile Playback Error]: Exception playing WAV segment:', err);
      }
      const t1 = Date.now();
      console.log(`[Mobile Audio Overhead]: On-demand createAudioPlayer took ${t1 - t0} ms.`);
    }

    if (!playerToPlay) {
      this.isPlayingQueue = false;
      if (this.isTurnComplete) {
        const playbackEndTime = Date.now();
        const totalTurnTime = this.promptSentTime > 0 ? playbackEndTime - this.promptSentTime : 0;
        console.log(`[TURN #${this.currentTurnId}] AUDIO_RESPONSE_COMPLETE: Finished in +${totalTurnTime} ms. Session WAITING FOR NEXT USER TURN.`);
        this.setState('LISTENING');

        // Trigger deferred speech recognition restart after Kidsko has finished speaking
        if (this.pendingSpeechRestart || (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN)) {
          this.pendingSpeechRestart = false;
          console.log('[SpeechRec Lifecycle]: Playback finished -> Triggering speech recognition restart for next user turn...');
          this.restartSpeechRecognition();
        }
      } else {
        console.log('[Mobile Audio Stream]: Queue emptied mid-stream, awaiting next audio chunk...');
      }
      return;
    }

    this.isPlayingQueue = true;
    this.setState('SPEAKING');

    if (!this.hasLoggedPlaybackStart) {
      this.hasLoggedPlaybackStart = true;
      const playbackStartTime = Date.now();
      const timeToFirstAudio = this.promptSentTime > 0 ? playbackStartTime - this.promptSentTime : 0;
      console.log(`[TURN #${this.currentTurnId}] AUDIO_PLAYBACK_START: +${timeToFirstAudio} ms after prompt sent (TTFA = ${timeToFirstAudio} ms)`);
    }

    // Clean up previous active player before starting next segment
    if (this.activePlayer && this.activePlayer !== playerToPlay) {
      try {
        this.activePlayer.remove();
      } catch {}
      this.activePlayer = null;
    }

    this.activePlayer = playerToPlay;

    playerToPlay.addListener('playbackStatusUpdate', (status: any) => {
      if (status.didJustFinish) {
        this.lastSegmentFinishTime = Date.now();
        try {
          playerToPlay.remove();
        } catch {}
        if (this.activePlayer === playerToPlay) {
          this.activePlayer = null;
        }
        this.playNextAudioSegment();
      }
    });

    playerToPlay.play();

    // ⚡ Immediately preload the NEXT segment player in background while current segment plays
    this.preloadNextSegment();
  }

  async end() {
    console.log('[Mobile Session End Call]: User manually ending voice session...');
    this.isSessionActive = false;
    this.pendingSpeechRestart = false;
    this.setState('DISCONNECTED');
    this.stopSpeechRecognition();
    this.stopAudioPlayback();
    if (this.ws) {
      this.ws.close();
    }
  }
}
