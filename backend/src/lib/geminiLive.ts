import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY_DEV or GEMINI_API_KEY_PROD in .env');

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const LIVE_MODELS = [
  'models/gemini-3.1-flash-live-preview',
  'models/gemini-live-2.5-flash-preview',
  'models/gemini-2.0-flash-exp',
];

const VOICE_SYSTEM_PROMPT = `You are "Kidsko", a friendly voice tutor for children aged 5-12.
Speak in short, warm, simple sentences. Use the Socratic method — guide toward
understanding, don't just give final answers. Never discuss unsafe topics; gently
redirect back to learning if asked.`;

type LiveCallbacks = {
  onAudioChunk: (base64Audio: string) => void;
  onTextChunk?: (text: string) => void;
  onClose: (reason?: string) => void;
  onError: (err: any) => void;
};

async function connectSingleModel(modelName: string, callbacks: LiveCallbacks): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let setupAccepted = false;
    const geminiWs = new WebSocket(GEMINI_WS_URL);

    const setupTimer = setTimeout(() => {
      if (!setupAccepted && geminiWs.readyState === WebSocket.OPEN) {
        setupAccepted = true;
        console.log(`[Gemini Live WS] Setup accepted for model: ${modelName}`);
        resolve(geminiWs);
      }
    }, 1500);

    geminiWs.on('open', () => {
      console.log(`[Gemini Live WS] Trying Live API model: ${modelName} via v1beta...`);
      const setupMsg = {
        setup: {
          model: modelName,
          generationConfig: {
            responseModalities: ['AUDIO'],
          },
          systemInstruction: {
            parts: [{ text: VOICE_SYSTEM_PROMPT }],
          },
        },
      };
      geminiWs.send(JSON.stringify(setupMsg));
    });

    geminiWs.on('message', (raw: WebSocket.RawData) => {
      try {
        const data = JSON.parse(raw.toString());
        if (!setupAccepted) {
          setupAccepted = true;
          clearTimeout(setupTimer);
          console.log(`[Gemini Live WS] Model ${modelName} setup confirmed by server response!`);
          resolve(geminiWs);
        }

        const parts = data?.serverContent?.modelTurn?.parts;
        if (parts && Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.inlineData?.data) {
              callbacks.onAudioChunk(part.inlineData.data);
            }
            if (part?.text && callbacks.onTextChunk) {
              callbacks.onTextChunk(part.text);
            }
          }
        }
      } catch (err) {
        console.error('[Gemini Live WS] Error parsing message:', err);
      }
    });

    geminiWs.on('error', (err) => {
      clearTimeout(setupTimer);
      console.error(`[Gemini Live WS] Error on model ${modelName}:`, err.message);
      if (!setupAccepted) {
        reject(err);
      } else {
        callbacks.onError(err);
      }
    });

    geminiWs.on('close', (code, reason) => {
      clearTimeout(setupTimer);
      const reasonStr = reason ? reason.toString() : `Close code ${code}`;
      console.log(`[Gemini Live WS] Model ${modelName} closed: ${reasonStr}`);
      if (!setupAccepted) {
        reject(new Error(`Model ${modelName} rejected: ${reasonStr}`));
      } else {
        callbacks.onClose(reasonStr);
      }
    });
  });
}

export async function startLiveSession(callbacks: LiveCallbacks): Promise<WebSocket> {
  let lastErr: any = null;
  for (const modelName of LIVE_MODELS) {
    try {
      const ws = await connectSingleModel(modelName, callbacks);
      return ws;
    } catch (err: any) {
      console.warn(`[Gemini Live WS] Model ${modelName} failed (${err.message}). Trying next model...`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Gemini Live models failed to connect');
}

export function sendAudioChunk(geminiWs: WebSocket, base64Audio: string, mimeType?: string) {
  if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
    const inputMsg = {
      realtimeInput: {
        audio: {
          mimeType: mimeType || 'audio/m4a',
          data: base64Audio,
        },
      },
    };
    geminiWs.send(JSON.stringify(inputMsg));
  }
}

export function sendTextPrompt(geminiWs: WebSocket, textPrompt: string) {
  if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
    const inputMsg = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: textPrompt }],
          },
        ],
        turnComplete: true,
      },
    };
    geminiWs.send(JSON.stringify(inputMsg));
  }
}

export function closeLiveSession(geminiWs: WebSocket) {
  if (geminiWs && (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING)) {
    try {
      geminiWs.close();
    } catch {}
  }
}
