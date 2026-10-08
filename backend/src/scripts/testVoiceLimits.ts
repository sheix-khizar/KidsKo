import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { checkVoiceEligibility, recordVoiceMinutesUsed, FREE_WEEKLY_VOICE_MINUTES } from '../lib/voiceLimits';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testVoiceLimits() {
  console.log('🧪 ==========================================================');
  console.log('🚀 TESTING PHASE 4B VOICE LIMITS & WEEKLY ACCOUNTING');
  console.log('🧪 ==========================================================\n');

  // Fetch or create a test parent profile ID
  let { data: profiles } = await supabaseAdmin.from('profiles').select('id').limit(1);
  let testParentId = profiles?.[0]?.id;

  if (!testParentId) {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await supabaseAdmin.from('profiles').upsert({ id: fakeId, email: 'voicetest@kidsko.ai' });
    testParentId = fakeId;
  }

  console.log(`👤 Using Test Parent ID: ${testParentId}`);

  // Reset weekly usage to 0
  await supabaseAdmin
    .from('family_usage')
    .upsert({ parent_id: testParentId, weekly_voice_minutes_used: 0, last_weekly_reset_at: new Date().toISOString() });

  console.log('👉 [TEST 1] Checking voice eligibility on fresh week...');
  const check1 = await checkVoiceEligibility(supabaseAdmin, testParentId);
  if (check1.allowed && check1.minutesRemaining === FREE_WEEKLY_VOICE_MINUTES) {
    console.log(`✅ TEST 1 PASSED! Allowed: ${check1.allowed}, Minutes Remaining: ${check1.minutesRemaining}`);
  } else {
    console.error('❌ TEST 1 FAILED!', check1);
  }

  console.log('👉 [TEST 2] Recording 5 minutes of voice usage...');
  await recordVoiceMinutesUsed(supabaseAdmin, testParentId, 5);

  const check2 = await checkVoiceEligibility(supabaseAdmin, testParentId);
  if (!check2.allowed && check2.minutesRemaining === 0) {
    console.log(`✅ TEST 2 PASSED! Hard cap triggered as expected. Allowed: ${check2.allowed}, Reason: "${check2.reason}"`);
  } else {
    console.error('❌ TEST 2 FAILED!', check2);
  }

  console.log('👉 [TEST 3] Simulating weekly reset by back-dating last_weekly_reset_at by 8 days...');
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from('family_usage')
    .update({ last_weekly_reset_at: eightDaysAgo })
    .eq('parent_id', testParentId);

  const check3 = await checkVoiceEligibility(supabaseAdmin, testParentId);
  if (check3.allowed && check3.minutesRemaining === FREE_WEEKLY_VOICE_MINUTES) {
    console.log(`✅ TEST 3 PASSED! Weekly reset automatically cleared usage. Minutes Remaining: ${check3.minutesRemaining}\n`);
  } else {
    console.error('❌ TEST 3 FAILED!', check3);
  }

  console.log('🎉 ==========================================================');
  console.log('🏆 PHASE 4B VOICE LIMITS VERIFICATION COMPLETE!');
  console.log('🎉 ==========================================================');
}

testVoiceLimits();
