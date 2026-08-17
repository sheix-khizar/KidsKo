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

async function testVoiceGreetingForStudent(studentName: string) {
  console.log(`\n🧪 ----------------------------------------------------------`);
  console.log(`🚀 TESTING INITIAL AI VOICE GREETING FOR: "${studentName}"`);
  console.log(`🧪 ----------------------------------------------------------`);

  // Authenticate test parent user
  const email = `test_greeting_${studentName.toLowerCase()}@kidsko.ai`;
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

  // Create or fetch student with specific display name
  const { data: existingStudent } = await supabaseAdmin
    .from('students')
    .select('id, name')
    .eq('parent_id', userId)
    .maybeSingle();

  let studentId = existingStudent?.id;
  if (!studentId) {
    const { data: newStudent } = await supabaseAdmin.from('students').insert({
      parent_id: userId,
      name: studentName,
      grade_level: 'Grade 3',
    }).select().maybeSingle();
    studentId = newStudent?.id || crypto.randomUUID();
  } else if (existingStudent && existingStudent.name !== studentName) {
    await supabaseAdmin.from('students').update({ name: studentName }).eq('id', studentId);
  }

  return new Promise<void>((resolve, reject) => {
    const socketUrl = `${baseUrl}/ws/voice?token=${token}&studentId=${studentId}`;
    console.log(`👉 Connecting to Voice WebSocket: ${socketUrl}`);

    const ws = new WebSocket(socketUrl);
    let audioChunkCount = 0;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Greeting timeout for ${studentName}`));
    }, 25000);

    ws.on('open', () => {
      console.log(`[Test WS Open]: Connected to voice socket for ${studentName}`);
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ready') {
          console.log(`[Test WS Ready]: CapSeconds = ${msg.capSeconds}s`);
        } else if (msg.type === 'audio') {
          audioChunkCount++;
          if (audioChunkCount === 1) {
            console.log(`🔊 [Test Audio Received]: First audio chunk streamed back for ${studentName}!`);
          }
        } else if (msg.type === 'turn_complete') {
          console.log(`🎉 [Test Greeting Complete]: Streamed ${audioChunkCount} audio chunks for ${studentName}'s initial greeting turn!`);
          clearTimeout(timeout);
          ws.close();
          resolve();
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

async function runGreetingVerificationSuite() {
  console.log('🧪 ==========================================================');
  console.log('🚀 INITIAL AI VOICE GREETING VERIFICATION SUITE');
  console.log('🧪 ==========================================================');

  await testVoiceGreetingForStudent('Aisha');
  await testVoiceGreetingForStudent('Taha');

  console.log('\n==========================================================');
  console.log('🎉 100% INITIAL AI VOICE GREETING SUITE PASSED PERFECTLY!');
  console.log('==========================================================\n');
}

runGreetingVerificationSuite().catch((err) => {
  console.error('Greeting verification failed:', err);
});
