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
// 4-Chunk Jitter Buffer threshold = 38,400 bytes (~350ms to 400ms of audio buffer cushion)
const STREAM_SEGMENT_BYTES = 38400;

// Construct a strict 24000Hz (24kHz) 16-bit Mono PCM WAV container
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
  view.setUint32(24, 24000, true);     // SampleRate = 24000 Hz (Strict 24kHz output)
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

// ⚡ PRE-WARM AUDIO ENGINE: Play 100ms of silent 24kHz PCM to pre-initialize AVAudioEngine / AudioTrack hardware node
function prewarmAudioEngine() {
  try {
    const silentPcm = new Array(4800).fill('\0').join('');
    const silentWav = createWavBase64(silentPcm);
    const player = createAudioPlayer({ uri: `data:audio/wav;base64,${silentWav}` });
    player.play();
    setTimeout(() => {
      try { player.remove(); } catch {}
    }, 150);
    console.log('[Mobile Audio Engine]: ⚡ Pre-warmed native AVAudioEngine / AudioTrack hardware node at 24kHz');
  } catch (err) {
    console.warn('[Mobile Audio Engine]: Could not pre-warm audio engine:', err);
  }
}

export class VoiceSession {
  private ws: WebSocket | null = null;
  private activePlayer: any = null;
  private preloadedNextPlayer: any = null;
  private callbacks: VoiceCallbacks | null = null;
  private speechSubscriptions: any[] = [];
  private lastSentTranscript = '';
  private lastAiText = '';
  private isSessionActive = false;
  private isStartingSpeech = false;
  private speechSilenceTimer: any = null;
  private currentTurnId = 0;

  // Clean State Machine & UI Throttling
  private currentState: 'listening' | 'thinking' | 'speaking' | null = null;

  // Race-condition & response lock flags
  private isProcessingTurn = false;
  private isAwaitingResponse = false;

  // 4-Chunk Jitter Buffer (~350ms Cushion)
  private pcmQueue: string[] = [];
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

  private updateState(newState: 'listening' | 'thinking' | 'speaking') {
    if (this.currentState !== newState) {
      console.log(`[VoiceSession State Change]: ${this.currentState || 'none'} -> ${newState}`);
      this.currentState = newState;
      this.callbacks?.onStateChange?.(newState);
    }
  }

  private isKidskoSpeaking(): boolean {
    return (
      this.currentState === 'speaking' ||
      this.isPlayingQueue ||
      this.audioQueue.length > 0 ||
      this.preloadedNextPlayer !== null ||
      this.activePlayer !== null ||
      (this.hasStartedPlayback && !this.isTurnComplete)
    );
  }

