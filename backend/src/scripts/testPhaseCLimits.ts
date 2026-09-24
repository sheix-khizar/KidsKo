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

dotenv.config({ path: path.join(__dirname, '../../.env') });

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('🧪 Starting Phase C Verification: Weekly Limits & Premium Ceilings\n');

  async function getOrCreateUser(email: string, isPremium: boolean): Promise<string> {
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
    const { error: upsertErr } = await supabaseAdmin.from('profiles').upsert({
      id: user.id,
      email,
      is_premium: isPremium,
    });
    if (upsertErr) console.error('Profiles upsert error:', upsertErr);

    const { data: savedProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    console.log(`User ${email} profile:`, savedProfile);
    return user.id;
  }

  const freeParentId = await getOrCreateUser('test_free_phase_c@kidsko.ai', false);
  const premiumParentId = await getOrCreateUser('test_premium_phase_c@kidsko.ai', true);

  // Clean usage rows
  await supabaseAdmin.from('family_usage').delete().in('parent_id', [freeParentId, premiumParentId]);

  console.log('--- 1. Constants Verification ---');
  assert(FREE_WEEKLY_MESSAGE_LIMIT === 30, 'FREE_WEEKLY_MESSAGE_LIMIT is 30');
  assert(FREE_WEEKLY_SCAN_LIMIT === 3, 'FREE_WEEKLY_SCAN_LIMIT is 3');
  assert(PREMIUM_WEEKLY_MESSAGE_LIMIT === 200, 'PREMIUM_WEEKLY_MESSAGE_LIMIT is 200');
  assert(PREMIUM_WEEKLY_SCAN_LIMIT === 15, 'PREMIUM_WEEKLY_SCAN_LIMIT is 15');

  console.log('\n--- 2. Free Tier Message Boundary (30/week) ---');
  // Initialize row at limit - 1
  await supabaseAdmin.from('family_usage').upsert({
    parent_id: freeParentId,
    daily_message_count: 29,
    daily_scan_count: 0,
    last_weekly_reset_at: new Date().toISOString(),
  });

  // 30th message: allowed, remaining 0
  const msg30 = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'message');
  assert(msg30.allowed === true, '30th message is allowed');
  assert(msg30.remaining === 0, '30th message leaves 0 remaining');

  // 31st message: blocked
  const msg31 = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'message');
  assert(msg31.allowed === false, '31st message is blocked');
  assert(msg31.reason?.includes('Weekly free limit reached'), 'Block reason mentions weekly limit');

  console.log('\n--- 3. Free Tier Scan Boundary (3/week) ---');
  // Set scan count to 2
  await supabaseAdmin.from('family_usage').update({ daily_scan_count: 2 }).eq('parent_id', freeParentId);

  // 3rd scan: allowed, remaining 0
  const scan3 = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'scan');
  assert(scan3.allowed === true, '3rd scan is allowed');
  assert(scan3.remaining === 0, '3rd scan leaves 0 remaining');

  // 4th scan: blocked
  const scan4 = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'scan');
  assert(scan4.allowed === false, '4th scan is blocked');
  assert(scan4.reason?.includes('Weekly free limit reached'), 'Block reason mentions weekly limit');

  console.log('\n--- 4. Weekly Reset Verification (7+ days elapsed) ---');
  // Manually age the reset date to 8 days ago
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from('family_usage').update({
    last_weekly_reset_at: eightDaysAgo,
    daily_message_count: 30,
    daily_scan_count: 3,
  }).eq('parent_id', freeParentId);

  // Request should discover aged date, reset counters to 0, and allow turn
  const resetTurn = await checkAndIncrementUsage(supabaseAdmin, freeParentId, 'message');
  assert(resetTurn.allowed === true, 'Message allowed after 8-day reset gap');
  assert(resetTurn.remaining === 29, 'Remaining reset to 29 (30 - 1)');

  const { data: refreshedUsage } = await supabaseAdmin
    .from('family_usage')
    .select('daily_message_count, daily_scan_count, last_weekly_reset_at')
    .eq('parent_id', freeParentId)
    .single();

  assert(refreshedUsage?.daily_message_count === 1, 'daily_message_count is now 1');
  assert(refreshedUsage?.daily_scan_count === 0, 'daily_scan_count reset to 0');
  const resetAgeHours = (Date.now() - new Date(refreshedUsage!.last_weekly_reset_at!).getTime()) / (1000 * 60 * 60);
  assert(resetAgeHours < 1, 'last_weekly_reset_at updated to now');

  console.log('\n--- 5. Premium Tier Explicit Ceiling Verification (200 msgs / 15 scans) ---');
  // Initialize premium at 199 messages
  await supabaseAdmin.from('family_usage').upsert({
    parent_id: premiumParentId,
    daily_message_count: 199,
    daily_scan_count: 14,
    last_weekly_reset_at: new Date().toISOString(),
  });

  // 200th message allowed
  const premMsg200 = await checkAndIncrementUsage(supabaseAdmin, premiumParentId, 'message');
  console.log('premMsg200 result:', premMsg200);
  assert(premMsg200.allowed === true, '200th premium message allowed');
  assert(premMsg200.isPremium === true, 'isPremium is true');
  assert(premMsg200.remaining === 0, 'Remaining is 0 at ceiling');

  // 201st message blocked
  const premMsg201 = await checkAndIncrementUsage(supabaseAdmin, premiumParentId, 'message');
  assert(premMsg201.allowed === false, '201st premium message blocked at ceiling');
  assert(premMsg201.isPremium === true, 'Blocked response retains isPremium: true');
  assert(premMsg201.reason?.includes('Weekly limit reached (200 messages/week on Premium)'), 'Block reason mentions Premium 200 limit');

  // 15th scan allowed
  const premScan15 = await checkAndIncrementUsage(supabaseAdmin, premiumParentId, 'scan');
  assert(premScan15.allowed === true, '15th premium scan allowed');
  assert(premScan15.remaining === 0, 'Remaining is 0 at ceiling');

  // 16th scan blocked
  const premScan16 = await checkAndIncrementUsage(supabaseAdmin, premiumParentId, 'scan');
  assert(premScan16.allowed === false, '16th premium scan blocked at ceiling');
  assert(premScan16.reason?.includes('Weekly limit reached (15 homework scans/week on Premium)'), 'Block reason mentions Premium 15 limit');

  console.log('\n🎉 ALL PHASE C CHECKS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('Fatal error during Phase C test:', err);
  process.exit(1);
});
