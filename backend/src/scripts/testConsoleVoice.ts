import WebSocket from 'ws';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
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

  const { data: signInData, error: signInErr } = await supabaseAdmin.auth.signInWithPassword({ email, password });

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
        console.log(`\n🎵 [AUDIO CHUNK] Received ${msg.data.length} bytes base64 PCM audio`);
      } else if (msg.type === 'cap_reached') {
        console.log('\n🛑 [CAP REACHED] Weekly voice limit reached for this account!');
      } else if (msg.type === 'error') {
        console.error(`\n❌ [ERROR] ${msg.reason}`);
      }
    } catch {}
  });

  ws.on('close', (code, reason) => {
    console.log(`\n🔴 Connection Closed: ${code} - ${reason || 'Session ended'}`);
    rl.close();
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error(`❌ WebSocket error:`, err.message);
  });

  rl.on('line', (line) => {
    if (line.trim().toLowerCase() === 'exit') {
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