  sendAudioBuffer(base64Pcm16k: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'audio_chunk', isRawPcm: true, data: base64Pcm16k }));
    }
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
        const turnId = this.currentTurnId;

        if (msg.type === 'ready') {
          console.log(`[Mobile WS Ready Frame]: Session cap = ${msg.capSeconds}s`);
          prewarmAudioEngine();
          this.updateState('listening');
          callbacks.onReady(msg.capSeconds);
        } else if (msg.type === 'cap_reached') {
          console.log('[Mobile WS Cap Reached Frame]: Server sent cap_reached signal.');
          this.isSessionActive = false;
          this.isAwaitingResponse = false;
          this.stopSpeechRecognition();
          this.stopAudioPlayback();
          callbacks.onCapReached();
        } else if (msg.type === 'error') {
          console.error('[Mobile WS Error Frame]: Server error =', msg.reason);
          callbacks.onError(msg.reason);
          this.isProcessingTurn = false;
          this.isAwaitingResponse = false;
        } else if (msg.type === 'audio') {
          if (turnId !== this.currentTurnId) return;

          this.receivedChunkCount++;
          const decodedPcm = atob(msg.data);
          
          this.pcmQueue.push(decodedPcm);
          this.accumulatedPcmBinary += decodedPcm;

          if (this.receivedChunkCount < 4) {
            if (this.receivedChunkCount === 1) {
              this.firstChunkTime = Date.now();
              const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
              console.log(`[Mobile Audio] 🚀 First 24kHz chunk received: +${latencyToFirstChunk} ms after prompt sent (Turn #${turnId})`);
            }
            return;
          }

          // 4-CHUNK JITTER BUFFER: Trigger play() ONLY when 4 chunks are buffered (~350ms cushion)
          if (!this.hasStartedPlayback && this.pcmQueue.length >= 4) {
            const launchPcm = this.accumulatedPcmBinary;
            this.accumulatedPcmBinary = '';

            const launchWav = createWavBase64(launchPcm);
            this.audioQueue.push(`data:audio/wav;base64,${launchWav}`);

            this.hasStartedPlayback = true;
            this.updateState('speaking');
            this.playNextAudioSegment();
          } else if (this.hasStartedPlayback && this.accumulatedPcmBinary.length >= STREAM_SEGMENT_BYTES) {
            const segmentPcm = this.accumulatedPcmBinary.slice(0, STREAM_SEGMENT_BYTES);
            this.accumulatedPcmBinary = this.accumulatedPcmBinary.slice(STREAM_SEGMENT_BYTES);

            const segmentWav = createWavBase64(segmentPcm);
            this.audioQueue.push(`data:audio/wav;base64,${segmentWav}`);

            if (!this.isPlayingQueue) {
              this.playNextAudioSegment();
            } else if (!this.preloadedNextPlayer) {
              this.preloadNextSegment();
            }
          }
        } else if (msg.type === 'turn_complete') {
          if (turnId !== this.currentTurnId) {
            console.log(`[Mobile Audio]: Discarding stray turn_complete frame for Turn #${turnId}`);
            return;
          }

          const turnCompleteTime = Date.now();
          const latencyToTurnComplete = this.promptSentTime > 0 ? turnCompleteTime - this.promptSentTime : 0;
          console.log(`[Mobile Audio] Turn complete: +${latencyToTurnComplete} ms after prompt sent. Total chunks collected = ${this.receivedChunkCount} (Turn #${turnId})`);

          this.isTurnComplete = true;

          if (this.receivedChunkCount === 0) {
            console.log(`[Mobile Audio] Turn #${turnId} received 0 chunks. Resetting internal state cleanly.`);
            this.isProcessingTurn = false;
            this.isAwaitingResponse = false;
            this.updateState('listening');
            return;
          }

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
          this.lastAiText = msg.data || '';
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
      this.isProcessingTurn = false;
      this.isAwaitingResponse = false;
      this.stopSpeechRecognition();
      this.stopAudioPlayback();
      callbacks.onClose(e.reason || e.code);
    };

    this.ws.onerror = (e: any) => {
      console.error('[Mobile WebSocket Error Event]:', e?.message || e);
      this.isProcessingTurn = false;
      this.isAwaitingResponse = false;
      callbacks.onError(e?.message || 'Connection error');
    };

    await this.startSpeechRecognition();
  }

  sendImageCapture(base64Jpeg: string, caption?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[Mobile Sending Image Capture]:', base64Jpeg.length, 'base64 chars, caption:', caption || '(none)');
      this.isProcessingTurn = true;
      this.isAwaitingResponse = true;
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
    this.pcmQueue = [];
    this.accumulatedPcmBinary = '';
    this.audioQueue = [];
    this.hasStartedPlayback = false;
    this.isPlayingQueue = false;
    this.isTurnComplete = false;
  }

  private stopAudioPlayback() {
    const turnId = this.currentTurnId;
    if (this.activePlayer || this.preloadedNextPlayer || this.audioQueue.length > 0 || this.isPlayingQueue) {
      console.log(`[INTERRUPTION_CLEANUP] Turn #${turnId}: Stopping audio playback immediately. Releasing active & preloaded players.`);
    }
    this.pcmQueue = [];
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
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    setTimeout(() => {
      if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
        try {
          console.log('[SpeechRec Lifecycle]: Flushed native STT buffer & started listening for fresh user turns...');
          ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true });
        } catch (err: any) {
          console.error('[SpeechRec Lifecycle]: Error restarting speech recognition:', err?.message || err);
        }
      }
    }, 150);
  }

  private finalizeSpokenTurn(transcript: string) {
    if (this.speechSilenceTimer) {
      clearTimeout(this.speechSilenceTimer);
      this.speechSilenceTimer = null;
    }

    if (this.isProcessingTurn || this.isAwaitingResponse) {
      console.log('[Mobile Voice Input] 🛑 Duplicate turn finalization blocked (turn processing / in-flight request):', transcript);
      return;
    }

    if (transcript && transcript.length > 0 && transcript !== this.lastSentTranscript && this.ws?.readyState === WebSocket.OPEN) {
      this.isProcessingTurn = true;
      this.isAwaitingResponse = true;
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
        console.log('[SpeechRec Lifecycle]: Started listening for spoken user turns...');
      });

      const subResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        const transcript = event.results?.[0]?.transcript?.trim();
        const isFinal = event.isFinal || event.results?.[0]?.isFinal;

        if (transcript && transcript.length > 0) {
          // 🛡️ SELF-ECHO & BARGE-IN FILTERING DURING AI SPEECH:
          if (this.isKidskoSpeaking() || this.currentState === 'speaking') {
            const words = transcript.split(/\s+/).filter(Boolean);
            const cleanTranscript = transcript.toLowerCase();

            // 1. Explicit user stop/interrupt keywords (Urdu & English)
            const isExplicitStop = /\b(ruko|rukko|stop|wait|suno|listen|tehero|bhai|chup|quiet|hold|paas|pause)\b/i.test(cleanTranscript);

            // 2. Check if transcript contains words from Kidsko's current response (speaker echo)
            let isEchoOfAi = false;
            if (this.lastAiText && this.lastAiText.length > 0) {
              const aiWords = this.lastAiText.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
              const matchingWords = words.filter((w: string) => aiWords.includes(w.toLowerCase()));
              if (matchingWords.length >= 2 || (words.length > 0 && matchingWords.length / words.length > 0.4)) {
                isEchoOfAi = true;
              }
            }

            // 🛡️ Filter out self-echo, short background noises (< 4 words) unless an explicit stop command was spoken
            const isShortFragment = words.length < 4 && !isExplicitStop;

            if (isEchoOfAi || isShortFragment) {
              console.log('[SpeechRec Lifecycle] 🛡️ Ignored Kidsko self-echo / short background noise during AI speech:', transcript);
              return;
            }

            // ⚡ GENUINE USER BARGE-IN DETECTED: Immediately stop Kidsko playback and switch to listening mode!
            console.log(`[SpeechRec Lifecycle] ⚡ Genuine user interruption detected ("${transcript}")! Stopping Kidsko playback immediately...`);
            this.stopAudioPlayback();
            this.isProcessingTurn = false;
            this.isAwaitingResponse = false;
            this.updateState('listening');
            this.callbacks?.onTranscript?.(transcript);

            if (isFinal) {
              this.finalizeSpokenTurn(transcript);
            } else {
              if (this.speechSilenceTimer) clearTimeout(this.speechSilenceTimer);
              this.speechSilenceTimer = setTimeout(() => {
                this.finalizeSpokenTurn(transcript);
              }, 600);
            }
            return;
          }

          if (this.isAwaitingResponse) {
            console.log('[SpeechRec Lifecycle] 🔒 Ignored STT callback while awaiting Gemini response (in-flight request):', transcript);
            return;
          }

          // Real-time live transcript streaming to UI screen
          this.callbacks?.onTranscript?.(transcript);

          if (isFinal) {
            this.finalizeSpokenTurn(transcript);
          } else {
            // VAD silence timer (600ms for fast responsive turn finalization)
            if (this.speechSilenceTimer) clearTimeout(this.speechSilenceTimer);
            this.speechSilenceTimer = setTimeout(() => {
              console.log('[Mobile Voice Input] VAD pause detected -> Finalizing spoken turn:', transcript);
              this.finalizeSpokenTurn(transcript);
            }, 600);
          }
        }
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        console.log('[SpeechRec Lifecycle]: Recognition cycle ended natively. Auto-restarting for continuous listening...');
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && !this.isKidskoSpeaking()) {
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
        this.isProcessingTurn = false;
        this.isAwaitingResponse = false;
        this.updateState('listening');
        // Flush native STT microphone buffer right when AI playback finishes so self-echo does NOT leak into next turn
        this.restartSpeechRecognition();
      }
      return;
    }

    this.isPlayingQueue = true;
    this.updateState('speaking');

    const playbackStartTime = Date.now();
    if (this.promptSentTime > 0 && this.receivedChunkCount <= 5) {
      const timeToFirstAudio = playbackStartTime - this.promptSentTime;
      console.log(`[Mobile Audio] 🔊 Direct 24kHz Native Playback started (Segment 1 Launch): +${timeToFirstAudio} ms after prompt sent (Turn #${turnId})`);
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

  async end() {
    console.log('[Mobile Session End Call]: User manually ending voice session...');
    this.isSessionActive = false;
    this.isProcessingTurn = false;
    this.isAwaitingResponse = false;
    this.clearSpeechSubscriptions();
    this.stopAudioPlayback();
    if (this.ws) {
      this.ws.close();
    }
  }
}
