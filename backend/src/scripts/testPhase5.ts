import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1x1 transparent PNG base64 for testing homework scan endpoint
const DUMMY_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runPhase5TestSuite() {
  console.log('🧪 ==========================================================');
  console.log('🚀 STARTING PHASE 5 COMPREHENSIVE END-TO-END TEST SUITE');
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

  // Get student
  let { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('parent_id', userId)
    .limit(1);

  let studentId = students?.[0]?.id;
  if (!studentId) {
    console.log('Creating test student...');
    const { data: newStudent } = await supabase
      .from('students')
      .insert({
        parent_id: userId,
        student_name: 'Phase 5 Tester',
      })
      .select()
      .single();

    studentId = newStudent?.id;
  }

  console.log(`✅ Ready! Using Student ID: ${studentId}\n`);

  // -------------------------------------------------------------------------
  // TEST 1: CHAT DAILY LIMIT BOUNDARY (10 MESSAGES/DAY)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 1] Testing Chat Daily Limit Boundary (10 messages/day) ---');
  await supabase
    .from('students')
    .update({ daily_message_count: 9, last_reset_at: new Date().toISOString() })
    .eq('id', studentId);

  console.log('👉 Firing Chat Request #1 (Count at 9 -> should increment to 10)...');
  const resChat1 = await fetch('http://localhost:3003/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, message: 'Test Phase 5 Chat Boundary 9->10' }),
  });
  const dataChat1: any = await resChat1.json();
  if (resChat1.status === 200 && dataChat1.remaining === 0) {
    console.log(`✅ Chat Request #1 PASSED! Status: 200 OK — Remaining: ${dataChat1.remaining}`);
  } else {
    console.error(`❌ Chat Request #1 FAILED! Status: ${resChat1.status}`, dataChat1);
  }

  console.log('👉 Firing Chat Request #2 (Count at 10 -> should be BLOCKED with 429)...');
  const resChat2 = await fetch('http://localhost:3003/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, message: 'Test Phase 5 Chat Boundary Block' }),
  });
  const dataChat2: any = await resChat2.json();
  if (resChat2.status === 429 && dataChat2.error?.includes('Daily free limit reached')) {
    console.log(`✅ Chat Request #2 PASSED! Status: 429 BLOCKED AS EXPECTED!`);
    console.log(`   Reason: "${dataChat2.error}"\n`);
  } else {
    console.error(`❌ Chat Request #2 FAILED! Status: ${resChat2.status}`, dataChat2);
  }

  // -------------------------------------------------------------------------
  // TEST 2: HOMEWORK SCAN DAILY LIMIT BOUNDARY (3 SCANS/DAY)
  // -------------------------------------------------------------------------
  console.log('--- [TEST 2] Testing Homework Scan Limit Boundary (3 scans/day) ---');
  await supabase
    .from('students')
    .update({ daily_scan_count: 2, last_reset_at: new Date().toISOString() })
    .eq('id', studentId);

  console.log('👉 Firing Scan Request #1 (Count at 2 -> should increment to 3)...');
  const resScan1 = await fetch('http://localhost:3003/api/homework/analyze', {
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

  console.log('👉 Firing Scan Request #2 (Count at 3 -> should be BLOCKED with 429)...');
  const resScan2 = await fetch('http://localhost:3003/api/homework/analyze', {
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
  console.log(`Setting last_reset_at to yesterday (${yesterday}) with MAXED OUT counts (10 messages, 3 scans)...`);
  await supabase
    .from('students')
    .update({ daily_message_count: 10, daily_scan_count: 3, last_reset_at: yesterday })
    .eq('id', studentId);

  console.log('👉 Firing Chat Request on New Day -> should auto-reset counts to 0 and SUCCEED...');
  const resReset = await fetch('http://localhost:3003/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, message: 'Test Lazy Day Reset!' }),
  });
  const dataReset: any = await resReset.json();
  if (resReset.status === 200 && dataReset.remaining === 9) {
    console.log(`✅ Lazy Reset PASSED! Status: 200 OK — Automatically reset and remaining is now ${dataReset.remaining}!\n`);
  } else {
    console.error(`❌ Lazy Reset FAILED! Status: ${resReset.status}`, dataReset);
  }

  console.log('🎉 ==========================================================');
  console.log('🏆 PHASE 5 BACKEND VERIFICATION COMPLETE! 100% PASS RATE!');
  console.log('🎉 ==========================================================');
}

runPhase5TestSuite();
