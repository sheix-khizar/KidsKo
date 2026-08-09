import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY_DEV or GEMINI_API_KEY_PROD in .env');

const ai = new GoogleGenAI({ apiKey });

const LIVE_MODELS = ['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-flash'];

const VOICE_SYSTEM_PROMPT = `You are "Kidsko", a friendly voice tutor for children aged 5-12.
Speak in short, warm, simple sentences. Use the Socratic method — guide toward
understanding, don't just give final answers. Never discuss unsafe topics; gently
redirect back to learning if asked.`;

type LiveCallbacks = {
  onAudioChunk: (base64Audio: string) => void;
  onClose: (reason?: string) => void;
  onError: (err: any) => void;
};

export async function startLiveSession(callbacks: LiveCallbacks) {
  let lastError: any = null;

  for (const modelName of LIVE_MODELS) {
    try {
      console.log(`[Gemini Live] Attempting to connect with model: ${modelName}`);
      const session = await ai.live.connect({
        model: modelName,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: VOICE_SYSTEM_PROMPT,
        },
        callbacks: {
          onopen: () => console.log(`[Gemini Live] Connected successfully with model: ${modelName}`),
          onmessage: (e: any) => {
            try {
              const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
              const parts = data?.serverContent?.modelTurn?.parts;
              const audioPart = parts?.find((p: any) => p.inlineData?.mimeType?.startsWith('audio/'));
              if (audioPart) callbacks.onAudioChunk(audioPart.inlineData.data);
            } catch (err) {
              console.error('[Gemini Live] Error parsing audio message:', err);
              callbacks.onError(err);
            }
          },
          onerror: (e: any) => {
            console.error('[Gemini Live] Session error:', e?.error || e);
            callbacks.onError(e?.error || e);
          },
          onclose: (e: any) => {
            console.log('[Gemini Live] Session closed by Gemini server:', e?.reason || e);
            callbacks.onClose(e?.reason || 'Gemini session closed');
          },
        },
      });

      return session;
    } catch (err: any) {
      console.warn(`[Gemini Live] Model ${modelName} failed to connect:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini Live models failed to connect');
}

export function sendAudioChunk(session: any, base64Audio: string) {
  try {
    if (session && typeof session.sendRealtimeInput === 'function') {
      session.sendRealtimeInput({
        audio: { data: base64Audio, mimeType: 'audio/pcm;rate=16000' },
      });
    } else if (session && typeof session.send === 'function') {
      session.send(JSON.stringify({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Audio }] } }));
    }
  } catch (err) {
    console.error('[Gemini Live] Error sending audio chunk:', err);
  }
}

export function closeLiveSession(session: any) {
  try {
    if (session && typeof session.close === 'function') {
      session.close();
    }
  } catch (err) {
    // Session already closed
  }
}
