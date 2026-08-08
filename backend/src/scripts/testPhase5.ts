import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

const DUMMY_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runPhase5TestSuite() {
  console.log('🧪 ==========================================================');
  console.log('🚀 STARTING PHASE 5 UPDATED END-TO-END TEST SUITE (POOLED)');
  console.log('🧪 ==========================================================\n');

  const emailArg = process.argv[2];
  const passwordArg = process.argv[3];

  if (!emailArg || !passwordArg) {
    console.log('❌ Please pass your Kidsko login email and password as arguments:');
    console.log('   Usage: npx ts-node src/scripts/testPhase5.ts YOUR_EMAIL YOUR_PASSWORD');
    return;
  }

  console.log(`🔐 Signing in as ${emailArg}...`);
  const signInRes = await supabase.auth.signInWithPassword({
    email: emailArg,
    password: passwordArg,
  });

  const token = signInRes.data.session?.access_token;
  const userId = signInRes.data.user?.id;

  if (!token || !userId) {
    console.error('❌ Could not sign in:', signInRes.error?.message);
    return;
  }

  // Ensure profiles row exists (using admin service role client to bypass RLS for test setup)
  const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({ id: userId, email: emailArg });
  if (profileErr) {
    console.error('⚠️ Could not upsert profile:', profileErr.message);
  }

  // Get or create test student
  let { data: students } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('parent_id', userId)
    .limit(1);

  let studentId = students?.[0]?.id;
  if (!studentId) {
    console.log('Creating test student...');
    const { data: newStudent, error: createStudentErr } = await supabaseAdmin
      .from('students')
      .insert({ parent_id: userId, student_name: 'Phase 5 Tester' })
      .select()
      .single();

    if (createStudentErr) {
      console.error('❌ Failed to create student:', createStudentErr.message);
      return;
    }
    studentId = newStudent?.id;
  }

  console.log(`✅ Ready! Parent ID: ${userId} | Student ID: ${studentId}\n`);

  const serverPort = process.env.PORT || 3000;
  const baseUrl = `http://localhost:${serverPort}`;

  // -------------------------------------------------------------------------
  // TEST 1: POOLED CHAT LIMIT BOUNDARY (30 MESSAGES/DAY ON FAMILY_USAGE)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 1] Testing Pooled Family Chat Limit (30 messages/day) ---');
  const { error: upsert1Err } = await supabaseAdmin
    .from('family_usage')
    .upsert({ parent_id: userId, daily_message_count: 29, last_daily_reset_at: new Date().toISOString() });

  if (upsert1Err) {
    console.error('❌ Failed to prepare family_usage row for TEST 1:', upsert1Err.message);
  }

  console.log('👉 Firing Chat Request #1 (Count at 29 -> should increment to 30)...');
  const resChat1 = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, message: 'Test Pooled Chat Limit 29->30' }),
  });
  const dataChat1: any = await resChat1.json();
  if (resChat1.status === 200 && dataChat1.remaining === 0) {
    console.log(`✅ Chat Request #1 PASSED! Status: 200 OK — Remaining: ${dataChat1.remaining}`);
  } else {
    console.error(`❌ Chat Request #1 FAILED! Status: ${resChat1.status}`, dataChat1);
  }

  console.log('👉 Firing Chat Request #2 (Count at 30 -> should be BLOCKED with 429)...');
  const resChat2 = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, message: 'Test Pooled Chat Boundary Block' }),
  });
  const dataChat2: any = await resChat2.json();
  if (resChat2.status === 429 && dataChat2.error?.includes('Daily free limit reached')) {
    console.log(`✅ Chat Request #2 PASSED! Status: 429 BLOCKED AS EXPECTED!`);
    console.log(`   Reason: "${dataChat2.error}"\n`);
  } else {
    console.error(`❌ Chat Request #2 FAILED! Status: ${resChat2.status}`, dataChat2);
  }

  // -------------------------------------------------------------------------
  // TEST 2: POOLED HOMEWORK SCAN LIMIT BOUNDARY (5 SCANS/DAY ON FAMILY_USAGE)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 2] Testing Pooled Family Scan Limit (5 scans/day) ---');
  const { error: upsert2Err } = await supabaseAdmin
    .from('family_usage')
    .upsert({ parent_id: userId, daily_scan_count: 4, last_daily_reset_at: new Date().toISOString() });

  if (upsert2Err) {
    console.error('❌ Failed to prepare family_usage row for TEST 2:', upsert2Err.message);
  }

  console.log('👉 Firing Scan Request #1 (Count at 4 -> should increment to 5)...');
  const resScan1 = await fetch(`${baseUrl}/api/homework/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, imageBase64: DUMMY_IMAGE_BASE64 }),
  });
  const dataScan1: any = await resScan1.json();
  if (resScan1.status === 200 && dataScan1.remaining === 0) {
    console.log(`✅ Scan Request #1 PASSED! Status: 200 OK — Remaining: ${dataScan1.remaining}`);
  } else {
    console.error(`❌ Scan Request #1 FAILED! Status: ${resScan1.status}`, dataScan1);
  }

  console.log('👉 Firing Scan Request #2 (Count at 5 -> should be BLOCKED with 429)...');
  const resScan2 = await fetch(`${baseUrl}/api/homework/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, imageBase64: DUMMY_IMAGE_BASE64 }),
  });
  const dataScan2: any = await resScan2.json();
  if (resScan2.status === 429 && dataScan2.error?.includes('Daily free limit reached')) {
    console.log(`✅ Scan Request #2 PASSED! Status: 429 BLOCKED AS EXPECTED!`);
    console.log(`   Reason: "${dataScan2.error}"\n`);
  } else {
    console.error(`❌ Scan Request #2 FAILED! Status: ${resScan2.status}`, dataScan2);
  }

  // -------------------------------------------------------------------------
  // TEST 3: LAZY DAILY RESET (NEW UTC DAY)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 3] Testing Lazy Daily Reset (Simulating a new day) ---');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error: upsert3Err } = await supabaseAdmin
    .from('family_usage')
    .upsert({ parent_id: userId, daily_message_count: 30, daily_scan_count: 5, last_daily_reset_at: yesterday });

  if (upsert3Err) {
    console.error('❌ Failed to prepare family_usage row for TEST 3:', upsert3Err.message);
  }

  console.log('👉 Firing Chat Request on New Day -> should auto-reset counts to 0 and SUCCEED...');
  const resReset = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, message: 'Test Lazy Day Reset!' }),
  });
  const dataReset: any = await resReset.json();
  if (resReset.status === 200 && dataReset.remaining === 29) {
    console.log(`✅ Lazy Reset PASSED! Status: 200 OK — Remaining reset to ${dataReset.remaining}!\n`);
  } else {
    console.error(`❌ Lazy Reset FAILED! Status: ${resReset.status}`, dataReset);
  }

  // -------------------------------------------------------------------------
  // TEST 4: WEBHOOK SECURITY CHECK (REJECT UNAUTHORIZED REQUESTS)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 4] Testing RevenueCat Webhook Security ---');
  const resWebhook = await fetch(`${baseUrl}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: { app_user_id: userId, type: 'INITIAL_PURCHASE' } }),
  });
  if (resWebhook.status === 401) {
    console.log(`✅ Webhook Security PASSED! Unauthenticated request blocked with 401 Unauthorized!\n`);
  } else {
    console.error(`❌ Webhook Security FAILED! Status: ${resWebhook.status}`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: FREE PARENT TRANSCRIPT ACCESS
  // -------------------------------------------------------------------------
  console.log('--- [TEST 5] Testing Free Parent Transcript Endpoint ---');
  const resTranscript = await fetch(`${baseUrl}/api/transcript/${studentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dataTranscript: any = await resTranscript.json();
  if (resTranscript.status === 200 && Array.isArray(dataTranscript.messages)) {
    console.log(`✅ Transcript Endpoint PASSED! Status: 200 OK — Messages fetched: ${dataTranscript.messages.length}\n`);
  } else {
    console.error(`❌ Transcript Endpoint FAILED! Status: ${resTranscript.status}`, dataTranscript);
  }

  console.log('🎉 ==========================================================');
  console.log('🏆 PHASE 5 POOLED TEST SUITE COMPLETE!');
  console.log('🎉 ==========================================================');
}

runPhase5TestSuite();
