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
  private micWatchdogTimer: any = null;
  private currentTurnId = 0;

  // Decoupled Mic & Session Ready Flags
  private isMicActive = false;
  private isSessionReady = false;

  // Turn Flight & Deduplication State
  private isTurnInFlight = false;
  private pendingInitialPrompt: string | null = null;
  private voiceState: 'listening' | 'thinking' | 'speaking' | null = null;

  // Single Continuous Response State
  private audioQueue: string[] = [];
  private accumulatedPcmBinary = '';
  private hasStartedPlayback = false;
  private isPlayingQueue = false;
  private receivedChunkCount = 0;
  private isTurnComplete = false;
  private hasLoggedPlaybackStart = false;

  // Fine-grained Lifecycle Diagnostic Timers
  private sessionStartTime = 0;
  private wsOpenTime = 0;
  private wsReadyTime = 0;
  private restartTriggerTime = 0;
  private promptSentTime = 0;
  private firstChunkTime = 0;

  getLastTranscript(): string {
    return this.lastSentTranscript;
  }

  private updateState(newState: 'listening' | 'thinking' | 'speaking') {
    if (!this.isSessionActive && newState !== 'listening') return;
    if (this.voiceState !== newState) {
      console.log(`[VoiceSession State Transition]: ${this.voiceState || 'none'} -> ${newState}`);
      this.voiceState = newState;
      this.callbacks?.onStateChange?.(newState);

      // ⚡ INSTANT MIC RE-ARM ON USER TURN:
      if (newState === 'listening') {
        this.isTurnInFlight = false;
        this.restartSpeechRecognition('turn_complete');
      }
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

    // Parallelize session open and native speech recognition startup
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
          if (turnId !== this.currentTurnId || !this.isSessionActive) return;

          this.receivedChunkCount++;
          const pcmChunk = atob(msg.data);
          this.accumulatedPcmBinary += pcmChunk;

          if (this.receivedChunkCount === 1) {
            this.firstChunkTime = Date.now();
            const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
            console.log(`[Mobile Audio] 🚀 First chunk received: +${latencyToFirstChunk} ms after prompt sent (Turn #${turnId})`);
          }
        } else if (msg.type === 'turn_complete') {
          if (turnId !== this.currentTurnId || (this.receivedChunkCount === 0 && this.accumulatedPcmBinary.length === 0) || !this.isSessionActive) {
            console.log(`[Mobile Audio]: Discarding stray turn_complete frame for Turn #${turnId}`);
            return;
          }

          const turnCompleteTime = Date.now();
          const latencyToTurnComplete = this.promptSentTime > 0 ? turnCompleteTime - this.promptSentTime : 0;
          console.log(`[Mobile Audio] Turn complete: +${latencyToTurnComplete} ms after prompt sent. Total chunks collected = ${this.receivedChunkCount} (${this.accumulatedPcmBinary.length} bytes PCM) (Turn #${turnId})`);

          this.isTurnComplete = true;

          // 🔊 SINGLE CONTINUOUS RESPONSE WAV: Assemble 100% of turn audio into ONE UNIFIED WAV file for studio-smooth audio
          if (this.accumulatedPcmBinary.length > 0) {
            const singleResponseWav = createWavBase64(this.accumulatedPcmBinary);
            this.accumulatedPcmBinary = '';
            this.audioQueue.push(`data:audio/wav;base64,${singleResponseWav}`);

            this.hasStartedPlayback = true;
            this.updateState('speaking');
            this.playNextAudioSegment();
          }
        } else if (msg.type === 'text') {
          console.log(`[Mobile AI Spoken Response]: "${msg.data}"`);
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

  cancelCurrentTurn() {
    console.log(`[Mobile Barge-In] User spoke mid-turn (Turn #${this.currentTurnId}) -> Instantly muting speaker & switching to listening...`);
    this.stopAudioPlayback();
    this.isTurnInFlight = false;
    this.lastSentTranscript = '';
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'cancel' }));
    }
    this.updateState('listening');
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
    this.hasLoggedPlaybackStart = false;
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
    this.hasLoggedPlaybackStart = false;

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
    this.restartTriggerTime = Date.now();

    const restartDelayMs = (callerTag === 'no-speech' || callerTag === 'subEnd') ? 10 : 200;

    setTimeout(() => {
      if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
        try {
          console.log(`[SpeechRec Lifecycle]: Started listening for spoken user turns (Triggered by [${callerTag}])...`);
          this.isMicActive = false;

          if (this.micWatchdogTimer) clearTimeout(this.micWatchdogTimer);
          this.micWatchdogTimer = setTimeout(() => {
            if (this.isSessionActive && !this.isMicActive) {
              console.warn('[SpeechRec Watchdog]: Mic active state did not recover within 3000ms. Forcing hard-restart...');
              this.isRestartingSpeech = false;
              this.restartSpeechRecognition('watchdog_forced');
            }
          }, 3000);

          ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
        } catch (err: any) {
          console.error('[SpeechRec Lifecycle]: Error restarting speech recognition:', err?.message || err);
        } finally {
          this.isRestartingSpeech = false;
        }
      } else {
        this.isRestartingSpeech = false;
      }
    }, restartDelayMs);
  }

  private finalizeSpokenTurn(transcript: string) {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }

    if (!this.isSessionReady || this.ws?.readyState !== WebSocket.OPEN) {
      console.log(`[Mobile Voice Input] ⚠️ Turn finalized before WebSocket session ready — queued initial prompt: "${transcript}"`);
      this.pendingInitialPrompt = transcript;
      return;
    }

    // Block duplicate submissions if audio chunks have already started arriving or if AI is speaking
    if (this.isTurnInFlight && (this.receivedChunkCount > 0 || this.voiceState === 'speaking')) {
      console.log('[Mobile Voice Input] 🛑 Turn audio streaming / speaking. Blocked duplicate submission:', transcript);
      return;
    }

    if (transcript && transcript.length > 0 && transcript !== this.lastSentTranscript && this.ws?.readyState === WebSocket.OPEN) {
      this.resetTurnState();
      this.isTurnInFlight = true;
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
    this.restartTriggerTime = Date.now();

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

        if (this.micWatchdogTimer) {
          clearTimeout(this.micWatchdogTimer);
          this.micWatchdogTimer = null;
        }

        const sessionElapsed = this.sessionStartTime > 0 ? Date.now() - this.sessionStartTime : 0;
        const sinceRestart = this.restartTriggerTime > 0 ? Date.now() - this.restartTriggerTime : 0;

        console.log(`[SpeechRec Lifecycle]: Native speech recognition active & listening (session_elapsed=${sessionElapsed}ms, since_restart=${sinceRestart}ms)`);
        this.updateState('listening');
      });

      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const transcript = event.results?.[0]?.transcript?.trim();
        const isFinal = event.isFinal || event.results?.[0]?.isFinal;

        if (transcript && transcript.length > 0) {
          // ⚡ LATEST PROMPT OVERRIDE & REAL-CALL BARGE-IN:
          // If student speaks a new or extended thought while AI is active (thinking, speaking, or in-flight),
          // INSTANTLY SILENCE SPEAKER & CANCEL OLD TURN so Gemini answers the LATEST complete sentence!
          if ((this.voiceState === 'speaking' || this.voiceState === 'thinking' || this.isTurnInFlight || this.isKidskoSpeaking()) && transcript !== this.lastSentTranscript) {
            console.log(`[Mobile Barge-In] New/Extended user speech detected ("${transcript}") -> Canceling previous turn to answer latest prompt!`);
            this.cancelCurrentTurn();
          }

          this.callbacks?.onTranscript?.(transcript);

          if (isFinal) {
            this.finalizeSpokenTurn(transcript);
          } else {
            if (this.speechSilenceTimer) clearTimeout(this.speechSilenceTimer);
            this.speechSilenceTimer = setTimeout(() => {
              console.log('[Mobile Voice Input] 800ms child pause detected -> Finalizing spoken turn:', transcript);
              this.finalizeSpokenTurn(transcript);
            }, 800);
          }
        }
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        console.debug('[SpeechRec Lifecycle]: Recognition cycle ended natively (Event: subEnd). Requesting restart...');
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
          this.restartSpeechRecognition('subEnd');
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.log('[SpeechRec Lifecycle]: Error event =', event.error, event.message);
        if (event.error === 'no-speech') {
          console.log('[SpeechRec Lifecycle]: Fast-restarting after benign no-speech timeout (Triggered by [no-speech])...');
          if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
            this.restartSpeechRecognition('no-speech');
          }
        } else if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && event.error !== 'no-match') {
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
    if (this.micWatchdogTimer) {
      clearTimeout(this.micWatchdogTimer);
      this.micWatchdogTimer = null;
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
    if (this.preloadedNextPlayer || this.audioQueue.length === 0 || !this.isSessionActive) return;

    const nextSegmentUri = this.audioQueue.shift()!;

    try {
      const player = createAudioPlayer({ uri: nextSegmentUri });

      if (this.currentTurnId !== turnId || !this.isSessionActive) {
        try { player.remove(); } catch {}
        return;
      }

      try {
        if (typeof (player as any).setPlaybackRate === 'function') (player as any).setPlaybackRate(1.22);
        else if (typeof (player as any).setRate === 'function') (player as any).setRate(1.22);
        else (player as any).playbackRate = 1.22;
      } catch {}

      this.preloadedNextPlayer = player;
    } catch (err) {
      console.error(`[Mobile Audio Preload Error] Turn #${turnId}: Could not pre-create audio player:`, err);
      if (this.currentTurnId === turnId) {
        this.audioQueue.unshift(nextSegmentUri);
      }
    }
  }

  private playNextAudioSegment() {
    const turnId = this.currentTurnId;
    let playerToPlay: any = null;
    const isPreloaded = !!this.preloadedNextPlayer;

    if (!this.isSessionActive) return;

    if (isPreloaded) {
      playerToPlay = this.preloadedNextPlayer;
      this.preloadedNextPlayer = null;
    } else if (this.audioQueue.length > 0) {
      const nextSegmentUri = this.audioQueue.shift()!;
      try {
        playerToPlay = createAudioPlayer({ uri: nextSegmentUri });
        try {
          if (typeof (playerToPlay as any).setPlaybackRate === 'function') (playerToPlay as any).setPlaybackRate(1.22);
          else if (typeof (playerToPlay as any).setRate === 'function') (playerToPlay as any).setRate(1.22);
          else (playerToPlay as any).playbackRate = 1.22;
        } catch {}
      } catch (err) {
        console.error(`[Mobile Playback Error] Turn #${turnId}: Exception playing WAV response:`, err);
      }
    }

    if (!playerToPlay) {
      this.isPlayingQueue = false;
      if (this.isTurnComplete && this.isSessionActive) {
        const playbackEndTime = Date.now();
        const totalTurnTime = this.promptSentTime > 0 ? playbackEndTime - this.promptSentTime : 0;
        console.log(`[Mobile Audio] 🔊 Single Continuous Response Playback Finished (+${totalTurnTime} ms total). Session WAITING FOR NEXT USER TURN (Turn #${turnId}).`);
        this.isTurnInFlight = false;
        this.updateState('listening');
      }
      return;
    }

    this.isPlayingQueue = true;
    this.updateState('speaking');

    const playbackStartTime = Date.now();
    if (this.promptSentTime > 0 && !this.hasLoggedPlaybackStart) {
      this.hasLoggedPlaybackStart = true;
      const timeToFirstAudio = playbackStartTime - this.promptSentTime;
      console.log(`[Mobile Audio] 🔊 Single Continuous Response Playback Started: +${timeToFirstAudio} ms after prompt sent (Turn #${turnId})`);
    }

    const previousPlayer = this.activePlayer;
    this.activePlayer = playerToPlay;

    playerToPlay.addListener('playbackStatusUpdate', (status: any) => {
      if (status.didJustFinish) {
        if (this.currentTurnId !== turnId || !this.isSessionActive) {
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
