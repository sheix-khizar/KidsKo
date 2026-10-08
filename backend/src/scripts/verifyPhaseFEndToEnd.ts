import dotenv from 'dotenv';
import path from 'path';
import { supabaseAdmin } from '../lib/supabase';
import {
  checkAndIncrementUsage,
  FREE_WEEKLY_MESSAGE_LIMIT,
  FREE_WEEKLY_SCAN_LIMIT,
  PREMIUM_WEEKLY_MESSAGE_LIMIT,
  PREMIUM_WEEKLY_SCAN_LIMIT,
} from '../lib/usageLimits';
import {
  checkVoiceEligibility,
  recordVoiceMinutesUsed,
  FREE_WEEKLY_VOICE_MINUTES,
  PREMIUM_WEEKLY_VOICE_MINUTES,
} from '../lib/voiceLimits';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function getOrCreateTestUser(email: string, isPremium: boolean): Promise<string> {
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
  let user = usersData?.users.find((u) => u.email === email);
  if (!user) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (error) throw error;
    user = created.user;
  }
  await supabaseAdmin.from('profiles').upsert({
    id: user.id,
    email,
    is_premium: isPremium,
  });
  return user.id;
}

async function runPhaseFVerification() {
  console.log('================================================================================');
  console.log('🚀 KIDSKO MASTER PLAN V6 — PHASE F: END-TO-END VERIFICATION SUITE');
  console.log('================================================================================\n');

  const freeUserEmail = 'verify_free_phase_f@kidsko.ai';
  const premiumUserEmail = 'verify_premium_phase_f@kidsko.ai';

  console.log('⏳ Setting up isolated test accounts...');
  const freeParentId = await getOrCreateTestUser(freeUserEmail, false);
  const premiumParentId = await getOrCreateTestUser(premiumUserEmail, true);
  console.log(`  👤 Free Test User: ${freeParentId}`);
  console.log(`  ⭐ Premium Test User: ${premiumParentId}\n`);

  // Clean usage rows
  await supabaseAdmin.from('family_usage').delete().in('parent_id', [freeParentId, premiumParentId]);

  // -----------------------------------------------------------------------------
  // CHECK 1: Fresh Free-Tier Voice & Video 10-Minute Weekly Cap
  // -----------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------');
  console.log('🔍 CHECK 1: Fresh Free-Tier Voice & Video Weekly Cap (10 minutes)');
  console.log('--------------------------------------------------------------------------------');

  assert(FREE_WEEKLY_VOICE_MINUTES === 10, 'FREE_WEEKLY_VOICE_MINUTES constant equals 10');

  // 1a. Fresh week check
  const vCheckFresh = await checkVoiceEligibility(supabaseAdmin, freeParentId);
  assert(vCheckFresh.allowed === true, 'Fresh free user is allowed voice & video');
  assert(vCheckFresh.minutesRemaining === 10, 'Fresh free user starts with exactly 10 minutes');

  // 1b. Simulate 9.5 minutes of conversation
  await recordVoiceMinutesUsed(supabaseAdmin, freeParentId, 9.5);
  const vCheck95 = await checkVoiceEligibility(supabaseAdmin, freeParentId);
  assert(vCheck95.allowed === true, 'Voice & video allowed when 0.5 minutes remain');
  assert(Math.abs(vCheck95.minutesRemaining - 0.5) < 0.001, 'Remaining time is accurately 0.5 minutes');

  // 1c. Push to 10.0+ minutes (exceed cap)
  await recordVoiceMinutesUsed(supabaseAdmin, freeParentId, 0.6);
  const vCheckBlocked = await checkVoiceEligibility(supabaseAdmin, freeParentId);
  assert(vCheckBlocked.allowed === false, 'Free user is blocked after exceeding 10 minutes');
  assert(vCheckBlocked.minutesRemaining === 0, 'Remaining minutes reported as 0');
  assert(
    vCheckBlocked.reason?.includes('10 min/week') && vCheckBlocked.reason?.includes('voice & video'),
    `Block reason cites "10 min/week" and "voice & video" (Got: "${vCheckBlocked.reason}")`
  );

  // 1d. Weekly reset verification (back-dating reset timestamp by 8 days)
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from('family_usage')
    .update({ last_weekly_reset_at: eightDaysAgo })
    .eq('parent_id', freeParentId);

  const vCheckReset = await checkVoiceEligibility(supabaseAdmin, freeParentId);
  assert(vCheckReset.allowed === true, 'Usage resets automatically after 7+ days (lazy reset)');
  assert(vCheckReset.minutesRemaining === 10, 'Minutes restored back to 10 on new week');

  // -----------------------------------------------------------------------------
  // CHECK 2: Free-Tier Message (30/wk) & Homework Scan (3/wk) Boundaries
  // -----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('🔍 CHECK 2: Free-Tier Chat Messages (30/wk) & Homework Scans (3/wk) Boundaries');
  console.log('--------------------------------------------------------------------------------');

  assert(FREE_WEEKLY_MESSAGE_LIMIT === 30, 'FREE_WEEKLY_MESSAGE_LIMIT constant equals 30');
  assert(FREE_WEEKLY_SCAN_LIMIT === 3, 'FREE_WEEKLY_SCAN_LIMIT constant equals 3');

  // Set message count to 29
  await supabaseAdmin
    .from('family_usage')
    .update({ daily_message_count: 29, daily_scan_count: 0 })
    .eq('parent_id', freeParentId);

  // 30th message: allowed, remaining 0
  const msg30 = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'message');
  assert(msg30.allowed === true, '30th free message is allowed');
  assert(msg30.remaining === 0, '30th message leaves 0 remaining');

  // 31st message: blocked
  const msg31 = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'message');
  assert(msg31.allowed === false, '31st free message is blocked');
  assert(msg31.reason?.includes('30 messages/week'), `Block reason specifies 30 messages/week: "${msg31.reason}"`);

  // Set scan count to 2
  await supabaseAdmin
    .from('family_usage')
    .update({ daily_scan_count: 2 })
    .eq('parent_id', freeParentId);

  // 3rd scan: allowed, remaining 0
  const scan3 = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'scan');
  assert(scan3.allowed === true, '3rd free scan is allowed');
  assert(scan3.remaining === 0, '3rd scan leaves 0 remaining');

  // 4th scan: blocked
  const scan4 = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'scan');
  assert(scan4.allowed === false, '4th free scan is blocked');
  assert(scan4.reason?.includes('3 homework scans/week'), `Block reason specifies 3 homework scans/week: "${scan4.reason}"`);

  // -----------------------------------------------------------------------------
  // CHECK 3: Premium Tier Upgrade & Explicit Ceilings (100 min, 200 msgs, 15 scans)
  // -----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('🔍 CHECK 3: Premium Tier Upgrade & Explicit Weekly Ceilings');
  console.log('--------------------------------------------------------------------------------');

  assert(PREMIUM_WEEKLY_VOICE_MINUTES === 100, 'PREMIUM_WEEKLY_VOICE_MINUTES constant equals 100');
  assert(PREMIUM_WEEKLY_MESSAGE_LIMIT === 200, 'PREMIUM_WEEKLY_MESSAGE_LIMIT constant equals 200');
  assert(PREMIUM_WEEKLY_SCAN_LIMIT === 15, 'PREMIUM_WEEKLY_SCAN_LIMIT constant equals 15');

  // 3a. Premium Voice & Video: Fresh 100 minutes
  const premVoiceFresh = await checkVoiceEligibility(supabaseAdmin, premiumParentId);
  assert(premVoiceFresh.allowed === true, 'Premium account is allowed voice & video');
  assert(premVoiceFresh.isPremium === true, 'Profile correctly flagged as isPremium: true');
  assert(premVoiceFresh.minutesRemaining === 100, 'Premium starts with exactly 100 weekly minutes');

  // 3b. Premium Voice & Video: At ceiling (100 min used)
  await recordVoiceMinutesUsed(supabaseAdmin, premiumParentId, 100);
  const premVoiceCapped = await checkVoiceEligibility(supabaseAdmin, premiumParentId);
  assert(premVoiceCapped.allowed === false, 'Premium voice & video is capped at 100 min (NOT silently unlimited)');
  assert(
    premVoiceCapped.reason?.includes('100 min/week'),
    `Premium block reason cites 100 min/week: "${premVoiceCapped.reason}"`
  );

  // 3c. Premium Messages: 200 weekly cap
  await supabaseAdmin
    .from('family_usage')
    .update({ daily_message_count: 199, daily_scan_count: 14 })
    .eq('parent_id', premiumParentId);

  // 200th message allowed
  const premMsg200 = await checkAndIncrementUsage(supabaseAdmin, premiumParentId, 'message');
  assert(premMsg200.allowed === true, '200th message allowed on Premium');
  assert(premMsg200.remaining === 0, '200th message leaves 0 remaining');

  // 201st message blocked
  const premMsg201 = await checkAndIncrementUsage(supabaseAdmin, premiumParentId, 'message');
  assert(premMsg201.allowed === false, '201st message blocked on Premium (explicit ceiling enforced)');
  assert(
    premMsg201.reason?.includes('200 messages/week on Premium'),
    `Block reason cites 200 messages/week on Premium: "${premMsg201.reason}"`
  );

  // 3d. Premium Scans: 15 weekly cap
  // 15th scan allowed
  const premScan15 = await checkAndIncrementUsage(supabaseAdmin, premiumParentId, 'scan');
  assert(premScan15.allowed === true, '15th scan allowed on Premium');
  assert(premScan15.remaining === 0, '15th scan leaves 0 remaining');

  // 16th scan blocked
  const premScan16 = await checkAndIncrementUsage(supabaseAdmin, premiumParentId, 'scan');
  assert(premScan16.allowed === false, '16th scan blocked on Premium (explicit ceiling enforced)');
  assert(
    premScan16.reason?.includes('15 homework scans/week on Premium'),
    `Block reason cites 15 scans/week on Premium: "${premScan16.reason}"`
  );

  // -----------------------------------------------------------------------------
  // CHECK 4: Live Video & Voice Contract Stability
  // -----------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('🔍 CHECK 4: Live Video & Call Contract Stability');
  console.log('--------------------------------------------------------------------------------');

  console.log('  Testing voiceSocketServer and Gemini Live modules...');
  const geminiLive = await import('../lib/geminiLive');
  assert(typeof geminiLive.startLiveSession === 'function', 'startLiveSession is exported and intact');
  assert(typeof geminiLive.sendVideoChunk === 'function', 'sendVideoChunk (live video streaming) is exported and intact');

  const voiceServer = await import('../lib/voiceSocketServer');
  assert(typeof voiceServer.attachVoiceSocketServer === 'function', 'attachVoiceSocketServer is exported and intact');

  // Cleanup test rows
  await supabaseAdmin.from('family_usage').delete().in('parent_id', [freeParentId, premiumParentId]);

  console.log('\n================================================================================');
  console.log('🎉 ALL PHASE F END-TO-END VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('================================================================================');
}

runPhaseFVerification().catch((err) => {
  console.error('Fatal error during Phase F verification:', err);
  process.exit(1);
});
