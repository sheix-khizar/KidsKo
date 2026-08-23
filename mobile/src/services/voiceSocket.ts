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
// Initial launch segment = ~100ms (4,800 bytes) -> Starts audio playback instantly on Chunk #1/#2 in ~700ms-800ms
const LAUNCH_SEGMENT_BYTES = 4800;

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
  private isRestartingSpeech = false;
  private speechSilenceTimer: any = null;
  private currentTurnId = 0;

  // Decoupled Mic & Session Ready Flags
  private isMicActive = false;
  private isSessionReady = false;

  // Turn Flight & Deduplication State
  private isTurnInFlight = false;
  private pendingInitialPrompt: string | null = null;
  private voiceState: 'listening' | 'thinking' | 'speaking' | null = null;

  // Hybrid Audio Queue State
  private audioQueue: string[] = [];
  private accumulatedPcmBinary = '';
  private hasStartedPlayback = false;
  private isPlayingQueue = false;
  private receivedChunkCount = 0;
  private isTurnComplete = false;

  // Fine-grained Lifecycle Diagnostic Timers
  private sessionStartTime = 0;
  private wsOpenTime = 0;
  private wsReadyTime = 0;
  private promptSentTime = 0;
  private firstChunkTime = 0;

  getLastTranscript(): string {
    return this.lastSentTranscript;
  }

  private updateState(newState: 'listening' | 'thinking' | 'speaking') {
    if (this.voiceState !== newState) {
      console.log(`[VoiceSession State Transition]: ${this.voiceState || 'none'} -> ${newState}`);
      this.voiceState = newState;
      this.callbacks?.onStateChange?.(newState);
    }
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
    this.sessionStartTime = Date.now();
    console.log(`[Voice Lifecycle]: Session start initiated at ${new Date(this.sessionStartTime).toISOString()}`);

    const token = await getToken();
    if (!token) {
      callbacks.onError('Not authenticated');
      return;
    }

    this.callbacks = callbacks;
    this.isSessionActive = true;
    const studentParam = studentId ? `&studentId=${studentId}` : '';
    const socketUrl = `${WS_URL}/ws/voice?token=${token}${studentParam}`;

    console.log(`[Voice Lifecycle]: ⚡ Parallel initiation -> Opening WebSocket & starting speech recognition in parallel at +${Date.now() - this.sessionStartTime} ms`);

    // ⚡ Step 3: Parallelize session open and native speech recognition startup
    this.startSpeechRecognition();

    this.ws = new WebSocket(socketUrl);

    this.ws.onopen = () => {
      this.wsOpenTime = Date.now();
      console.log(`[Voice Lifecycle]: WebSocket connection opened natively in +${this.wsOpenTime - this.sessionStartTime} ms`);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const turnId = this.currentTurnId;

        if (msg.type === 'ready') {
          this.wsReadyTime = Date.now();
          this.isSessionReady = true;
          const setupLatency = this.wsOpenTime > 0 ? this.wsReadyTime - this.wsOpenTime : 0;
          console.log(`[Voice Lifecycle]: [WS Ready Frame]: Handshake complete in +${this.wsReadyTime - this.sessionStartTime} ms total (+${setupLatency} ms setup gap). Cap = ${msg.capSeconds}s`);

          callbacks.onReady(msg.capSeconds);

          // ⚡ Step 4: Fast-talker Edge Case - Flush queued prompt if child spoke before WS was ready
          if (this.pendingInitialPrompt) {
            const queuedPrompt = this.pendingInitialPrompt;
            this.pendingInitialPrompt = null;
            console.log(`[Voice Lifecycle]: ⚡ Fast-talker prompt unqueued & dispatched at handshake completion: "${queuedPrompt}"`);
            this.finalizeSpokenTurn(queuedPrompt);
          }
        } else if (msg.type === 'cap_reached') {
          console.log('[Mobile WS Cap Reached Frame]: Server sent cap_reached signal.');
          this.isSessionActive = false;
          this.isTurnInFlight = false;
          this.isSessionReady = false;
          this.stopSpeechRecognition();
          this.stopAudioPlayback();
          callbacks.onCapReached();
        } else if (msg.type === 'error') {
          console.error('[Mobile WS Error Frame]: Server error =', msg.reason);
          this.isTurnInFlight = false;
          this.isSessionReady = false;
          callbacks.onError(msg.reason);
        } else if (msg.type === 'audio') {
          if (turnId !== this.currentTurnId) return;

          this.receivedChunkCount++;
          if (this.receivedChunkCount === 1) {
            this.firstChunkTime = Date.now();
            const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
            console.log(`[Mobile Audio] 🚀 First chunk received: +${latencyToFirstChunk} ms after prompt sent (Turn #${turnId})`);
          }

          this.accumulatedPcmBinary += atob(msg.data);

          if (!this.hasStartedPlayback && this.accumulatedPcmBinary.length >= LAUNCH_SEGMENT_BYTES) {
            const launchPcm = this.accumulatedPcmBinary.slice(0, LAUNCH_SEGMENT_BYTES);
            this.accumulatedPcmBinary = this.accumulatedPcmBinary.slice(LAUNCH_SEGMENT_BYTES);

            const launchWav = createWavBase64(launchPcm);
            this.audioQueue.push(`data:audio/wav;base64,${launchWav}`);

            this.hasStartedPlayback = true;
            this.updateState('speaking');
            this.playNextAudioSegment();
          }
        } else if (msg.type === 'turn_complete') {
          if (turnId !== this.currentTurnId || (this.receivedChunkCount === 0 && !this.hasStartedPlayback)) {
            console.log(`[Mobile Audio]: Discarding stray turn_complete frame for Turn #${turnId}`);
            return;
          }

          const turnCompleteTime = Date.now();
          const latencyToTurnComplete = this.promptSentTime > 0 ? turnCompleteTime - this.promptSentTime : 0;
          console.log(`[Mobile Audio] Turn complete: +${latencyToTurnComplete} ms after prompt sent. Total chunks collected = ${this.receivedChunkCount} (Turn #${turnId})`);

          this.isTurnComplete = true;

          if (this.accumulatedPcmBinary.length > 0) {
            const tailWav = createWavBase64(this.accumulatedPcmBinary);
            this.accumulatedPcmBinary = '';
            this.audioQueue.push(`data:audio/wav;base64,${tailWav}`);
          }

          if (!this.hasStartedPlayback) {
            this.hasStartedPlayback = true;
            this.updateState('speaking');
            this.playNextAudioSegment();
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
      this.isTurnInFlight = false;
      this.isSessionReady = false;
      this.stopSpeechRecognition();
      this.stopAudioPlayback();
      callbacks.onClose(e.reason || e.code);
    };

    this.ws.onerror = (e: any) => {
      console.error('[Mobile WebSocket Error Event]:', e?.message || e);
      this.isTurnInFlight = false;
      this.isSessionReady = false;
      callbacks.onError(e?.message || 'Connection error');
    };
  }

  sendImageCapture(base64Jpeg: string, caption?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[Mobile Sending Image Capture]:', base64Jpeg.length, 'base64 chars, caption:', caption || '(none)');
      this.isTurnInFlight = true;
      this.resetTurnState();
      this.updateState('thinking');
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
    const turnId = this.currentTurnId;
    if (this.activePlayer || this.preloadedNextPlayer || this.audioQueue.length > 0 || this.isPlayingQueue) {
      console.log(`[INTERRUPTION_CLEANUP] Turn #${turnId}: Stopping playback immediately. Releasing active & preloaded players.`);
    }
    this.audioQueue = [];
    this.accumulatedPcmBinary = '';
    this.hasStartedPlayback = false;
    this.isPlayingQueue = false;
    this.isTurnInFlight = false;

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

  private restartSpeechRecognition(callerTag: string = 'subEnd') {
    if (!this.isSessionActive || this.ws?.readyState !== WebSocket.OPEN) return;
    if (this.isRestartingSpeech) {
      console.log(`[SpeechRec Lifecycle]: restartSpeechRecognition called from [${callerTag}] but restart is already in flight. Ignoring duplicate restart.`);
      return;
    }
    this.isRestartingSpeech = true;

    setTimeout(() => {
      if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
        try {
          console.log(`[SpeechRec Lifecycle]: Started listening for spoken user turns (Triggered by [${callerTag}])...`);
          ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
        } catch (err: any) {
          console.error('[SpeechRec Lifecycle]: Error restarting speech recognition:', err?.message || err);
        } finally {
          this.isRestartingSpeech = false;
        }
      } else {
        this.isRestartingSpeech = false;
      }
    }, 200);
  }

  private finalizeSpokenTurn(transcript: string) {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }

    // ⚡ Step 4: Fast-talker Edge Case Guard: Buffer prompt if WebSocket is not ready yet
    if (!this.isSessionReady || this.ws?.readyState !== WebSocket.OPEN) {
      console.log(`[Mobile Voice Input] ⚠️ Turn finalized before WebSocket session ready — queued initial prompt: "${transcript}"`);
      this.pendingInitialPrompt = transcript;
      return;
    }

    // 🛑 DUAL TURN GUARD: Block prompt submission if a turn is already in flight
    if (this.isTurnInFlight) {
      console.log('[Mobile Voice Input] 🛑 Turn in flight. Blocked duplicate submission:', transcript);
      return;
    }

    if (transcript && transcript.length > 0 && transcript !== this.lastSentTranscript && this.ws?.readyState === WebSocket.OPEN) {
      this.isTurnInFlight = true;
      this.resetTurnState();
      this.updateState('thinking');
      this.promptSentTime = Date.now();
      console.log(`[Mobile Voice Input] Finalized spoken turn (Turn #${this.currentTurnId}) -> Sending prompt to Gemini Live:`, transcript);
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
        this.isRestartingSpeech = false;
        this.isMicActive = true;
        console.log(`[SpeechRec Lifecycle]: Native speech recognition active & listening at +${Date.now() - this.sessionStartTime} ms`);
        // ⚡ Step 2: Instant UI update (<100ms) as soon as mic is active natively
        this.updateState('listening');
      });

      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        // 🛑 MUTE STT: Completely ignore all transcript updates and VAD triggers while speaking, thinking, or turn in flight
        if (this.voiceState === 'speaking' || this.voiceState === 'thinking' || this.isTurnInFlight || this.isKidskoSpeaking()) {
          return;
        }

        const transcript = event.results?.[0]?.transcript?.trim();
        const isFinal = event.isFinal || event.results?.[0]?.isFinal;

        if (transcript && transcript.length > 0) {
          this.callbacks?.onTranscript?.(transcript);

          if (isFinal) {
            this.finalizeSpokenTurn(transcript);
          } else {
            // 🚀 Kid-friendly 1.2s (1200ms) silence pause timer: Allows kids 1.2s to pause without being cut off mid-sentence
            if (this.speechSilenceTimer) clearTimeout(this.speechSilenceTimer);
            this.speechSilenceTimer = setTimeout(() => {
              console.log('[Mobile Voice Input] 1200ms child pause detected -> Finalizing spoken turn:', transcript);
              this.finalizeSpokenTurn(transcript);
            }, 1200);
          }
        }
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        console.log('[SpeechRec Lifecycle]: Recognition cycle ended natively (Event: subEnd). Requesting restart...');
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
          this.restartSpeechRecognition('subEnd');
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.error('[SpeechRec Lifecycle]: Error event =', event.error, event.message);
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && event.error !== 'no-match') {
          this.restartSpeechRecognition('subError');
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

  private preloadNextSegment() {
    const turnId = this.currentTurnId;
    if (this.preloadedNextPlayer || this.audioQueue.length === 0) return;

    const nextSegmentUri = this.audioQueue.shift()!;

    try {
      const player = createAudioPlayer({ uri: nextSegmentUri });

      if (this.currentTurnId !== turnId) {
        try { player.remove(); } catch {}
        return;
      }

      try {
        if (typeof (player as any).setPlaybackRate === 'function') (player as any).setPlaybackRate(1.15);
        else if (typeof (player as any).setRate === 'function') (player as any).setRate(1.15);
        else (player as any).playbackRate = 1.15;
      } catch {}

      this.preloadedNextPlayer = player;
    } catch (err) {
      console.error(`[Mobile Audio Preload Error] Turn #${turnId}: Could not pre-create tail audio player:`, err);
      if (this.currentTurnId === turnId) {
        this.audioQueue.unshift(nextSegmentUri);
      }
    }
  }

  private playNextAudioSegment() {
    const turnId = this.currentTurnId;
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
        console.error(`[Mobile Playback Error] Turn #${turnId}: Exception playing WAV segment:`, err);
      }
    }

    if (!playerToPlay) {
      this.isPlayingQueue = false;
      if (this.isTurnComplete) {
        const playbackEndTime = Date.now();
        const totalTurnTime = this.promptSentTime > 0 ? playbackEndTime - this.promptSentTime : 0;
        console.log(`[Mobile Audio] 🔊 Turn Playback finished natively (+${totalTurnTime} ms total). Session WAITING FOR NEXT USER TURN (Turn #${turnId}).`);
        this.isTurnInFlight = false;
        this.updateState('listening');
      }
      return;
    }

    this.isPlayingQueue = true;
    this.updateState('speaking');

    const playbackStartTime = Date.now();
    if (this.promptSentTime > 0 && this.receivedChunkCount <= 2) {
      const timeToFirstAudio = playbackStartTime - this.promptSentTime;
      console.log(`[Mobile Audio] 🔊 Playback started (Segment 1 Launch): +${timeToFirstAudio} ms after prompt sent (Turn #${turnId})`);
    }

    const previousPlayer = this.activePlayer;
    this.activePlayer = playerToPlay;

    playerToPlay.addListener('playbackStatusUpdate', (status: any) => {
      if (status.didJustFinish) {
        if (this.currentTurnId !== turnId) {
          try { playerToPlay.remove(); } catch {}
          return;
        }

        const finishedPlayer = playerToPlay;
        if (this.activePlayer === finishedPlayer) {
          this.activePlayer = null;
        }

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

    this.preloadNextSegment();
  }

  async end(reason: string = 'user_tap') {
    if (!this.isSessionActive && !this.ws) {
      console.log(`[Mobile Session End Call]: Session already ended. Ignoring duplicate end call (Reason=${reason}).`);
      return;
    }
    console.log(`[Mobile Session End Call]: Ending voice session (Reason=${reason}, State=${this.voiceState || 'unknown'}, TurnInFlight=${this.isTurnInFlight})...`);

    this.isSessionActive = false;
    this.isTurnInFlight = false;
    this.isSessionReady = false;
    this.clearSpeechSubscriptions();
    this.stopAudioPlayback();
    if (this.ws) {
      try {
        this.ws.close(1000, reason);
      } catch {}
      this.ws = null;
    }
  }
}
