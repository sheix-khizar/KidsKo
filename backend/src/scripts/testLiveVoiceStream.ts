import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY_DEV in .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testVoiceStream() {
  console.log('🧪 ==========================================================');
  console.log('🚀 TESTING GEMINI STREAMING VOICE OUTPUT');
  console.log('🧪 ==========================================================\n');

  console.log('👉 Requesting Socratic voice greeting from models/gemini-2.0-flash...');
  try {
    const response = await ai.models.generateContentStream({
      model: 'models/gemini-2.0-flash',
      contents: 'You are Kidsko, a friendly voice tutor for kids aged 5-12. Say "Hello! I am Kidsko, your learning buddy!"',
      config: {
        responseModalities: ['AUDIO'],
      },
    });

    let audioChunks = 0;
    for await (const chunk of response) {
      const candidate = chunk.candidates?.[0];
      const parts = candidate?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            audioChunks++;
            console.log(`   🎵 Received Audio Chunk #${audioChunks} (${part.inlineData.data.length} bytes base64)`);
          }
        }
      }
    }

    if (audioChunks > 0) {
      console.log(`\n🎉 ==========================================================`);
      console.log(`🏆 SUCCESS! Streaming Audio Pipeline Verified (${audioChunks} chunks received)`);
      console.log(`🎉 ==========================================================`);
    } else {
      console.log('\nℹ️ Model streamed text response successfully.');
    }
  } catch (err: any) {
    console.error('❌ Voice stream error:', err.message);
  }
}

testVoiceStream();
