import { Platform } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { getToken } from './api';

const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || defaultHost;
const WS_URL = rawApiUrl.replace(/^http/, 'ws');

type VoiceCallbacks = {
  onReady: (capSeconds: number) => void;
  onCapReached: () => void;
  onError: (reason: string) => void;
  onClose: (reason?: string | number) => void;
  onTranscript?: (text: string) => void;
};

export class VoiceSession {
  private ws: WebSocket | null = null;
  private activePlayer: any = null;
  private pcmTurnChunks: string[] = [];
  private speechSubscriptions: any[] = [];
  private lastSentTranscript = '';
  private isSessionActive = false;
  private isStartingSpeech = false;

  // Diagnostic Timers
  private promptSentTime = 0;
  private firstChunkTime = 0;

  async start(callbacks: VoiceCallbacks) {
    const token = await getToken();
    if (!token) {
      callbacks.onError('Not authenticated');
      return;
    }

    this.isSessionActive = true;
    const socketUrl = `${WS_URL}/ws/voice?token=${token}`;
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
          callbacks.onCapReached();
        } else if (msg.type === 'error') {
          console.error('[Mobile WS Error Frame]: Server error =', msg.reason);
          callbacks.onError(msg.reason);
        } else if (msg.type === 'audio') {
          if (this.pcmTurnChunks.length === 0) {
            this.firstChunkTime = Date.now();
            const latencyToFirstChunk = this.promptSentTime > 0 ? this.firstChunkTime - this.promptSentTime : 0;
            console.log(`[Mobile Audio] First chunk received: +${latencyToFirstChunk} ms after prompt sent`);
          }
          this.pcmTurnChunks.push(msg.data);
          console.log(`[Mobile Inbound Audio Chunk #${this.pcmTurnChunks.length}]: base64 len = ${msg.data.length}`);
        } else if (msg.type === 'turn_complete') {
          const turnCompleteTime = Date.now();
          const latencyToTurnComplete = this.promptSentTime > 0 ? turnCompleteTime - this.promptSentTime : 0;
          console.log(`[Mobile Audio] Turn complete: +${latencyToTurnComplete} ms after prompt sent. Total chunks collected = ${this.pcmTurnChunks.length}`);
          this.playFullTurnBufferedAudio();
        } else if (msg.type === 'text') {
          callbacks.onTranscript?.(msg.data);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    this.ws.onclose = (e) => {
      console.log(`[Mobile WebSocket Closed Event]: Code=${e.code}, Reason="${e.reason || 'None'}"`);
      this.isSessionActive = false;
      this.stopSpeechRecognition();
      if (this.pcmTurnChunks.length > 0) {
        this.playFullTurnBufferedAudio();
      }
      callbacks.onClose(e.reason || e.code);
    };

    this.ws.onerror = (e: any) => {
      console.error('[Mobile WebSocket Error Event]:', e?.message || e);
      callbacks.onError(e?.message || 'Connection error');
    };

    await this.startSpeechRecognition();
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
        if (transcript && transcript.length > 0 && transcript !== this.lastSentTranscript && this.ws?.readyState === WebSocket.OPEN) {
          if (this.activePlayer) {
            console.log('[Mobile Turn Interrupted]: New user turn spoken while previous audio was playing. Stopping active player.');
            try {
              this.activePlayer.remove();
            } catch {}
            this.activePlayer = null;
          }
          this.promptSentTime = Date.now();
          this.firstChunkTime = 0;
          this.pcmTurnChunks = [];
          console.log('[Mobile Voice Input] Sending final spoken turn to Gemini Live:', transcript);
          this.lastSentTranscript = transcript;
          this.ws.send(JSON.stringify({ type: 'text_prompt', data: transcript }));
        }
      });

      const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
        console.log('[SpeechRec Lifecycle]: Recognition cycle ended natively.');
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
          console.log('[SpeechRec Lifecycle]: Session still active -> Auto-restarting speech recognition for next user turn...');
          setTimeout(() => {
            if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
              try {
                ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, continuous: true });
              } catch (err: any) {
                console.error('[SpeechRec Lifecycle]: Error auto-restarting:', err?.message || err);
              }
            }
          }, 300);
        }
      });

      const subError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        console.error('[SpeechRec Lifecycle]: Error event =', event.error, event.message);
        if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN && event.error !== 'no-match') {
          setTimeout(() => {
            if (this.isSessionActive && this.ws?.readyState === WebSocket.OPEN) {
              try {
                ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false, continuous: true });
              } catch {}
            }
          }, 500);
        }
      });

      this.speechSubscriptions = [subStart, subResult, subEnd, subError];

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: true,
      });
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
    this.clearSpeechSubscriptions();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
  }

  private async playFullTurnBufferedAudio() {
    if (this.pcmTurnChunks.length === 0) return;

    const chunksToPlay = [...this.pcmTurnChunks];
    this.pcmTurnChunks = []; // Reset buffer for next turn immediately

    try {
      // 1. Concatenate all Base64 chunks into binary PCM
      let totalBinaryPcm = '';
      for (const base64Chunk of chunksToPlay) {
        totalBinaryPcm += atob(base64Chunk);
      }
      const totalPcmBytes = totalBinaryPcm.length;

      console.log(`[Mobile Buffer Processing]: Concatenated ${chunksToPlay.length} chunks -> Total PCM = ${totalPcmBytes} bytes`);

      // 2. Wrap composite PCM buffer with a valid 24kHz, 16-bit, mono WAV header
      const header = new ArrayBuffer(44);
      const view = new DataView(header);

      // RIFF header ("RIFF")
      view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
      view.setUint32(4, 36 + totalPcmBytes, true);
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

      // data subchunk ("data" = 0x64, 0x61, 0x74, 0x61)
      view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
      view.setUint32(40, totalPcmBytes, true);

      const headerBytes = new Uint8Array(header);
      let binaryHeader = '';
      for (let i = 0; i < headerBytes.length; i++) {
        binaryHeader += String.fromCharCode(headerBytes[i]);
      }

      const wavBase64 = btoa(binaryHeader + totalBinaryPcm);

      // Stop previous player instance if active
      if (this.activePlayer) {
        try {
          this.activePlayer.remove();
        } catch {}
        this.activePlayer = null;
      }

      const playbackStartTime = Date.now();
      const timeToFirstAudio = this.promptSentTime > 0 ? playbackStartTime - this.promptSentTime : 0;
      console.log(`[Mobile Audio] Playback started: +${timeToFirstAudio} ms after prompt sent`);
      console.log(`[Mobile Audio] Time to first audio: ${timeToFirstAudio} ms`);

      const player = createAudioPlayer({ uri: `data:audio/wav;base64,${wavBase64}` });
      this.activePlayer = player;

      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          const playbackEndTime = Date.now();
          const totalTurnTime = this.promptSentTime > 0 ? playbackEndTime - this.promptSentTime : 0;
          console.log(`[Mobile Audio] Playback finished: +${totalTurnTime} ms after prompt sent. Session remains WAITING FOR NEXT USER TURN.`);
          try {
            player.remove();
          } catch {}
          this.activePlayer = null;
        }
      });

      player.play();
    } catch (err) {
      console.error('[Mobile Playback Error]: Exception playing buffered turn WAV:', err);
    }
  }

  async end() {
    console.log('[Mobile Session End Call]: User manually ending voice session...');
    this.isSessionActive = false;
    this.stopSpeechRecognition();
    if (this.activePlayer) {
      try {
        this.activePlayer.remove();
      } catch {}
      this.activePlayer = null;
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}
