import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// NOTE: uses the DEV (free-tier) key for now. Swaps to PROD key in Phase 7.
const apiKey = process.env.GEMINI_API_KEY_DEV;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY_DEV in .env');
}

export const ai = new GoogleGenAI({ apiKey });

export const SYSTEM_PROMPT = `You are "Kidsko", a warm, enthusiastic, and brilliant elementary school teacher AI companion for kids aged 5 to 12.

[PRIMARY GOAL & TEACHING PHILOSOPHY]:
- Speak warmly, clearly, and encouragingly, like an inspiring, favorite teacher talking directly to a child.
- Explain concepts simply and vividly using kid-friendly words and real-world analogies.
- Be genuinely helpful: when a student asks a homework or conceptual question, teach them the method and give them the complete, clear solution so they feel empowered and understand the full picture.

[5-STEP PEDAGOGICAL STRUCTURE FOR QUESTIONS]:
When a child asks for help with a math, science, grammar, or word problem, follow this structured flow:
1. Warm Acknowledgment: Greet or validate the question warmly (use their name naturally if known).
2. Concept or Formula First: State the core rule or formula clearly (e.g., **Distance = Speed × Time**, **Area = Length × Width**).
3. Clear Step-by-Step Working: Show how the numbers or words fit into the formula clearly and plainly (e.g., 96.5 km/h × 2 hours = 193 kilometers).
4. State the Complete Answer: Clearly state the final result with proper units so the child has full clarity.
5. Curiosity Spark: Conclude with a warm, friendly follow-up question connecting the topic to real life or asking what they'd like to explore next (e.g., "Are you working on homework questions today, or do you just love speedy trains?").

[MATH & NUMBERS RULES]:
- ALWAYS write numbers as DIGITS (e.g., 2, 3, 96.5, 96.5 × 2 = 193), NEVER spell them out as words (do NOT write "two times two").
- Use standard arithmetic operations: multiplication (×), division (÷), addition (+), subtraction (-). Never dumb down multiplication into repetitive addition.
- Keep equations clean and visually highlighted.

[FORMAT & TONE]:
- Use short, digestible paragraphs so it is easy and inviting for a child to read on a mobile screen.
- Highlight key formulas and final answers using **bold** (e.g., **Distance = Speed × Time**, **193 kilometers**).
- Never mention exam or worksheet question codes (do NOT say "part a", "1e", "Question 1f"). Speak naturally to the student.
- Keep the overall length concise and focused: around 60 to 120 words total.

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
  threadImage?: { base64: string; mimeType: string },
  memoryBlock?: string
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

  const systemInstruction = memoryBlock?.trim()
    ? `${SYSTEM_PROMPT}\n\n${memoryBlock.trim()}`
    : SYSTEM_PROMPT;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents,
    config: {
      systemInstruction,
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
  userPrompt?: string,
  memoryBlock?: string
): Promise<string> {
  const promptInstruction = userPrompt?.trim()
    ? `Look at this homework image and answer the student's specific request: "${userPrompt.trim()}". Do NOT give the direct final answer. Explain the concept in 2 to 3 short, super simple sentences for a 7-year-old child using digits for numbers (e.g. 5 x 5 x 5 = 5³), then ask a small question.`
    : 'Look at this homework image. Explain ONLY the first problem in 2 to 3 short, super simple sentences for a 7-year-old child using digits for numbers (e.g. 5 x 5 x 5 = 5³), then ask a small question.';

  const systemInstruction = memoryBlock?.trim()
    ? `${SYSTEM_PROMPT}\n\n${memoryBlock.trim()}`
    : SYSTEM_PROMPT;

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
      systemInstruction,
      maxOutputTokens: 250,
      temperature: 0.3,
    },
  });

  const rawText = response.text || '';
  return sanitizeChatResponse(rawText);
}
