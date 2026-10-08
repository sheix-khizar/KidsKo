import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// NOTE: uses the DEV (free-tier) key for now. Swaps to PROD key in Phase 7.
const apiKey = process.env.GEMINI_API_KEY_DEV;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY_DEV in .env');
}

const ai = new GoogleGenAI({ apiKey });

export const SYSTEM_PROMPT = `You are "Kidsko", a warm, enthusiastic elementary school teacher AI companion for kids aged 5 to 12.

[PRIMARY GOAL & TONE]:
- Speak warmly, simply, and playfully, like a friendly teacher talking directly to a 7-year-old child.
- Use ultra-simple elementary words. NEVER use textbook jargon (e.g. NEVER say "Index notation", "multiplication string", "base number", "power number", "algebraic expression").
- Use fun, kid-friendly analogies (e.g. "The big number 5 is the main number, and the tiny 3 on top shows how many 5s we have!").

[MATH & NUMBERS RULES]:
- ALWAYS write numbers as DIGITS (e.g. 2, 3, 5, 5 × 5), NEVER spell them out as words (do NOT write "two times two" or "five to the power of three").
- Keep math expressions simple and clear.

[FORMAT & LENGTH RULES]:
- Keep replies VERY SHORT: 2 to 3 short sentences maximum (around 25-40 words total).
- NEVER use markdown formatting (no **, no #, no bullet points -, no numbered lists).
- NEVER mention question labels or codes (no "part a", "1e", "Question 1f"). Speak naturally instead ("Let's look at this problem together...").
- SINGLE STEP SOCRATIC RULE: Address ONLY ONE tiny step per turn. Explain it simply, then ask ONE simple, encouraging question to check understanding.

Safety & Limits:
- Never discuss unsafe topics. If asked, gently redirect back to learning.
- You do NOT have image generation or drawing tools. Never output JSON or tool calls.`;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function sanitizeChatResponse(text: string): string {
  if (!text) {
    return "Sorry, I didn't quite catch that. Can you ask again?";
  }

  let cleaned = text.trim();

  // Defense-in-depth safety net 1: detect and block raw JSON tool-use hallucinations
  const isJsonObject = cleaned.startsWith('{') && (cleaned.endsWith('}') || cleaned.includes('"action"'));
  const containsToolKeywords =
    cleaned.includes('"action"') ||
    cleaned.includes('"action_input"') ||
    cleaned.includes('"thought"') ||
    cleaned.includes('dalle.text2im') ||
    cleaned.includes('text2im');

  if (isJsonObject || containsToolKeywords) {
    console.warn('[Gemini Response Sanitizer]: Detected and blocked raw tool-call/JSON hallucination response!');
    return "I am a teacher, so I can't draw or generate pictures for you! But I can help you imagine one or describe it. What would you like to learn about today?";
  }

  // Defense-in-depth safety net 2: strip markdown syntax (**bold**, # headers, bullet lists) & question label tags
  cleaned = cleaned
    .replace(/\*\*(.*?)\*\*/g, '$1')       // Strip **bold**
    .replace(/\*(.*?)\*/g, '$1')           // Strip *italics*
    .replace(/^#+\s+/gm, '')              // Strip # headers
    .replace(/^[-*+]\s+/gm, '')           // Strip unordered list bullets
    .replace(/^\d+\.\s+/gm, '')           // Strip numbered list markers (1. 2.)
    .replace(/\b(?:Question\s+)?\d+[a-z]\b[:\s]*/gi, '') // Strip labels like "1e:", "Question 1f:"
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

export async function generateChatReply(
  history: ChatMessage[],
  threadImage?: { base64: string; mimeType: string }
): Promise<string> {
  // Attach the active homework image to the latest user message in history
  const lastUserIndex = history.map((m) => m.role).lastIndexOf('user');

  const contents = history.map((m, index) => {
    const isLatestUserTurnWithImage = index === lastUserIndex && threadImage;
    const parts: any[] = [];

    if (isLatestUserTurnWithImage) {
      parts.push({ inlineData: { data: threadImage.base64, mimeType: threadImage.mimeType } });
      parts.push({ text: '📸 [Homework Worksheet Photo attached below for student]' });
    }

    parts.push({ text: m.content });

    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 250, // NFR-3: cost control
      temperature: 0.3,
    },
  });

  const rawText = response.text || '';
  return sanitizeChatResponse(rawText);
}

export async function generateHomeworkExplanation(
  imageBase64: string,
  mimeType: string,
  userPrompt?: string
): Promise<string> {
  const promptInstruction = userPrompt?.trim()
    ? `Look at this homework image and answer the student's specific request: "${userPrompt.trim()}". Do NOT give the direct final answer. Explain the concept in 2 to 3 short, super simple sentences for a 7-year-old child using digits for numbers (e.g. 5 x 5 x 5 = 5³), then ask a small question.`
    : 'Look at this homework image. Explain ONLY the first problem in 2 to 3 short, super simple sentences for a 7-year-old child using digits for numbers (e.g. 5 x 5 x 5 = 5³), then ask a small question.';

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: promptInstruction },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 250,
      temperature: 0.3,
    },
  });

  const rawText = response.text || '';
  return sanitizeChatResponse(rawText);
}
