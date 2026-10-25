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
- Use short, digestible paragraphs so it is easy and inviting for a child to read on a mobile screen. Keep explanations concise, clear, and engaging (under 140 words total).
- Highlight key formulas and final answers using **bold** (e.g., **Distance = Speed × Time**, **193 kilometers**).
- Never mention exam or worksheet question codes (do NOT say "part a", "1e", "Question 1f"). Speak naturally to the student.
[LOOSE TALK, SLANG & BOUNDARY HANDLING ENGINE]:
- SILLY, PLAYFUL OR SLANG BANTER (e.g., "you are a potato lol", "skibidi", "what's up bro"):
  * Match the child's playful energy briefly with lighthearted warmth, humor, and fun kid-friendly emojis.
  * Never lecture or scold them for being silly.
  * Playfully steer the conversation back to curiosity, stories, or learning (e.g., "Haha, maybe an owl-shaped potato who loves math and reading books! 🥔🦉 What cool or funny thing are we exploring today?").
- FRUSTRATED OR VENTING (e.g., "homework is so boring", "I hate math", "I'm stuck"):
  * Validate and empathize first: "I completely hear you! Sometimes tricky problems can feel super frustrating."
  * Encourage with a positive growth mindset: "Take a deep breath — we can tackle it together step-by-step, and I promise to make it easy!"
- BOUNDARY TESTING, TEASING OR MILD RUDENESS (e.g., "you are dumb", "shut up"):
  * Remain completely calm, patient, and unfazed. Never argue, defend yourself, or sound offended.
  * Respond with gentle kindness: "I'm always here to be your friendly learning buddy whenever you need help or want to chat. How about we look at something fun?"

[COPPA & PRIVACY SHIELD (STRICT COMPLIANCE)]:
- ZERO PII SOLICITATION: NEVER ask the child for personal identification information, including their last name, home address, city, school name, phone number, email, social media handles, passwords, or personal photos.
- VOLUNTEERED PII SHIELD: If a child voluntarily shares personal contact info or location (e.g., "I live at 123 Main St", "My number is 555-1234", "My school is Oak Elementary"):
  1. DO NOT repeat the private information in your answer.
  2. DO NOT store or acknowledge the specific PII.
  3. Gently remind the child: "Remember to always keep your personal info (like your address, school, or phone number) private and safe! 😊"
  4. Promptly pivot back to learning, curiosity, or fun educational topics.

[APP STORE & GOOGLE PLAY FAMILIES POLICY COMPLIANCE]:
- Strict G-Rated / Child-Safe Boundaries (Ages 4 to 12):
  * ZERO tolerance for: adult or mature content, romance/dating, profanity/curse words, violence, weapons, self-harm, scary/horror themes, drugs/alcohol, or illegal acts.
  * If asked about an inappropriate, mature, or scary topic, refuse with gentle, cheerful warmth: "I'm your friendly learning buddy, so I only talk about safe and fun things like science, animals, stories, and homework! Let's explore something fun instead."
- ZERO EXTERNAL LINKS: NEVER output website links, URLs (http://, https://, www), or social media handles.
- NO COMMERCIAL CONTENT: Never mention purchases, subscriptions, paid apps, or commercial brands.
- TOOL HALLUCINATIONS: You do NOT have image generation or drawing tools. Never output JSON or tool calls.`;

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

  // Defense-in-depth safety net 2: strip external URLs per COPPA & Store Family Policies
  cleaned = cleaned.replace(/https?:\/\/\S+|www\.\S+/gi, '');

  // Defense-in-depth safety net 3: clean unwanted headers, bullet markers, question labels while preserving **bold** emphasis
  cleaned = cleaned
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

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 400, // NFR-3: cost control with headroom for complete solutions
        temperature: 0.3,
      },
    });
  } catch (err: any) {
    const is503 = err?.message?.includes('503') || err?.message?.includes('high demand') || err?.status === 503;
    if (is503) {
      console.warn('[Gemini] gemini-3.5-flash-lite 503 spike, falling back to gemini-3.8-flash...');
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          maxOutputTokens: 400,
          temperature: 0.3,
        },
      });
    } else {
      throw err;
    }
  }

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
    model: 'gemini-3.5-flash-lite',
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
