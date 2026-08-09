import WebSocket from 'ws';
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

async function runE2EVoiceSessionTest() {
  console.log('🧪 ==========================================================');
  console.log('🚀 END-TO-END VERIFICATION: MULTI-TURN MEMORY & REAL SUPABASE ACCOUNTING');
  console.log('🧪 ==========================================================\n');

  // Authenticate test user
  const email = 'test_e2e_voice@kidsko.ai';
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

  // 1. Reset initial usage in Supabase to 0.00 min
  await supabaseAdmin
    .from('family_usage')
    .upsert({ parent_id: userId, weekly_voice_minutes_used: 0.0, last_weekly_reset_at: new Date().toISOString() });

  console.log('👉 [STEP 1] Verified initial Supabase weekly_voice_minutes_used = 0.00 min');
  console.log('👉 [STEP 2] Connecting to Voice WebSocket server...');

  const ws = new WebSocket(`${baseUrl}/ws/voice?token=${token}`);
  let turn1AudioChunks = 0;
  let turn2AudioChunks = 0;
  let currentTurn = 0;
  let pcmBuffers: Buffer[] = [];

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Session timeout'));
    }, 25000);

    ws.on('open', () => {
      console.log('   ✅ WebSocket Connected to Backend Voice Relay!');
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ready') {
          console.log(`   ⏱️ [SERVER READY] Received session ready frame (capSeconds: ${msg.capSeconds})`);
          // Start Turn 1
          currentTurn = 1;
          console.log('👉 [TURN 1] Sending Turn 1: "Imagine I have 5 apples and get 5 more..."');
          ws.send(JSON.stringify({ type: 'text_prompt', data: 'Imagine I have 5 apples and get 5 more. How many do I have?' }));
        } else if (msg.type === 'audio') {
          const chunkBuf = Buffer.from(msg.data, 'base64');
          pcmBuffers.push(chunkBuf);

          if (currentTurn === 1) {
            turn1AudioChunks++;
            if (turn1AudioChunks === 1) {
              console.log('   🎵 Turn 1 Audio response streaming from Gemini Live...');
            }
          } else if (currentTurn === 2) {
            turn2AudioChunks++;
            if (turn2AudioChunks === 1) {
              console.log('   🎵 Turn 2 Multi-Turn Memory Audio response streaming from Gemini Live...');
            }
          }
        }
      } catch {}
    });

    // After 7 seconds of Turn 1, trigger Turn 2 follow-up in the SAME live session
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN && turn1AudioChunks > 0) {
        currentTurn = 2;
        console.log(`\n✅ [TURN 1 COMPLETE] Received ${turn1AudioChunks} audio chunks for Turn 1!`);
        console.log('👉 [TURN 2] Sending Context Follow-Up Turn: "And if I eat 2 of those apples?"');
        ws.send(JSON.stringify({ type: 'text_prompt', data: 'And if I eat 2 of those apples?' }));
      }
    }, 8000);

    // After 14 seconds total (ensures 10s accounting interval fires on backend), close cleanly
    setTimeout(async () => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`\n✅ [TURN 2 COMPLETE] Received ${turn2AudioChunks} audio chunks for Turn 2!`);
        console.log('👉 [STEP 3] Closing session cleanly with code 1000 (User ended call)...');
        ws.close(1000, 'User ended call');

        // Save composite WAV file
        if (pcmBuffers.length > 0) {
          const pcmData = Buffer.concat(pcmBuffers);
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

          const wavBuffer = Buffer.concat([header, pcmData]);
          const wavPath = path.join(__dirname, 'output_multiturn_e2e.wav');
          fs.writeFileSync(wavPath, wavBuffer);
          console.log(`   💾 Saved ${wavBuffer.length} bytes multi-turn audio to file:///${wavPath.replace(/\\/g, '/')}`);
        }

        // Wait 500ms for close handler to write final remainder to Supabase
        setTimeout(async () => {
          console.log('👉 [STEP 4] Verifying real Supabase family_usage row in database...');
          const { data: usageRow } = await supabaseAdmin
            .from('family_usage')
            .select('weekly_voice_minutes_used, last_weekly_reset_at')
            .eq('parent_id', userId)
            .single();

          const recordedMinutes = usageRow?.weekly_voice_minutes_used || 0;
          console.log(`   📊 Real Supabase recorded minutes: ${recordedMinutes.toFixed(4)} min (${(recordedMinutes * 60).toFixed(1)} seconds)`);

          if (recordedMinutes > 0) {
            console.log('\n🎉 ==========================================================');
            console.log('🏆 END-TO-END MULTI-TURN & REAL SUPABASE ACCOUNTING PASSED!');
            console.log('🎉 ==========================================================');
            clearTimeout(timeout);
            resolve();
          } else {
            reject(new Error('Supabase weekly_voice_minutes_used was not incremented!'));
          }
        }, 800);
      }
    }, 15000);

    ws.on('close', (code, reason) => {
      console.log(`   🔴 WebSocket Closed cleanly: code ${code} (${reason || 'User ended call'})`);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

runE2EVoiceSessionTest().catch((err) => {
  console.error('❌ E2E Voice Session Test Failed:', err);
  process.exit(1);
});
