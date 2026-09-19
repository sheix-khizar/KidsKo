import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const serverPort = process.env.PORT || 3003;
const baseUrl = `ws://localhost:${serverPort}`;

function extractPcmFromWav(wavBuffer: Buffer): Buffer {
  const dataIndex = wavBuffer.indexOf('data');
  if (dataIndex !== -1) {
    const dataLength = wavBuffer.readUInt32LE(dataIndex + 4);
    return wavBuffer.subarray(dataIndex + 8, dataIndex + 8 + dataLength);
  }
  return wavBuffer.subarray(44);
}

async function runE2ETest() {
  console.log('🧪 ==========================================================');
  console.log('🚀 TESTING NATIVE AUDIO INPUT & INTERRUPT STREAMING E2E');
  console.log('🧪 ==========================================================');

  const wavPath = path.join(__dirname, 'canned_speech.wav');
  if (!fs.existsSync(wavPath)) {
    throw new Error(`Canned speech WAV not found at ${wavPath}`);
  }
  const wavBuffer = fs.readFileSync(wavPath);
  const speechPcm = extractPcmFromWav(wavBuffer);
  console.log(`Loaded canned speech PCM: ${speechPcm.length} bytes (~${(speechPcm.length / 32000).toFixed(2)}s @ 16kHz 16-bit mono)`);

  // Authenticate test user
  const email = 'test_audio_stream@kidsko.ai';
  const password = 'TestPassword123!';

  let { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  let userId = authUsers.users.find((u) => u.email === email)?.id;

  if (!userId) {
    const { data: created } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    userId = created.user!.id;
  }

  const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  const token = signInData.session?.access_token!;

  // Reset voice minutes
  await supabaseAdmin
    .from('family_usage')
    .upsert({ parent_id: userId, weekly_voice_minutes_used: 0.0, last_weekly_reset_at: new Date().toISOString() });

  // Connect to voice WS with inputMode=audio
  const wsUrl = `${baseUrl}/ws/voice?token=${token}&inputMode=audio`;
  console.log(`Connecting to: ${wsUrl}...`);

  const ws = new WebSocket(wsUrl);

  let isReady = false;
  let receivedAudioBytes = 0;
  let receivedTextChunks: string[] = [];
  let greetingComplete = false;
  let streamAudioStarted = false;
  let interruptTested = false;

  const testTimeout = setTimeout(() => {
    console.error('❌ Test timed out after 45 seconds!');
    ws.close();
    process.exit(1);
  }, 45000);

  ws.on('open', () => {
    console.log('✅ WebSocket connected successfully');
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === 'ready') {
      console.log(`✅ Received "ready" event. capSeconds=${msg.capSeconds}, inputMode=${msg.inputMode}`);
      if (msg.inputMode !== 'audio') {
        console.error(`❌ Expected inputMode='audio', got '${msg.inputMode}'`);
        process.exit(1);
      }
      isReady = true;
    } else if (msg.type === 'text') {
      receivedTextChunks.push(msg.data);
      console.log(`[Gemini Text Response]: "${msg.data}"`);
    } else if (msg.type === 'audio') {
      receivedAudioBytes += msg.data.length;
    } else if (msg.type === 'turn_complete') {
      console.log(`✅ Received "turn_complete" (turnId=${msg.turnId}, totalAudioReceived=${receivedAudioBytes} bytes)`);

      if (!greetingComplete) {
        greetingComplete = true;
        console.log('✅ Initial AI greeting completed!');

        // Stream canned PCM audio
        console.log('\n👉 Streaming canned 16kHz speech ("Hello Kidsko, what is two plus two?") via audio_chunk...');
        streamAudioStarted = true;
        receivedTextChunks = [];
        receivedAudioBytes = 0;

        const CHUNK_SIZE = 3200; // 100ms
        let offset = 0;

        const interval = setInterval(() => {
          if (offset < speechPcm.length) {
            const chunk = speechPcm.subarray(offset, Math.min(offset + CHUNK_SIZE, speechPcm.length));
            offset += CHUNK_SIZE;
            ws.send(JSON.stringify({
              type: 'audio_chunk',
              data: chunk.toString('base64'),
              isRawPcm: true,
            }));
          } else {
            // Send 1 second of silence (10 chunks) so server VAD detects end of speech
            let silenceCount = 0;
            const silenceInterval = setInterval(() => {
              silenceCount++;
              const silence = Buffer.alloc(CHUNK_SIZE);
              ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: silence.toString('base64'),
                isRawPcm: true,
              }));
              if (silenceCount >= 10) {
                clearInterval(silenceInterval);
                console.log('   Finished streaming speech + trailing silence.');
              }
            }, 100);
            clearInterval(interval);
          }
        }, 100);
      } else if (streamAudioStarted && !interruptTested) {
        const fullResponse = receivedTextChunks.join('');
        console.log(`✅ Gemini responded to spoken turn: "${fullResponse}"`);

        // Test interruption: send interrupt while testing
        console.log('\n👉 Testing native interrupt frame handling...');
        interruptTested = true;
        ws.send(JSON.stringify({ type: 'interrupt' }));
      }
    } else if (msg.type === 'interrupted') {
      console.log(`✅ Successfully received "interrupted" confirmation for turnId=${msg.turnId}!`);
      console.log('\n🎉 ALL PHASE 1 TESTS PASSED!');
      clearTimeout(testTimeout);
      ws.close();
      process.exit(0);
    }
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: code=${code}, reason=${reason.toString()}`);
  });
}

runE2ETest().catch((err) => {
  console.error('Fatal error in E2E test:', err);
  process.exit(1);
});
