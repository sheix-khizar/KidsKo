import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY_DEV or GEMINI_API_KEY_PROD in .env');

const ai = new GoogleGenAI({ apiKey });

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

export async function startLiveSession(callbacks: LiveCallbacks) {
  let active = true;

  // Send initial Socratic welcome greeting
  setTimeout(async () => {
    try {
      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.0-flash',
        contents: 'Say a warm, short Socratic greeting introducing yourself as Kidsko, ready to help learn!',
        config: {
          systemInstruction: VOICE_SYSTEM_PROMPT,
        },
      });

      for await (const chunk of stream) {
        if (!active) break;
        if (chunk.text && callbacks.onTextChunk) {
          callbacks.onTextChunk(chunk.text);
        }
      }
    } catch (err: any) {
      console.error('[Gemini Live] Initial greeting error:', err.message);
    }
  }, 300);

  return {
    sendInput: async (userPrompt: string) => {
      if (!active) return;
      try {
        const stream = await ai.models.generateContentStream({
          model: 'gemini-2.0-flash',
          contents: userPrompt,
          config: {
            systemInstruction: VOICE_SYSTEM_PROMPT,
          },
        });

        for await (const chunk of stream) {
          if (!active) break;
          if (chunk.text && callbacks.onTextChunk) {
            callbacks.onTextChunk(chunk.text);
          }
        }
      } catch (err: any) {
        console.error('[Gemini Live] Streaming error:', err.message);
        callbacks.onError(err.message || 'Voice session error');
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
