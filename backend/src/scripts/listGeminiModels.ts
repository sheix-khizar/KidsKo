import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY_DEV in .env');
  process.exit(1);
}

async function listModels() {
  console.log('🔍 Listing available Gemini models for your API Key...\n');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data: any = await res.json();

  if (data.models && Array.isArray(data.models)) {
    console.log('Available Models:');
    data.models.forEach((m: any) => {
      if (m.name.includes('flash') || m.name.includes('2.0') || m.supportedGenerationMethods?.includes('bidiGenerateContent')) {
        console.log(` • ${m.name} | Methods: ${JSON.stringify(m.supportedGenerationMethods || [])}`);
      }
    });
  } else {
    console.error('Response error:', data);
  }
}

listModels();
