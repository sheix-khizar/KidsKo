import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY_DEV or GEMINI_API_KEY_PROD in .env');

const ai = new GoogleGenAI({ apiKey });

const STREAM_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
];

const VOICE_SYSTEM_PROMPT = `You are "Kidsko", a friendly voice tutor for children aged 5-12.
Speak in short, warm, simple sentences. Use the Socratic method — guide toward
understanding, don't just give final answers. Never discuss unsafe topics; gently
redirect back to learning if asked.`;

type LiveCallbacks = {
  onAudioChunk?: (base64Audio: string) => void;
  onTextChunk?: (text: string) => void;
  onClose: (reason?: string) => void;
  onError: (err: any) => void;
};

async function streamContentWithFallback(prompt: string, onTextChunk: (text: string) => void) {
  let lastError: any = null;

  for (const modelName of STREAM_MODELS) {
    try {
      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: VOICE_SYSTEM_PROMPT,
        },
      });

      let chunksCount = 0;
      for await (const chunk of stream) {
        if (chunk.text) {
          chunksCount++;
          onTextChunk(chunk.text);
        }
      }

      if (chunksCount > 0) {
        return; // Successfully streamed response!
      }
    } catch (err: any) {
      console.warn(`[Gemini Voice] Model ${modelName} returned error/quota limit:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('Google Gemini API quota exceeded across all fallback models.');
}

export async function startLiveSession(callbacks: LiveCallbacks) {
  let active = true;

  // Send initial Socratic welcome greeting
  setTimeout(async () => {
    try {
      await streamContentWithFallback(
        'Say a warm, short Socratic greeting introducing yourself as Kidsko, ready to help learn!',
        (text) => {
          if (active && callbacks.onTextChunk) callbacks.onTextChunk(text);
        }
      );
    } catch (err: any) {
      console.error('[Gemini Live] Initial greeting fallback error:', err.message || err);
    }
  }, 300);

  return {
    sendInput: async (userPrompt: string) => {
      if (!active) return;
      try {
        await streamContentWithFallback(userPrompt, (text) => {
          if (active && callbacks.onTextChunk) callbacks.onTextChunk(text);
        });
      } catch (err: any) {
        console.error('[Gemini Live] Streaming error:', err.message || err);
        const errStr = err?.message || err?.toString() || 'Google Gemini API Rate Limit (429). Please retry in a few seconds.';
        callbacks.onError(errStr);
      }
    },
    close: () => {
      active = false;
    },
  };
}

export function sendAudioChunk(session: any, base64Audio: string) {
  if (session && typeof session.sendInput === 'function') {
    // Process input chunk
  }
}

export function closeLiveSession(session: any) {
  if (session && typeof session.close === 'function') {
    session.close();
  }
}
