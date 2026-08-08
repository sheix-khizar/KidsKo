import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY_DEV or GEMINI_API_KEY_PROD in .env');

const ai = new GoogleGenAI({ apiKey });

const LIVE_MODEL = 'gemini-2.0-flash-exp';

const VOICE_SYSTEM_PROMPT = `You are "Kidsko", a friendly voice tutor for children aged 5-12.
Speak in short, warm, simple sentences. Use the Socratic method — guide toward
understanding, don't just give final answers. Never discuss unsafe topics; gently
redirect back to learning if asked.`;

type LiveCallbacks = {
  onAudioChunk: (base64Audio: string) => void;
  onClose: () => void;
  onError: (err: any) => void;
};

export async function startLiveSession(callbacks: LiveCallbacks) {
  try {
    const session = await ai.live.connect({
      model: LIVE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: VOICE_SYSTEM_PROMPT,
      },
      callbacks: {
        onopen: () => console.log('Gemini Live session opened'),
        onmessage: (e: any) => {
          try {
            const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            const parts = data?.serverContent?.modelTurn?.parts;
            const audioPart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('audio/'));
            if (audioPart) callbacks.onAudioChunk(audioPart.inlineData.data);
          } catch (err) {
            callbacks.onError(err);
          }
        },
        onerror: (e: any) => callbacks.onError(e?.error || e),
        onclose: () => callbacks.onClose(),
      },
    });

    return session;
  } catch (err: any) {
    console.error('Error connecting to Gemini Live:', err.message);
    throw err;
  }
}

// Client (mobile) audio should be 16-bit PCM, 16kHz, mono, base64-encoded
export function sendAudioChunk(session: any, base64Audio: string) {
  if (session && typeof session.sendRealtimeInput === 'function') {
    session.sendRealtimeInput({
      audio: { data: base64Audio, mimeType: 'audio/pcm;rate=16000' },
    });
  } else if (session && typeof session.send === 'function') {
    session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Audio }] } }));
  }
}

export function closeLiveSession(session: any) {
  if (session && typeof session.close === 'function') {
    session.close();
  }
}
