import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY_DEV or GEMINI_API_KEY_PROD in .env');
  process.exit(1);
}

const URL_VERSIONS = [
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`,
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`,
];

const LIVE_MODELS = [
  'models/gemini-2.0-flash-exp',
  'models/gemini-2.0-flash',
  'models/gemini-1.5-flash',
  'gemini-2.0-flash-exp',
];

async function tryConnectModel(wsUrl: string, modelName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let audioReceived = false;

    const timeout = setTimeout(() => {
      ws.close();
      resolve(audioReceived);
    }, 5000);

    ws.on('open', () => {
      const setupMsg = {
        setup: {
          model: modelName,
          generationConfig: {
            responseModalities: ['AUDIO'],
          },
          systemInstruction: {
            parts: [{ text: 'You are Kidsko, a friendly voice tutor. Say "Hello!" in audio.' }],
          },
        },
      };
      ws.send(JSON.stringify(setupMsg));

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const pcmBuffer = Buffer.alloc(3200);
          const base64Audio = pcmBuffer.toString('base64');
          ws.send(
            JSON.stringify({
              realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64Audio }] },
            })
          );
        }
      }, 800);
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const data = JSON.parse(raw.toString());
        const parts = data?.serverContent?.modelTurn?.parts;
        if (parts && Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.inlineData?.data) {
              audioReceived = true;
              console.log(`   ✅ SUCCESS! Model "${modelName}" returned ${part.inlineData.data.length} bytes audio base64!`);
              clearTimeout(timeout);
              ws.close();
              resolve(true);
              return;
            }
          }
        }
      } catch {}
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (!audioReceived) {
        console.log(`   ❌ [${modelName}] closed: ${reason ? reason.toString() : code}`);
        resolve(false);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`   ❌ [${modelName}] error: ${err.message}`);
      resolve(false);
    });
  });
}

async function runStep2StandaloneTest() {
  console.log('🧪 ==========================================================');
  console.log('🚀 STEP 2: STANDALONE NODE TEST FOR GEMINI LIVE API STREAMING');
  console.log('🧪 ==========================================================\n');

  for (const url of URL_VERSIONS) {
    const vName = url.includes('v1beta') ? 'v1beta' : 'v1alpha';
    console.log(`👉 Testing API Version: ${vName}...`);
    for (const model of LIVE_MODELS) {
      const success = await tryConnectModel(url, model);
      if (success) {
        console.log(`\n🎉 SUCCESS with ${vName} and model ${model}!`);
        return;
      }
    }
  }

  console.error('\n❌ Could not establish BidiGenerateContent WS session with tested models.');
}

runStep2StandaloneTest();
