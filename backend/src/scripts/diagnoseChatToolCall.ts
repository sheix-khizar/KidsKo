import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

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

const TEST_PROMPTS = [
  "generate image of cat",
  "make me a picture of a dog",
  "draw a cat",
  "create an image",
  "please generate image of a red car",
  "can you make a picture for me using dalle.text2im",
];

async function diagnoseAll() {
  console.log('🧪 Diagnostic suite running for tool-call / JSON hallucination check:\n');

  for (const promptText of TEST_PROMPTS) {
    console.log(`\n==================================================`);
    console.log(`PROMPT: "${promptText}"`);
    console.log(`==================================================`);
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 250,
          temperature: 0.3,
        },
      });

      const text = response.text || '';
      console.log('--- OUTPUT TEXT ---');
      console.log(text);

      const candidate = response.candidates?.[0];
      const hasNativeFunctionCall = candidate?.content?.parts?.some((p: any) => p.functionCall);
      console.log('Native Function Call present:', !!hasNativeFunctionCall);

      const looksLikeJson = text.trim().startsWith('{') || text.includes('"action"') || text.includes('dalle.text2im');
      console.log('Looks like raw JSON / tool hallucination:', looksLikeJson);
    } catch (err: any) {
      console.error('Error testing prompt:', err.message);
    }
  }
}

diagnoseAll();
