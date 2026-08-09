import { createAudioPlayer, requestRecordingPermissionsAsync, AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { getToken } from './api';

const WS_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/^http/, 'ws');
const CHUNK_DURATION_MS = 500;

type VoiceCallbacks = {
  onReady: (capSeconds: number) => void;
  onCapReached: () => void;
  onError: (reason: string) => void;
  onClose: () => void;
};

export class VoiceSession {
  private ws: WebSocket | null = null;
  private recorder: InstanceType<typeof AudioModule.AudioRecorder> | null = null;
  private recordLoopActive = false;
  private activePlayer: any = null;
  private playbackQueue: string[] = [];
  private playing = false;

  async start(callbacks: VoiceCallbacks) {
    const token = await getToken();
    if (!token) {
      callbacks.onError('Not authenticated');
      return;
    }

    this.ws = new WebSocket(`${WS_URL}/ws/voice?token=${token}`);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ready') callbacks.onReady(msg.capSeconds);
        else if (msg.type === 'cap_reached') callbacks.onCapReached();
        else if (msg.type === 'error') callbacks.onError(msg.reason);
        else if (msg.type === 'audio') this.enqueuePlayback(msg.data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    this.ws.onclose = () => callbacks.onClose();
    this.ws.onerror = () => callbacks.onError('Connection error');

    await this.startRecordingLoop();
  }

  private async startRecordingLoop() {
    try {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) return;

      this.recordLoopActive = true;
      this.recordNextChunk();
    } catch (err) {
      console.error('Recording setup error:', err);
    }
  }

  private async recordNextChunk() {
    if (!this.recordLoopActive) return;

    try {
      const recorder = new AudioModule.AudioRecorder({
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 128000,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      this.recorder = recorder;

      setTimeout(async () => {
        if (!this.recordLoopActive) return;
        try {
          await recorder.stop();
          const uri = recorder.uri;
          if (uri && this.ws?.readyState === WebSocket.OPEN) {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
            this.ws.send(JSON.stringify({ type: 'audio_chunk', data: base64 }));
          }
        } catch (err) {
          console.error('Chunk record stop error:', err);
        }
        this.recordNextChunk();
      }, CHUNK_DURATION_MS);
    } catch (err) {
      console.error('Record chunk start error:', err);
    }
  }

  private enqueuePlayback(base64Audio: string) {
    this.playbackQueue.push(base64Audio);
    if (!this.playing) this.processPlaybackQueue();
  }

  private async processPlaybackQueue() {
    if (this.playbackQueue.length === 0) {
      this.playing = false;
      return;
    }
    this.playing = true;
    const chunk = this.playbackQueue.shift()!;

    try {
      const wavBase64 = this.wrapPcmAsWav(chunk);
      const player = createAudioPlayer({ uri: `data:audio/wav;base64,${wavBase64}` });
      this.activePlayer = player;
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          player.remove();
          this.processPlaybackQueue();
        }
      });
      player.play();
    } catch (err) {
      console.error('Playback error:', err);
      this.playing = false;
      this.processPlaybackQueue();
    }
  }

  private wrapPcmAsWav(base64Pcm: string): string {
    const binaryPcm = atob(base64Pcm);
    const pcmLength = binaryPcm.length;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
    view.setUint32(4, 36 + pcmLength, true);
    view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);
    view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true);
    view.setUint32(28, 24000 * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
    view.setUint32(40, pcmLength, true);

    const headerBytes = new Uint8Array(header);
    let binaryHeader = '';
    for (let i = 0; i < headerBytes.length; i++) {
      binaryHeader += String.fromCharCode(headerBytes[i]);
    }

    return btoa(binaryHeader + binaryPcm);
  }

  async end() {
    this.recordLoopActive = false;
    if (this.recorder) {
      try {
        await this.recorder.stop();
      } catch {}
    }
    if (this.activePlayer) {
      try {
        this.activePlayer.remove();
      } catch {}
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}
