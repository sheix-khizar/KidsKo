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

const VOICE_SYSTEM_PROMPT = `You are "Kidsko", a warm, enthusiastic, and encouraging female voice tutor for children aged 5 to 12.

[SPOKEN CONVERSATION & TEACHING STYLE]:
- Speak warmly, simply, and playfully with a lively, energetic conversational pace.
- Keep spoken replies clear, natural, and concise (around 2 to 4 friendly spoken sentences).
- If an image or homework page is shared through the camera, warmly describe what you see and explain it step-by-step.
- When explaining math or science by voice, introduce the core concept or formula clearly, explain the calculation simply, state the complete solution, and finish with a warm, encouraging question to keep the conversation flowing naturally.
- If the child speaks in English, Urdu, or Roman Urdu, reply fluently and naturally in the same language.
- Speak naturally as spoken dialogue: do NOT read out markdown asterisks or special symbols.

[LOOSE TALK, SLANG & BANTER]:
- If the child jokes around, uses slang, or is playful, respond with lighthearted humor and warmth, then guide back to learning.
- If the child feels frustrated with homework, empathize warmly and encourage them with a positive growth mindset.
- If the child tests boundaries or is mildly cheeky, remain calm, cheerful, and kind.

[COPPA PRIVACY & CHILD SAFETY]:
- NEVER ask the child for their last name, address, phone number, school, or personal passwords.
- If the child shares personal information, gently remind them to keep their private details safe, and do not repeat it.
- Strict G-rated safety: zero tolerance for adult topics, profanity, violence, weapons, or scary themes. Politely and cheerfully redirect to fun educational topics.`;

type LiveCallbacks = {
  onAudioChunk: (base64Audio: string) => void;
  onTextChunk?: (text: string) => void;
  onTurnComplete?: () => void;
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
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede',
                },
              },
            },
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
        const str = raw.toString();
        const data = JSON.parse(str);

        const isTurnComplete = !!data?.serverContent?.turnComplete;

        console.log('[Gemini Server Message Received]:', {
          setupComplete: !!data.setupComplete,
          hasServerContent: !!data.serverContent,
          turnComplete: isTurnComplete,
          partsCount: data.serverContent?.modelTurn?.parts?.length || 0,
          error: data.error || null,
        });

        if (!setupAccepted) {
          setupAccepted = true;
          clearTimeout(setupTimer);
          console.log(`[Gemini Live WS] Model ${modelName} setup confirmed by server response!`);
          resolve(geminiWs);
        }

        if (data.error) {
          console.error('[Gemini Live Server Error]:', data.error);
        }

        const parts = data?.serverContent?.modelTurn?.parts;
        if (parts && Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.inlineData) {
              console.log(`[Gemini Audio Chunk]: mimeType=${part.inlineData.mimeType}, bytes=${part.inlineData.data?.length || 0}`);
              callbacks.onAudioChunk(part.inlineData.data);
            }
            if (part?.text) {
              console.log(`[Gemini Text Chunk]: "${part.text}"`);
              if (callbacks.onTextChunk) callbacks.onTextChunk(part.text);
            }
          }
        }

        if (isTurnComplete && callbacks.onTurnComplete) {
          console.log('[Gemini Live WS] turnComplete signal received from Gemini Live server!');
          callbacks.onTurnComplete();
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
      console.log(`[Gemini Live WS] Model ${modelName} closed: Code ${code} - ${reasonStr}`);
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

export function sendAudioChunk(geminiWs: WebSocket, base64Audio: string) {
  if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
    const inputMsg = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Audio,
        },
      },
    };
    geminiWs.send(JSON.stringify(inputMsg));
  }
}

export function sendVideoChunk(geminiWs: WebSocket, base64Jpeg: string) {
  if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
    const inputMsg = {
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: base64Jpeg,
        },
      },
    };
    geminiWs.send(JSON.stringify(inputMsg));
  }
}

export function sendTextPrompt(geminiWs: WebSocket, textPrompt: string) {
  if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
    console.log('[Gemini Client Outbound Prompt]:', textPrompt);
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
  } else {
    console.warn('[Gemini Client Outbound Warning]: Cannot send text prompt, WebSocket state is', geminiWs?.readyState);
  }
}

export function sendImagePrompt(geminiWs: WebSocket, base64Jpeg: string, caption?: string) {
  if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
    const parts: any[] = [{ inlineData: { mimeType: 'image/jpeg', data: base64Jpeg } }];
    if (caption) parts.push({ text: caption });
    console.log('[Gemini Client Outbound Image Prompt]: caption =', caption || '(none)');
    const inputMsg = {
      clientContent: {
        turns: [{ role: 'user', parts }],
        turnComplete: true,
      },
    };
    geminiWs.send(JSON.stringify(inputMsg));
  } else {
    console.warn('[Gemini Client Outbound Warning]: Cannot send image prompt, WebSocket state is', geminiWs?.readyState);
  }
}

export function closeLiveSession(geminiWs: WebSocket) {
  if (geminiWs && (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING)) {
    try {
      geminiWs.close();
    } catch {}
  }
}
