import WebSocket from 'ws';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const serverPort = process.env.PORT || 3000;
const baseUrl = `ws://localhost:${serverPort}`;

async function runConsoleVoiceTest() {
  console.log('🧪 ==========================================================');
  console.log('🎙️ INTERACTIVE CONSOLE VOICE TEST (PHASE 4B)');
  console.log('🧪 ==========================================================\n');

  // Authenticate test user to get JWT token
  const email = 'test@kidsko.ai';
  const password = 'test1234';

  const { data: signInData } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  let token = signInData?.session?.access_token;
  let parentId = signInData?.session?.user?.id;

  if (!token) {
    console.log('   ℹ️ Creating test parent account for console testing...');
    await supabaseAdmin.auth.signUp({ email, password });
    const retry = await supabaseAdmin.auth.signInWithPassword({ email, password });
    token = retry.data?.session?.access_token!;
    parentId = retry.data?.session?.user?.id;
  }

  // Reset usage to 0 for active console testing
  if (parentId) {
    await supabaseAdmin.from('family_usage').upsert({ parent_id: parentId, weekly_voice_minutes_used: 0 });
  }

  const socketUrl = `${baseUrl}/ws/voice?token=${token}`;
  console.log(`👉 Connecting to Backend Voice WebSocket: ${socketUrl}\n`);

  const ws = new WebSocket(socketUrl);

  let pcmBuffers: Buffer[] = [];
  let silenceTimer: NodeJS.Timeout | null = null;

  function saveWavFile() {
    if (pcmBuffers.length === 0) return;
    const pcmData = Buffer.concat(pcmBuffers);
    const sampleRate = 24000; // Gemini Live API 24kHz output
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmData.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmData.length, 40);

    const wavBuffer = Buffer.concat([header, pcmData]);
    const outputPath = path.join(__dirname, 'output_kidsko_response.wav');
    fs.writeFileSync(outputPath, wavBuffer);

    console.log(`\n\n💾 [AUDIO SAVED] Successfully generated ${wavBuffer.length} bytes WAV file:`);
    console.log(`   📂 file:///${outputPath.replace(/\\/g, '/')}`);
    console.log(`   🎧 Open or play output_kidsko_response.wav to listen to Kidsko's voice!\n`);
    pcmBuffers = [];
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  ws.on('open', () => {
    console.log('✅ WebSocket Connected!');
    console.log('💬 Type a prompt below to speak with Kidsko (or type "exit" to quit):\n');
  });

  ws.on('message', (raw: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ready') {
        console.log(`⏱️ [SERVER READY] Session Hard Cap: ${msg.capSeconds} seconds remaining\n`);
      } else if (msg.type === 'text') {
        process.stdout.write(msg.data);
      } else if (msg.type === 'audio') {
        const chunkBuf = Buffer.from(msg.data, 'base64');
        pcmBuffers.push(chunkBuf);
        process.stdout.write('🎵');
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          saveWavFile();
        }, 1800);
      } else if (msg.type === 'cap_reached') {
        console.log('\n🛑 [CAP REACHED] Weekly voice limit reached for this account!');
        saveWavFile();
      } else if (msg.type === 'error') {
        console.error(`\n❌ [ERROR] ${msg.reason}`);
      }
    } catch {}
  });

  ws.on('close', (code, reason) => {
    saveWavFile();
    console.log(`\n🔴 Connection Closed: ${code} - ${reason || 'Session ended'}`);
    rl.close();
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error(`❌ WebSocket error:`, err.message);
  });

  rl.on('line', (line) => {
    if (line.trim().toLowerCase() === 'exit') {
      saveWavFile();
      ws.close();
      rl.close();
      process.exit(0);
    }

    if (ws.readyState === WebSocket.OPEN && line.trim().length > 0) {
      console.log(`\n🦉 Kidsko: `);
      ws.send(JSON.stringify({ type: 'text_prompt', data: line.trim() }));
    }
  });
}

runConsoleVoiceTest();
