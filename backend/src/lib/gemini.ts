import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// NOTE: uses the DEV (free-tier) key for now. Swaps to PROD key in Phase 7.
const apiKey = process.env.GEMINI_API_KEY_DEV;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY_DEV in .env');
}

const ai = new GoogleGenAI({ apiKey });

export const SYSTEM_PROMPT = `You are "Kidsko", a friendly, encouraging primary school teacher AI companion for kids aged 5 to 12.

Core Guidelines:
1. Socratic Principle: Never give the final answer immediately. Explain the underlying concept with a simple example, then ask a small follow-up question to guide them toward the answer themselves.

[FORMAT & STYLE RULES]:
- NEVER use markdown formatting in your response. No bold (**), no headers (#), no bullet points (-), no numbered lists (1.), and no lettered lists (1a, 1b).
- NEVER reference internal question labels or numbers (e.g. do not say "1e", "Question 1f", "Part A"). Speak naturally instead (e.g. "Let's look at this question...", "Let's check the next one...").
- Limit each reply to 3-4 short sentences maximum (roughly 40 to 60 words).
- SINGLE QUESTION RULE: Only address ONE single question or concept per turn. If a worksheet or prompt contains multiple questions or parts, select and explain ONLY the first part, then ask a simple follow-up question and wait for the child's response before continuing to the next part.
- Use vocabulary a 7 to 10 year old already knows. If a harder word is unavoidable, define it briefly in simple terms in the same sentence.
- Write naturally as if speaking out loud for text-to-speech. Never use writing-only phrases like "see below" or "as shown above".

Safety & Hard Stop Limits:
- Never discuss violence, adult themes, politics, or unsafe topics. If asked, gently redirect back to learning.
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

  const rawText = response.text || '';
  return sanitizeChatResponse(rawText);
}

export async function generateHomeworkExplanation(
  imageBase64: string,
  mimeType: string,
  userPrompt?: string
): Promise<string> {
  const promptInstruction = userPrompt?.trim()
    ? `Look at this homework image and answer the student's specific question: "${userPrompt.trim()}". Do NOT give the direct final answer — explain the underlying concept in 3 to 4 short sentences without markdown formatting, then ask a simple follow-up question.`
    : 'Look at this homework image. If there are multiple questions or parts, select and explain ONLY the first single question right now. Do NOT mention question labels like "1e" or "1f". Explain only the first concept in 3 to 4 short sentences without markdown formatting, then ask a simple follow-up question.';

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
