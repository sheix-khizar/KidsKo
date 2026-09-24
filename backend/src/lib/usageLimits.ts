import { SupabaseClient } from '@supabase/supabase-js';

export const FREE_WEEKLY_MESSAGE_LIMIT = 30;
export const FREE_WEEKLY_SCAN_LIMIT = 3;

export const PREMIUM_WEEKLY_MESSAGE_LIMIT = 200;
export const PREMIUM_WEEKLY_SCAN_LIMIT = 15;

/** @deprecated Use FREE_WEEKLY_MESSAGE_LIMIT */
export const FREE_DAILY_MESSAGE_LIMIT = FREE_WEEKLY_MESSAGE_LIMIT;
/** @deprecated Use FREE_WEEKLY_SCAN_LIMIT */
export const FREE_DAILY_SCAN_LIMIT = FREE_WEEKLY_SCAN_LIMIT;

type UsageCheckResult = {
  allowed: boolean;
  isPremium: boolean;
  remaining: number;
  reason?: string;
};

// Checks and (if allowed) increments POOLED family usage for a given parent + limit type.
// Pooled = shared across all children on the account (v4.1 Section 6 & v6 Master Plan).
// Converts tracking from daily to weekly, mirroring voiceLimits.ts (last_weekly_reset_at).
// Enforces explicit weekly limits for both free (30 msg/3 scans) and premium (200 msg/15 scans).
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

  // 2. Fetch (or lazily create) the family's pooled usage row
  let { data: usage } = await supabase
    .from('family_usage')
    .select('daily_message_count, daily_scan_count, weekly_voice_minutes_used, weekly_live_snapshots_used, last_weekly_reset_at')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (!usage) {
    const { data: created, error: createError } = await supabase
      .from('family_usage')
      .insert({ parent_id: parentId })
      .select('daily_message_count, daily_scan_count, weekly_voice_minutes_used, weekly_live_snapshots_used, last_weekly_reset_at')
      .single();
    if (createError) throw createError;
    usage = created;
  }

  const lastReset = usage!.last_weekly_reset_at ? new Date(usage!.last_weekly_reset_at) : new Date(0);
  const now = new Date();
  const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24);
  const isNewWeek = daysSinceReset >= 7;

  let messageCount = isNewWeek ? 0 : (usage!.daily_message_count || 0);
  let scanCount = isNewWeek ? 0 : (usage!.daily_scan_count || 0);

  if (isNewWeek) {
    await supabase
      .from('family_usage')
      .update({
        daily_message_count: 0,
        daily_scan_count: 0,
        weekly_voice_minutes_used: 0,
        weekly_live_snapshots_used: 0,
        last_weekly_reset_at: now.toISOString(),
      })
      .eq('parent_id', parentId);
  }

  const limit =
    type === 'message'
      ? (isPremium ? PREMIUM_WEEKLY_MESSAGE_LIMIT : FREE_WEEKLY_MESSAGE_LIMIT)
      : (isPremium ? PREMIUM_WEEKLY_SCAN_LIMIT : FREE_WEEKLY_SCAN_LIMIT);

  const currentCount = type === 'message' ? messageCount : scanCount;

  if (currentCount >= limit) {
    return {
      allowed: false,
      isPremium,
      remaining: 0,
      reason: isPremium
        ? `Weekly limit reached (${limit} ${type === 'message' ? 'messages' : 'homework scans'}/week on Premium). Your allowance resets each week.`
        : `Weekly free limit reached (${limit} ${type === 'message' ? 'messages' : 'homework scans'}/week, shared across your children). Upgrade to Premium for more!`,
    };
  }

  // 3. Increment and persist
  const updates =
    type === 'message'
      ? {
          daily_message_count: currentCount + 1,
          daily_scan_count: scanCount,
          last_weekly_reset_at: isNewWeek ? now.toISOString() : (usage!.last_weekly_reset_at || now.toISOString()),
        }
      : {
          daily_scan_count: currentCount + 1,
          daily_message_count: messageCount,
          last_weekly_reset_at: isNewWeek ? now.toISOString() : (usage!.last_weekly_reset_at || now.toISOString()),
        };

  const { error: updateError } = await supabase.from('family_usage').update(updates).eq('parent_id', parentId);
  if (updateError) throw updateError;

  return {
    allowed: true,
    isPremium,
    remaining: Math.max(0, limit - (currentCount + 1)),
  };
}
