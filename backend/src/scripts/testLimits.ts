import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('🧪 Starting Precise Rate Limit Verification...\n');

  const emailArg = process.argv[2];
  const passwordArg = process.argv[3];

  if (!emailArg || !passwordArg) {
    console.log('❌ Please pass your Kidsko login email and password as arguments:');
    console.log('   Usage: npx ts-node src/scripts/testLimits.ts YOUR_EMAIL YOUR_PASSWORD');
    return;
  }

  console.log(`Signing in as ${emailArg}...`);
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
        student_name: 'Limit Tester',
      })
      .select()
      .single();

    studentId = newStudent?.id;
  }

  console.log(`✅ Ready! Testing with Student ID: ${studentId}\n`);

  // Test RLS update policy by setting count to 9 (1 request away from the 10 limit)
  console.log('Setting student daily_message_count to 9 (borderline limit)...');
  const updateRes = await supabase
    .from('students')
    .update({ daily_message_count: 9, last_reset_at: new Date().toISOString() })
    .eq('id', studentId)
    .select();

  if (!updateRes.data || updateRes.data.length === 0) {
    console.error('\n🛑 RLS UPDATE POLICY MISSING ON STUDENTS TABLE!');
    console.error('Your Supabase database is preventing usage counters from updating.');
    console.error('Please open your Supabase Dashboard -> SQL Editor and run this query:\n');
    console.error(`
create policy "Users can update own students"
  on public.students for update
  using (auth.uid() = parent_id);
`);
    return;
  }

  // Fire Request #1 (should succeed and increment count from 9 to 10)
  console.log('Firing Request #1 (should increment count 9 -> 10)...');
  const res1 = await fetch('http://localhost:3003/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, message: 'Test message at count 9' }),
  });
  const data1: any = await res1.json();
  console.log(`🟢 Request #1 Status: ${res1.status} OK — Remaining Free Messages: ${data1.remaining}`);

  // Fire Request #2 (should get blocked with 429 DAILY LIMIT REACHED!)
  console.log('\nFiring Request #2 (should be BLOCKED by 10/day limit)...');
  const res2 = await fetch('http://localhost:3003/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentId, message: 'Test message at count 10' }),
  });
  const data2: any = await res2.json();

  if (res2.status === 429 && !data2.error?.includes('Slow down')) {
    console.log(`\n🛑 Request #2 Status: 429 TOO MANY REQUESTS (BLOCKED AS EXPECTED!)`);
    console.log(`   Server reason: "${data2.error}"`);
    console.log(`   Remaining: ${data2.remaining}, isPremium: ${data2.isPremium}`);
    console.log('\n🎉 100% Verified! Daily limit enforcement is working perfectly without triggering spam filters!');
  } else {
    console.log(`⚠️ Unexpected Response #2: Status ${res2.status}`, data2);
  }
}

runTest();
