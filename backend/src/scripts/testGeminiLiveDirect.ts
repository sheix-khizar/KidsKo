import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY_DEV in .env');
  process.exit(1);
}

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

async function testSetupVariant(name: string, setupMsg: any) {
  return new Promise<void>((resolve, reject) => {
    console.log(`👉 Testing Setup Variant: "${name}"...`);
    const ws = new WebSocket(GEMINI_WS_URL);
    let setupOk = false;

    const timeout = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`   ✅ Setup "${name}" held open for 3 seconds with NO error!`);
        setupOk = true;
        ws.close();
        resolve();
      }
    }, 3000);

    ws.on('open', () => {
      console.log(`   Connected to WS. Sending setup payload...`);
      ws.send(JSON.stringify(setupMsg));
    });

    ws.on('message', (raw) => {
      console.log(`   📩 Message from Gemini:`, raw.toString().slice(0, 150));
      setupOk = true;
      clearTimeout(timeout);
      ws.close();
      resolve();
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      const rStr = reason ? reason.toString() : `code ${code}`;
      if (!setupOk) {
        console.log(`   ❌ Closed with error: ${rStr}`);
        reject(new Error(rStr));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`   ❌ Error: ${err.message}`);
      reject(err);
    });
  });
}

async function runTests() {
  console.log('🧪 ==========================================================');
  console.log('🚀 DIRECT GEMINI LIVE BidiGenerateContent WS VERIFICATION');
  console.log('🧪 ==========================================================\n');

  const variants = [
    {
      name: 'Minimal Audio Setup (models/gemini-2.0-flash-exp)',
      payload: {
        setup: {
          model: 'models/gemini-2.0-flash-exp',
          generationConfig: { responseModalities: ['AUDIO'] },
        },
      },
    },
    {
      name: 'Minimal Audio Setup (models/gemini-2.0-flash-realtime-exp)',
      payload: {
        setup: {
          model: 'models/gemini-2.0-flash-realtime-exp',
          generationConfig: { responseModalities: ['AUDIO'] },
        },
      },
    },
    {
      name: 'Minimal Audio Setup (models/gemini-2.0-flash)',
      payload: {
        setup: {
          model: 'models/gemini-2.0-flash',
          generationConfig: { responseModalities: ['AUDIO'] },
        },
      },
    },
  ];

  for (const v of variants) {
    try {
      await testSetupVariant(v.name, v.payload);
      console.log(`\n🎉 SUCCESSFUL SETUP FOUND: ${v.name}\n`);
      return;
    } catch (err: any) {
      console.log(`   ⚠️ Variant "${v.name}" failed: ${err.message}\n`);
    }
  }

  console.error('❌ All direct Live WS setup variants failed.');
}

runTests();
