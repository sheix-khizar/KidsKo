import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function testKey(label: string, apiKey: string | undefined) {
  if (!apiKey) {
    console.log(`❌ ${label}: no key found in .env`);
    return;
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'Say "hello" in exactly one word.',
    });
    console.log(`✅ ${label}: working — response: "${response.text?.trim()}"`);
  } catch (error: any) {
    console.log(`❌ ${label}: failed — ${error.message}`);
  }
}

(async () => {
  console.log('Testing Gemini API keys...\n');
  await testKey('DEV key (free tier)', process.env.GEMINI_API_KEY_DEV);
  await testKey('PROD key (billing off for now)', process.env.GEMINI_API_KEY_PROD);
})();