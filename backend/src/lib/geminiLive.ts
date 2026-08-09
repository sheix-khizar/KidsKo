import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY_DEV or GEMINI_API_KEY_PROD in .env');

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const LIVE_MODELS = ['models/gemini-2.0-flash-exp', 'models/gemini-2.0-flash', 'models/gemini-1.5-flash'];

const VOICE_SYSTEM_PROMPT = `You are "Kidsko", a friendly voice tutor for children aged 5-12.
Speak in short, warm, simple sentences. Use the Socratic method — guide toward
understanding, don't just give final answers. Never discuss unsafe topics; gently
redirect back to learning if asked.`;

type LiveCallbacks = {
  onAudioChunk: (base64Audio: string) => void;
  onClose: (reason?: string) => void;
  onError: (err: any) => void;
};

export async function startLiveSession(callbacks: LiveCallbacks): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let connected = false;
    let selectedModel = LIVE_MODELS[0];

    const geminiWs = new WebSocket(GEMINI_WS_URL);

    geminiWs.on('open', () => {
      console.log(`[Gemini Live WS] Connected to Gemini Live API. Sending setup for ${selectedModel}...`);
      const setupMsg = {
        setup: {
          model: selectedModel,
          generationConfig: {
            responseModalities: ['AUDIO'],
          },
          systemInstruction: {
            parts: [{ text: VOICE_SYSTEM_PROMPT }],
          },
        },
      };
      geminiWs.send(JSON.stringify(setupMsg));
      connected = true;
      resolve(geminiWs);
    });

    geminiWs.on('message', (raw: WebSocket.RawData) => {
      try {
        const data = JSON.parse(raw.toString());
        const parts = data?.serverContent?.modelTurn?.parts;
        if (parts && Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.inlineData?.data) {
              callbacks.onAudioChunk(part.inlineData.data);
            }
          }
        }
      } catch (err) {
        console.error('[Gemini Live WS] Error parsing message:', err);
      }
    });

    geminiWs.on('error', (err) => {
      console.error('[Gemini Live WS] Error:', err.message);
      if (!connected) {
        reject(err);
      } else {
        callbacks.onError(err);
      }
    });

    geminiWs.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : `Close code ${code}`;
      console.log(`[Gemini Live WS] Closed: ${reasonStr}`);
      if (!connected) {
        reject(new Error(`Gemini Live WS closed before connection: ${reasonStr}`));
      } else {
        callbacks.onClose(reasonStr);
      }
    });
  });
}

export function sendAudioChunk(geminiWs: WebSocket, base64Audio: string) {
  if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
    const inputMsg = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio,
          },
        ],
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
