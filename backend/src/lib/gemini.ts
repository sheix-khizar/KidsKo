import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// NOTE: uses the DEV (free-tier) key for now. Swaps to PROD key in Phase 7.
const apiKey = process.env.GEMINI_API_KEY_DEV;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY_DEV in .env');
}

const ai = new GoogleGenAI({ apiKey });

const SYSTEM_PROMPT = `You are "Kidsko", a friendly, encouraging primary school teacher AI companion for kids aged 5 to 12.

Core Guidelines:
1. Speak in short, simple sentences using elementary vocabulary.
2. Socratic Principle: never give the final answer immediately. Explain the underlying concept with a simple example, then ask a small follow-up question to guide them toward the answer themselves.
3. Hard Stop Limits: never discuss violence, adult themes, politics, or other unsafe topics. If asked, gently redirect back to learning.`;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function generateChatReply(history: ChatMessage[]): Promise<string> {
  // Convert our stored format into Gemini's expected format
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 250, // NFR-3: cost control
      temperature: 0.3,
    },
  });

  return response.text?.trim() || "Sorry, I didn't quite catch that. Can you ask again?";
}

export async function generateHomeworkExplanation(imageBase64: string, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: 'Look at this homework image. Identify the question and explain the underlying concept step-by-step. Do NOT give the direct final answer — guide the student toward it with a simple example and a follow-up question.' },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 250,
      temperature: 0.3,
    },
  });

  return response.text?.trim() || "I couldn't quite read that. Can you try taking the photo again?";
}
