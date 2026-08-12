import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY_DEV;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY_DEV in .env');
}

const ai = new GoogleGenAI({ apiKey });

const SYSTEM_PROMPT = `You are "Kidsko", a warm, enthusiastic primary school learning buddy for kids aged 5 to 12.

Response Style Rules:
1. Speak in short, warm, simple sentences using elementary vocabulary. Keep responses brief (under 3 short paragraphs).
2. Socratic Principle: Explain 1 concept using a simple, relatable real-life analogy (playground, toys, pets, family), then ask ONE simple follow-up question.
3. NEVER output multi-paragraph textbook essays, corporate jargon, academic headers like "Question 1a:", or raw JSON/tool structures.
4. Tone: Encouraging, supportive, and cheerful. Use friendly emojis (🌟, 🦉, 💛).
5. Safety: Gently redirect unsafe or non-educational topics back to learning.`;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Ensures AI responses are 100% kid-friendly and cleanly strips any raw JSON,
 * tool calls ({ "action": ... }), or internal markdown headers.
 */
export function sanitizeChildResponse(rawText: string): string {
  if (!rawText) return "Sorry, I didn't quite catch that. Can you ask again? 🦉";

  let text = rawText.trim();

  // 1. Detect if the text contains or is pure raw JSON / tool call payload
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.action || parsed.action_input || parsed.thought) {
        if (parsed.action?.includes('dalle') || parsed.action?.includes('im')) {
          return "🎨 I made a picture for you! Take a look!";
        }
        if (typeof parsed.output === 'string') text = parsed.output;
        else if (typeof parsed.response === 'string') text = parsed.response;
        else if (typeof parsed.message === 'string') text = parsed.message;
        else return "🦉 Let's explore this together! What do you think happens next?";
      }
    } catch {
      // Not valid JSON, continue with regex sanitization
    }
  }

  // 2. Remove markdown JSON code blocks: ```json ... ```
  text = text.replace(/```(?:json)?[\s\S]*?```/gi, '').trim();

  // 3. Remove inline JSON objects like {"action": ...}
  text = text.replace(/\{[\s\S]*?"action"[\s\S]*?\}/gi, '').trim();

  // 4. Strip academic/corporate headers (e.g. "Question 1a: Professionalism", "Question 1f:")
  text = text.replace(/^(?:Question|Task|Problem|Section)\s*\d+[a-z]?:?\s*/gmi, '');
  text = text.replace(/^(?:Let's analyze this comprehensively|Here is the breakdown):?/gmi, '');

  // 5. Clean up duplicate newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  if (!text) {
    return "🦉 That's a great question! Let's think about it step by step.";
  }

  return text;
}

export async function generateChatReply(history: ChatMessage[]): Promise<string> {
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 250,
      temperature: 0.3,
    },
  });

  const rawText = response.text?.trim() || '';
  return sanitizeChildResponse(rawText);
}

export async function generateHomeworkExplanation(imageBase64: string, mimeType: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: 'Look at this homework image. Identify the question and explain the underlying concept simply with a real-life example. Do NOT give the direct final answer — guide the student toward it with ONE simple follow-up question.' },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 250,
      temperature: 0.3,
    },
  });

  const rawText = response.text?.trim() || '';
  return sanitizeChildResponse(rawText);
}
