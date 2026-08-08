import { SupabaseClient } from '@supabase/supabase-js';

export const FREE_DAILY_MESSAGE_LIMIT = 30;
export const FREE_DAILY_SCAN_LIMIT = 5;

type UsageCheckResult = {
  allowed: boolean;
  isPremium: boolean;
  remaining: number;
  reason?: string;
};

// Checks and (if allowed) increments POOLED family usage for a given parent + limit type.
// Pooled = shared across all children on the account (v4.1 Section 6 decision).
// Uses the same "lazy reset" pattern as before: a stale last_daily_reset_at triggers
// an automatic reset on the request that discovers it — no cron dependency for correctness.
export async function checkAndIncrementUsage(
  supabase: SupabaseClient,
  parentId: string,
  type: 'message' | 'scan'
): Promise<UsageCheckResult> {
  // 1. Check premium status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', parentId)
    .maybeSingle();

  const isPremium = profile?.is_premium || false;

  if (isPremium) {
    return { allowed: true, isPremium: true, remaining: Infinity };
  }

  // 2. Fetch (or lazily create) the family's pooled usage row
  let { data: usage } = await supabase
    .from('family_usage')
    .select('daily_message_count, daily_scan_count, last_daily_reset_at')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (!usage) {
    const { data: created, error: createError } = await supabase
      .from('family_usage')
      .insert({ parent_id: parentId })
      .select('daily_message_count, daily_scan_count, last_daily_reset_at')
      .single();
    if (createError) throw createError;
    usage = created;
  }

  const lastReset = usage.last_daily_reset_at ? new Date(usage.last_daily_reset_at) : new Date(0);
  const now = new Date();
  const isNewDay =
    lastReset.getUTCFullYear() !== now.getUTCFullYear() ||
    lastReset.getUTCMonth() !== now.getUTCMonth() ||
    lastReset.getUTCDate() !== now.getUTCDate();

  let messageCount = isNewDay ? 0 : (usage.daily_message_count || 0);
  let scanCount = isNewDay ? 0 : (usage.daily_scan_count || 0);

  const limit = type === 'message' ? FREE_DAILY_MESSAGE_LIMIT : FREE_DAILY_SCAN_LIMIT;
  const currentCount = type === 'message' ? messageCount : scanCount;

  if (currentCount >= limit) {
    if (isNewDay) {
      await supabase
        .from('family_usage')
        .update({ daily_message_count: 0, daily_scan_count: 0, last_daily_reset_at: now.toISOString() })
        .eq('parent_id', parentId);
    }
    return {
      allowed: false,
      isPremium: false,
      remaining: 0,
      reason: `Daily free limit reached (${limit} ${type === 'message' ? 'messages' : 'scans'}/day, shared across your children). Upgrade to Premium for more!`,
    };
  }

  // 3. Increment and persist
  const updates =
    type === 'message'
      ? { daily_message_count: currentCount + 1, daily_scan_count: scanCount, last_daily_reset_at: isNewDay ? now.toISOString() : usage.last_daily_reset_at }
      : { daily_scan_count: currentCount + 1, daily_message_count: messageCount, last_daily_reset_at: isNewDay ? now.toISOString() : usage.last_daily_reset_at };

  const { error: updateError } = await supabase.from('family_usage').update(updates).eq('parent_id', parentId);
  if (updateError) throw updateError;

  return { allowed: true, isPremium: false, remaining: limit - (currentCount + 1) };
}
