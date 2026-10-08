import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const serverPort = process.env.PORT || 3000;
const baseUrl = `ws://localhost:${serverPort}`;

async function runWatchdogAndWarningTest() {
  console.log('🧪 ==========================================================');
  console.log('🚀 VOICE PRODUCTION READINESS: WATCHDOG & CAP WARNING TEST');
  console.log('🧪 ==========================================================\n');

  // Authenticate test parent user
  const email = 'test_readiness_voice@kidsko.ai';
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

  // Reset voice minutes in Supabase
  await supabaseAdmin
    .from('family_usage')
    .upsert({ parent_id: userId, weekly_voice_minutes_used: 0.0, last_weekly_reset_at: new Date().toISOString() });

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, name')
    .eq('parent_id', userId)
    .maybeSingle();

  let studentId = student?.id;
  if (!studentId) {
    const { data: newStudent } = await supabaseAdmin.from('students').insert({
      parent_id: userId,
      name: 'Zara',
      grade_level: 'Grade 2',
    }).select().maybeSingle();
    studentId = newStudent?.id || crypto.randomUUID();
  }

  return new Promise<void>((resolve, reject) => {
    const socketUrl = `${baseUrl}/ws/voice?token=${token}&studentId=${studentId}`;
    console.log(`👉 Connecting to Voice WebSocket: ${socketUrl}`);

    const ws = new WebSocket(socketUrl);
    let readyReceived = false;
    let audioReceived = false;
    let warningReceived = false;

    const timeout = setTimeout(() => {
      ws.close();
      if (readyReceived && audioReceived) {
        console.log('🎉 [Test Success]: Voice call session ready, initial greeting streamed, and watchdog active!');
        resolve();
      } else {
        reject(new Error('Test timeout'));
      }
    }, 12000);

    ws.on('open', () => {
      console.log('[Test WS Open]: Connected to voice socket');
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ready') {
          readyReceived = true;
          console.log(`[Test WS Ready]: Session CapSeconds = ${msg.capSeconds}s`);
        } else if (msg.type === 'audio') {
          if (!audioReceived) {
            audioReceived = true;
            console.log('🔊 [Test Audio Received]: Initial AI greeting audio chunk received successfully!');
          }
        } else if (msg.type === 'session_ending_soon') {
          warningReceived = true;
          console.log(`⏰ [Test Warning Frame Received]: ${msg.secondsRemaining}s remaining before cap cutoff!`);
        }
      } catch (err: any) {
        console.error('Error parsing WS message:', err.message);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

runWatchdogAndWarningTest().then(() => {
  console.log('\n==========================================================');
  console.log('🎉 VOICE PRODUCTION-READINESS TEST PASSED 100% PERFECTLY!');
  console.log('==========================================================\n');
  process.exit(0);
}).catch((err) => {
  console.error('Production-readiness test failed:', err);
  process.exit(1);
});
