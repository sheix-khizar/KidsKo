import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const apiKey = process.env.GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY_PROD;
const ai = new GoogleGenAI({ apiKey });

const serverPort = process.env.PORT || 3003;
const baseUrl = `ws://localhost:${serverPort}`;

async function runE2ETest() {
  console.log('🧪 ==========================================================');
  console.log('📹 TESTING LIVE CAMERA STREAMING E2E (TICKET 6 VERIFICATION)');
  console.log('🧪 ==========================================================\n');

  // 1. Authenticate test user
  const email = 'test@kidsko.ai';
  const password = 'test1234';

  const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  let token = signInData?.session?.access_token;
  let parentId = signInData?.session?.user?.id;

  if (!token) {
    console.log('Creating test user...');
    await supabaseAdmin.auth.signUp({ email, password });
    const retry = await supabaseAdmin.auth.signInWithPassword({ email, password });
    token = retry.data?.session?.access_token!;
    parentId = retry.data?.session?.user?.id;
  }

  if (parentId) {
    await supabaseAdmin.from('family_usage').upsert({ parent_id: parentId, weekly_voice_minutes_used: 0 });
  }

  console.log('✅ Authenticated test user token acquired.');

  // 2. Prepare test video frames (SVG rendered to JPEG with clear text: "5 + 7 = 12")
  const svgBuffer = Buffer.from(`
    <svg width="400" height="300">
      <rect width="100%" height="100%" fill="#FFD700" />
      <text x="50" y="160" font-size="44" font-family="Arial" font-weight="bold" fill="#000000">5 + 7 = 12</text>
    </svg>
  `);
  const frameJpeg = await sharp(svgBuffer).jpeg({ quality: 60 }).toBuffer();
  const frameBase64 = frameJpeg.toString('base64');

  const socketUrl = `${baseUrl}/ws/voice?token=${token}`;
  console.log(`🔌 Connecting to Backend Voice WebSocket: ${socketUrl}`);

  const ws = new WebSocket(socketUrl);

  let pcmChunks: Buffer[] = [];
  let isReady = false;
  let streamInterval: NodeJS.Timeout | null = null;
  let framesSent = 0;
  let receivedTurnCount = 0;

  ws.on('open', () => {
    console.log('📡 Connected to /ws/voice WebSocket!');
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ready') {
        console.log(`✅ Session ready! Cap=${msg.capSeconds}s. Starting camera frame stream...`);
        isReady = true;

        // Stream 1 frame every 1.5s (simulating mobile camera view)
        streamInterval = setInterval(() => {
          framesSent++;
          ws.send(JSON.stringify({ type: 'camera_frame', data: frameBase64 }));
          console.log(`📸 [Client Sent camera_frame #${framesSent}]`);
        }, 1500);

        // After 4 frames (6 seconds), ask the first question
        setTimeout(() => {
          console.log('\n🗣️ [User Turn 1]: "Kidsko, what math equation do you see on my camera?"');
          ws.send(JSON.stringify({
            type: 'text_prompt',
            data: 'What math equation is written on the yellow card on my camera?',
            turnId: 1
          }));
        }, 6000);
      } else if (msg.type === 'audio') {
        pcmChunks.push(Buffer.from(msg.data, 'base64'));
      } else if (msg.type === 'turn_complete') {
        receivedTurnCount++;
        console.log(`\n🎉 [Turn #${receivedTurnCount} Complete] Collected ${pcmChunks.length} audio chunks.`);

        // Save WAV file of turn
        const pcmData = Buffer.concat(pcmChunks);
        pcmChunks = [];

        const wavPath = path.join(__dirname, `turn_${receivedTurnCount}_response.wav`);
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + pcmData.length, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(24000, 24);
        header.writeUInt32LE(24000 * 2, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(pcmData.length, 40);

        fs.writeFileSync(wavPath, Buffer.concat([header, pcmData]));
        console.log(`💾 Saved audio turn to ${wavPath}`);

        // Transcribe audio using Gemini to verify content
        try {
          const uploadRes = await ai.models.generateContent({
            model: 'models/gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: 'audio/wav', data: fs.readFileSync(wavPath).toString('base64') } },
                  { text: 'Transcribe verbatim what the speaker says in this audio clip. Reply with only the transcript.' }
                ]
              }
            ]
          });
          console.log(`🎙️ TRANSCRIPT OF KIDSKO'S VOICE: "${uploadRes.text?.trim()}"\n`);
        } catch (transcribeErr: any) {
          console.warn('Transcription warning:', transcribeErr.message);
        }

        if (receivedTurnCount === 1) {
          // Send follow up turn while camera continues streaming to verify multi-turn persistence
          setTimeout(() => {
            console.log('🗣️ [User Turn 2 (Follow-up)]: "What is the answer to that problem?"');
            ws.send(JSON.stringify({
              type: 'text_prompt',
              data: 'What is the answer to that math problem?',
              turnId: 2
            }));
          }, 3000);
        } else if (receivedTurnCount === 2) {
          console.log('🏆 All turns completed successfully!');
          if (streamInterval) clearInterval(streamInterval);
          ws.close(1000, 'Test completed');
          process.exit(0);
        }
      } else if (msg.type === 'error') {
        console.error('❌ Server sent error message:', msg.reason);
        process.exit(1);
      }
    } catch (err: any) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`\n🛑 WebSocket Closed: Code=${code}, Reason="${reason.toString()}"`);
    if (streamInterval) clearInterval(streamInterval);
    if (code !== 1000) {
      console.error('❌ FAILED: Unexpected close code');
      process.exit(1);
    }
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
    process.exit(1);
  });
}

runE2ETest();
