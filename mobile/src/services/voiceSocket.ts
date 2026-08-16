import { createAudioPlayer } from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';
import { getToken } from './api';
import { WS_URL } from './config';

type VoiceCallbacks = {
  onReady: (capSeconds: number) => void;
  onCapReached: () => void;
  onError: (reason: string) => void;
  onClose: (reason?: string | number) => void;
  onTranscript?: (text: string) => void;
  onSnapshotAck?: (remaining: number) => void;
  onSnapshotError?: (reason: string) => void;
};

// 24000 Hz, 16-bit mono PCM = 48000 bytes/sec
// ~400ms initial buffer = 19200 bytes (~4 chunks) -> preserves fast first-chunk latency (~900ms-1150ms)
const INITIAL_BUFFER_BYTES = 19200;
// ~1200ms chunk buffer = 57600 bytes per queued segment -> drastically reduces segment boundaries
const CHUNK_BUFFER_BYTES = 57600;

// ~300ms adaptive utterance debounce to convert progressive speech recognition updates into ONE Gemini turn
const SPEECH_SEND_DEBOUNCE_MS = 300;

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
  private lastSentTranscript = '';
  private isSessionActive = false;
  private isStartingSpeech = false;
  private speechSessionConfigured = false;

  // Utterance Stabilization & Debounce State
  private pendingTranscript = '';
  private transcriptDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private speechCycleId = 0;

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

  getLastTranscript(): string {
    return this.lastSentTranscript;
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

  private clearPendingDebounce() {
    if (this.transcriptDebounceTimer) {
      clearTimeout(this.transcriptDebounceTimer);
      this.transcriptDebounceTimer = null;
    }
    this.pendingTranscript = '';
  }

  private commitPendingTranscript(cycleId: number) {
    if (cycleId !== this.speechCycleId) {
      console.log(`[SpeechRec #${cycleId}] Ignoring stale commit attempt (current cycle #${this.speechCycleId}).`);
      return;
    }

    const transcript = this.pendingTranscript.trim();
    this.pendingTranscript = '';

    if (this.transcriptDebounceTimer) {
      clearTimeout(this.transcriptDebounceTimer);
      this.transcriptDebounceTimer = null;
    }

    if (!transcript || transcript.length === 0) return;

    if (transcript === this.lastSentTranscript) {
      console.log(`[SpeechRec #${cycleId}] Suppressing duplicate transcript for turn: "${transcript}"`);
      return;
    }

    if (!this.isSessionActive || this.ws?.readyState !== WebSocket.OPEN) {
      console.warn(`[SpeechRec #${cycleId}] Cannot send transcript: WebSocket not open.`);
      return;
    }

    this.resetTurnState();
    this.promptSentTime = Date.now();
    this.lastSentTranscript = transcript;

    console.log(`[SpeechRec #${cycleId}] Candidate stabilized: "${transcript}"`);
    console.log(`[SpeechRec #${cycleId}] Sending ONE Gemini turn: "${transcript}"`);
    this.ws.send(JSON.stringify({ type: 'text_prompt', data: transcript }));
    this.callbacks?.onTranscript?.(transcript);
  }

  async start(callbacks: VoiceCallbacks, studentId?: string) {
    const token = await getToken();
    if (!token) {
      callbacks.onError('Not authenticated');
      return;
    }

    this.callbacks = callbacks;
    this.isSessionActive = true;
    const studentParam = studentId ? `&studentId=${studentId}` : '';
    const socketUrl = `${WS_URL}/ws/voice?token=${token}${studentParam}`;
    console.log('Connecting Voice WebSocket to:', socketUrl);
    this.ws = new WebSocket(socketUrl);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ready') {
          console.log(`[Mobile WS Ready Frame]: Session cap = ${msg.capSeconds}s`);
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
          this.receivedChunkCount++;
          if (this.receivedChunkCount === 1) {
            this.firstChunkTime = Date.now();
            const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
            console.log(`[Mobile Audio] First chunk received: +${latencyToFirstChunk} ms after prompt sent`);
          }
          console.log(`[Mobile Inbound Audio Chunk #${this.receivedChunkCount}]: base64 len = ${msg.data.length}`);

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
          console.log(`[Mobile Audio] Turn complete: +${latencyToTurnComplete} ms after prompt sent. Total chunks collected = ${this.receivedChunkCount}`);

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
      this.resetTurnState();
      this.promptSentTime = Date.now();
      this.ws.send(JSON.stringify({ type: 'image_capture', data: base64Jpeg, caption }));
    }
  }

  private resetTurnState() {
    this.clearPendingDebounce();
    this.stopAudioPlayback();
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
      console.log('[Mobile Turn Interrupted]: Discarding queued audio and stopping active/preloaded players.');
    }
    this.clearPendingDebounce();
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
    this.speechCycleId++;
    setTimeout(() => {
      if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
        try {
          console.log(`[SpeechRec #${this.speechCycleId}] [${new Date().toISOString()}]: Restarting continuous speech recognition (interimResults: true)...`);
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            continuous: true,
          });
        } catch (err: any) {
          console.error('[SpeechRec Lifecycle]: Error restarting speech recognition:', err?.message || err);
        }
      }
    }, 300);
  }

  private async startSpeechRecognition() {
    if (!this.isSessionActive || this.isStartingSpeech) return;
    this.isStartingSpeech = true;
    this.speechCycleId++;

    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        console.warn('[SpeechRec Lifecycle]: Permission not granted');
        this.isStartingSpeech = false;
        return;
      }

      this.clearSpeechSubscriptions();

      const subStart = ExpoSpeechRecognitionModule.addListener('start', () => {
        console.log(`[SpeechRec #${this.speechCycleId}] [${new Date().toISOString()}]: Started listening for spoken user turns...`);
      });

      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const rawTranscript = event.results?.[0]?.transcript?.trim();
        if (!rawTranscript || rawTranscript.length === 0) return;

        const normalized = rawTranscript.replace(/\s+/g, ' ').trim();
        if (normalized === this.lastSentTranscript) return;

        const currentCycleId = this.speechCycleId;

        // ⚡ IMMEDIATE BARGE-IN DETECTION: If Kidsko is speaking, stop AI playback instantly!
        if (this.isKidskoSpeaking()) {
          console.log(`[Mobile Barge-In] Speech detected while Kidsko is speaking ("${normalized}").`);
          console.log(`[Mobile Barge-In] Stopping Kidsko playback immediately`);
          this.stopAudioPlayback();
        }

        console.log(`[SpeechRec #${currentCycleId}] Candidate updated: "${normalized}"`);
        console.log(`[SpeechRec #${currentCycleId}] Debounce reset: ${SPEECH_SEND_DEBOUNCE_MS}ms`);
        this.pendingTranscript = normalized;

        if (this.transcriptDebounceTimer) {
          clearTimeout(this.transcriptDebounceTimer);
          this.transcriptDebounceTimer = null;
        }

        this.transcriptDebounceTimer = setTimeout(() => {
          this.commitPendingTranscript(currentCycleId);
        }, SPEECH_SEND_DEBOUNCE_MS);
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        console.log(`[SpeechRec #${this.speechCycleId}] [${new Date().toISOString()}]: Recognition cycle ended natively.`);
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
          console.log('[SpeechRec Lifecycle]: Auto-restarting continuous speech recognition for next user turn...');
          this.restartSpeechRecognition();
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.log('[SpeechRec Lifecycle]: Error event =', event.error, event.message);
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && event.error !== 'no-match') {
          this.restartSpeechRecognition();
        }
      });

      this.speechSubscriptions = [subStart, subResult, subEnd, subError];

      const initialOptions: any = {
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      };

      if (Platform.OS === 'ios') {
        initialOptions.iosCategory = {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'],
          mode: 'voiceChat',
        };
        initialOptions.iosVoiceProcessingEnabled = true;
        console.log('[Mobile Audio Session]: AEC & VoiceProcessing enabled = true (iOS)');
      } else {
        console.log('[Mobile Audio Session]: AEC not available via speech rec module (Android)');
      }

      console.log(`[SpeechRec #${this.speechCycleId}] [${new Date().toISOString()}]: Initializing speech session (interimResults: true)...`);
      ExpoSpeechRecognitionModule.start(initialOptions);
      this.speechSessionConfigured = true;
    } catch (err: any) {
      console.error('[SpeechRec Lifecycle]: Start exception =', err?.message || err);
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
  }

  private stopSpeechRecognition() {
    console.log('[SpeechRec Lifecycle]: Stopping speech recognition and cleaning listeners...');
    this.clearPendingDebounce();
    this.clearSpeechSubscriptions();
    this.speechSessionConfigured = false;
    this.speechCycleId++;
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
        console.log(`[Mobile Audio] Playback finished: +${totalTurnTime} ms after prompt sent. Session remains WAITING FOR NEXT USER TURN.`);
      } else {
        console.log('[Mobile Audio Stream]: Queue emptied mid-stream, awaiting next audio chunk...');
      }
      return;
    }

    this.isPlayingQueue = true;

    if (!this.hasLoggedPlaybackStart) {
      this.hasLoggedPlaybackStart = true;
      const playbackStartTime = Date.now();
      const timeToFirstAudio = this.promptSentTime > 0 ? playbackStartTime - this.promptSentTime : 0;
      console.log(`[Mobile Audio] Playback started: +${timeToFirstAudio} ms after prompt sent`);
      console.log(`[Mobile Audio] Time to first audio: ${timeToFirstAudio} ms`);
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
    this.clearPendingDebounce();
    this.speechSessionConfigured = false;
    this.speechCycleId++;
    this.stopSpeechRecognition();
    this.stopAudioPlayback();
    if (this.ws) {
      this.ws.close();
    }
  }
}
