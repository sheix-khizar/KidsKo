import { createAudioPlayer } from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
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
  onStateChange?: (state: 'listening' | 'thinking' | 'speaking') => void;
};

// 24000 Hz, 16-bit mono PCM = 48000 bytes/sec
// ~400ms initial buffer = 19200 bytes (~4 chunks) -> ultra-fast first-chunk playback latency (~700ms-800ms)
const INITIAL_BUFFER_BYTES = 19200;

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
  private speechSilenceTimer: any = null;
  private currentTurnId = 0;

  // Streaming Audio State (Fast 2-Segment Architecture)
  private audioQueue: string[] = [];
  private accumulatedPcmBinary = '';
  private hasStartedPlayback = false;
  private isPlayingQueue = false;
  private receivedChunkCount = 0;
  private isTurnComplete = false;

  // Diagnostic Timers
  private promptSentTime = 0;
  private firstChunkTime = 0;

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
          this.receivedChunkCount++;
          if (this.receivedChunkCount === 1) {
            this.firstChunkTime = Date.now();
            const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
            console.log(`[Mobile Audio] 🚀 First chunk received: +${latencyToFirstChunk} ms after prompt sent`);
          }

          // Accumulate incoming 24kHz PCM binary chunks
          this.accumulatedPcmBinary += atob(msg.data);

          // ⚡ FAST FIRST-CHUNK PLAYBACK: Start playing intro segment as soon as ~400ms buffer is collected (~750ms total latency!)
          if (!this.hasStartedPlayback && this.accumulatedPcmBinary.length >= INITIAL_BUFFER_BYTES) {
            this.flushPcmSegmentToQueue(INITIAL_BUFFER_BYTES);
            this.startAudioQueuePlayback();
          }
        } else if (msg.type === 'turn_complete') {
          const turnCompleteTime = Date.now();
          const latencyToTurnComplete = this.promptSentTime > 0 ? turnCompleteTime - this.promptSentTime : 0;
          console.log(`[Mobile Audio] Turn complete: +${latencyToTurnComplete} ms after prompt sent. Total chunks collected = ${this.receivedChunkCount}`);

          if (this.receivedChunkCount === 0) {
            console.log('[Mobile Audio] Ignoring turn_complete frame from cancelled turn (0 chunks collected).');
            return;
          }

          this.isTurnComplete = true;

          // 🔊 Flush ALL remaining PCM bytes as Segment 2 (the entire rest of turn audio)
          if (this.accumulatedPcmBinary.length > 0) {
            this.flushPcmSegmentToQueue(this.accumulatedPcmBinary.length);
          }

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
      this.callbacks?.onStateChange?.('thinking');
      this.promptSentTime = Date.now();
      this.ws.send(JSON.stringify({ type: 'image_capture', data: base64Jpeg, caption }));
    }
  }

  private resetTurnState() {
    this.currentTurnId++;
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }
    this.stopAudioPlayback();
    this.promptSentTime = 0;
    this.firstChunkTime = 0;
    this.receivedChunkCount = 0;
    this.accumulatedPcmBinary = '';
    this.audioQueue = [];
    this.hasStartedPlayback = false;
    this.isPlayingQueue = false;
    this.isTurnComplete = false;
  }

  private stopAudioPlayback() {
    if (this.activePlayer || this.preloadedNextPlayer || this.audioQueue.length > 0 || this.isPlayingQueue) {
      console.log('[Mobile Turn Interrupted]: Discarding queued audio and stopping active/preloaded players.');
    }
    this.audioQueue = [];
    this.accumulatedPcmBinary = '';
    this.hasStartedPlayback = false;
    this.isPlayingQueue = false;

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
      if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
        try {
          console.log('[SpeechRec Lifecycle]: Started listening for spoken user turns...');
          ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
        } catch (err: any) {
          console.error('[SpeechRec Lifecycle]: Error restarting speech recognition:', err?.message || err);
        }
      }
    }, 200);
  }

  private finalizeSpokenTurn(transcript: string) {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }

    if (transcript && transcript.length > 0 && transcript !== this.lastSentTranscript && this.ws?.readyState === WebSocket.OPEN) {
      this.resetTurnState();
      this.callbacks?.onStateChange?.('thinking');
      this.promptSentTime = Date.now();
      console.log('[Mobile Voice Input] Finalized spoken turn -> Sending prompt to Gemini Live:', transcript);
      this.lastSentTranscript = transcript;
      this.ws.send(JSON.stringify({ type: 'text_prompt', data: transcript }));
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
      });

      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const transcript = event.results?.[0]?.transcript?.trim();
        const isFinal = event.isFinal || event.results?.[0]?.isFinal;

        if (transcript && transcript.length > 0) {
          // ⚡ REAL-TIME BARGE-IN: If student speaks while Kidsko is talking, stop Kidsko immediately and switch state to 'listening'
          if (this.isKidskoSpeaking()) {
            console.log('[SpeechRec Lifecycle] ⚡ User interruption detected! Stopping Kidsko playback immediately & switching to listening state:', transcript);
            this.stopAudioPlayback();
            this.callbacks?.onStateChange?.('listening');
          }

          // Real-time live transcript streaming to UI screen
          this.callbacks?.onTranscript?.(transcript);

          if (isFinal) {
            this.finalizeSpokenTurn(transcript);
          } else {
            // 🚀 Fast 0.8s (800ms) silence pause timer: Finalizes turn in 800ms after child stops talking
            if (this.speechSilenceTimer) clearTimeout(this.speechSilenceTimer);
            this.speechSilenceTimer = setTimeout(() => {
              console.log('[Mobile Voice Input] 0.8s child pause detected -> Finalizing spoken turn:', transcript);
              this.finalizeSpokenTurn(transcript);
            }, 800);
          }
        }
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        console.log('[SpeechRec Lifecycle]: Recognition cycle ended natively. Auto-restarting for continuous listening...');
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
          this.restartSpeechRecognition();
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.error('[SpeechRec Lifecycle]: Error event =', event.error, event.message);
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && event.error !== 'no-match') {
          this.restartSpeechRecognition();
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
    } finally {
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
      } catch {}
    }
    this.speechSubscriptions = [];
  }

  private stopSpeechRecognition() {
    console.log('[SpeechRec Lifecycle]: Stopping speech recognition and cleaning listeners...');
    this.clearSpeechSubscriptions();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
  }

  private flushPcmSegmentToQueue(byteCount: number) {
    if (this.accumulatedPcmBinary.length === 0 || byteCount <= 0) return;

    const lengthToSlice = Math.min(byteCount, this.accumulatedPcmBinary.length);
    const pcmSegmentBinary = this.accumulatedPcmBinary.slice(0, lengthToSlice);
    this.accumulatedPcmBinary = this.accumulatedPcmBinary.slice(lengthToSlice);

    const wavBase64 = createWavBase64(pcmSegmentBinary);
    this.audioQueue.push(`data:audio/wav;base64,${wavBase64}`);
  }

  private startAudioQueuePlayback() {
    if (this.isPlayingQueue) return;
    this.hasStartedPlayback = true;
    this.callbacks?.onStateChange?.('speaking');
    this.playNextAudioSegment();
  }

  private preloadNextSegment() {
    if (this.preloadedNextPlayer || this.audioQueue.length === 0) return;

    const nextSegmentUri = this.audioQueue.shift()!;
    try {
      const player = createAudioPlayer({ uri: nextSegmentUri });
      try {
        if (typeof (player as any).setPlaybackRate === 'function') (player as any).setPlaybackRate(1.15);
        else if (typeof (player as any).setRate === 'function') (player as any).setRate(1.15);
        else (player as any).playbackRate = 1.15;
      } catch {}
      this.preloadedNextPlayer = player;
    } catch (err) {
      console.error('[Mobile Audio Preload Error]: Could not pre-create audio player:', err);
      this.audioQueue.unshift(nextSegmentUri);
    }
  }

  private playNextAudioSegment() {
    let playerToPlay: any = null;
    const isPreloaded = !!this.preloadedNextPlayer;

    if (isPreloaded) {
      playerToPlay = this.preloadedNextPlayer;
      this.preloadedNextPlayer = null;
    } else if (this.audioQueue.length > 0) {
      const nextSegmentUri = this.audioQueue.shift()!;
      try {
        playerToPlay = createAudioPlayer({ uri: nextSegmentUri });
        try {
          if (typeof (playerToPlay as any).setPlaybackRate === 'function') (playerToPlay as any).setPlaybackRate(1.15);
          else if (typeof (playerToPlay as any).setRate === 'function') (playerToPlay as any).setRate(1.15);
          else (playerToPlay as any).playbackRate = 1.15;
        } catch {}
      } catch (err) {
        console.error('[Mobile Playback Error]: Exception playing WAV segment:', err);
      }
    }

    if (!playerToPlay) {
      this.isPlayingQueue = false;
      if (this.isTurnComplete) {
        const playbackEndTime = Date.now();
        const totalTurnTime = this.promptSentTime > 0 ? playbackEndTime - this.promptSentTime : 0;
        console.log(`[Mobile Audio] 🔊 Turn Playback finished natively (+${totalTurnTime} ms total). Session WAITING FOR NEXT USER TURN.`);
        this.callbacks?.onStateChange?.('listening');
      } else {
        console.log('[Mobile Audio Stream]: Queue emptied mid-stream, awaiting remaining audio chunk...');
      }
      return;
    }

    this.isPlayingQueue = true;
    this.callbacks?.onStateChange?.('speaking');

    const playbackStartTime = Date.now();
    const timeToFirstAudio = this.promptSentTime > 0 ? playbackStartTime - this.promptSentTime : 0;
    console.log(`[Mobile Audio] 🔊 Playback started segment: +${timeToFirstAudio} ms after prompt sent`);

    const previousPlayer = this.activePlayer;
    this.activePlayer = playerToPlay;

    playerToPlay.addListener('playbackStatusUpdate', (status: any) => {
      if (status.didJustFinish) {
        const finishedPlayer = playerToPlay;
        if (this.activePlayer === finishedPlayer) {
          this.activePlayer = null;
        }

        // ⚡ Zero-gap handoff to preloaded segment
        this.playNextAudioSegment();

        setTimeout(() => {
          try {
            finishedPlayer.remove();
          } catch {}
        }, 50);
      }
    });

    playerToPlay.play();

    if (previousPlayer && previousPlayer !== playerToPlay) {
      setTimeout(() => {
        try {
          previousPlayer.remove();
        } catch {}
      }, 50);
    }

    // ⚡ Preload NEXT segment in background while current segment plays
    this.preloadNextSegment();
  }

  async end() {
    console.log('[Mobile Session End Call]: User manually ending voice session...');
    this.isSessionActive = false;
    this.clearSpeechSubscriptions();
    this.stopAudioPlayback();
    if (this.ws) {
      this.ws.close();
    }
  }
}
