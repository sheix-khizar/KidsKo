import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY_DEV in .env');
  process.exit(1);
}

const VERSIONS = ['v1alpha', 'v1beta', 'v1'];
const MODEL_STRINGS = [
  'models/gemini-2.0-flash-exp',
  'models/gemini-2.0-flash-realtime-exp',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-realtime-exp',
  'models/gemini-exp-1206',
];

async function testCombination(v: string, m: string): Promise<boolean> {
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${v}.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    let success = false;

    const timer = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        success = true;
        console.log(`   🎉 MATCH FOUND! API Version: "${v}" | Model: "${m}"`);
        ws.close();
        resolve(true);
      } else {
        ws.close();
        resolve(false);
      }
    }, 2500);

    ws.on('open', () => {
      const setupMsg = {
        setup: {
          model: m,
          generationConfig: { responseModalities: ['AUDIO'] },
        },
      };
      ws.send(JSON.stringify(setupMsg));
    });

    ws.on('message', (raw) => {
      console.log(`   📩 Response from Gemini (${v} / ${m}):`, raw.toString().slice(0, 100));
      success = true;
      clearTimeout(timer);
      ws.close();
      resolve(true);
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timer);
      if (!success) {
        resolve(false);
      }
    });

    ws.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function runMatrixTest() {
  console.log('🧪 ==========================================================');
  console.log('🚀 TESTING GEMINI LIVE WEBSOCKET MATRIX (API Versions & Models)');
  console.log('🧪 ==========================================================\n');

  for (const v of VERSIONS) {
    for (const m of MODEL_STRINGS) {
      process.stdout.write(`Testing ${v} with ${m}... `);
      const ok = await testCombination(v, m);
      if (ok) {
        console.log(`\n🏆 WORKING COMBINATION CONFIRMED: ${v} with ${m}`);
        return;
      } else {
        console.log('❌');
      }
    }
  }

  console.log('\nℹ️ No standard BidiGenerateContent WS combination connected with current API key permissions.');
}

runMatrixTest();
