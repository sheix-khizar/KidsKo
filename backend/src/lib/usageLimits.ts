import { SupabaseClient } from '@supabase/supabase-js';

export const FREE_DAILY_MESSAGE_LIMIT = 10;
export const FREE_DAILY_SCAN_LIMIT = 3;

type UsageCheckResult = {
  allowed: boolean;
  isPremium: boolean;
  remaining: number;
  reason?: string;
};

// Checks and (if allowed) increments usage for a given student + limit type.
// Uses a "lazy reset" pattern: if the student's last_reset_at is from a previous
// day, counts are reset to 0 automatically on this request — no cron dependency
// for correctness.
export async function checkAndIncrementUsage(
  supabase: SupabaseClient,
  studentId: string,
  parentId: string,
  type: 'message' | 'scan'
): Promise<UsageCheckResult> {
  // 1. Check premium status (use maybeSingle so missing profiles don't throw 500 errors)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', parentId)
    .maybeSingle();

  const isPremium = profile?.is_premium || false;

  if (isPremium) {
    return { allowed: true, isPremium: true, remaining: Infinity };
  }

  // 2. Fetch current counters
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('daily_message_count, daily_scan_count, last_reset_at')
    .eq('id', studentId)
    .maybeSingle();

  if (studentError || !student) {
    throw new Error(studentError?.message || 'Student not found');
  }

  const lastReset = student.last_reset_at ? new Date(student.last_reset_at) : new Date(0);
  const now = new Date();
  const isNewDay =
    lastReset.getUTCFullYear() !== now.getUTCFullYear() ||
    lastReset.getUTCMonth() !== now.getUTCMonth() ||
    lastReset.getUTCDate() !== now.getUTCDate();

  let messageCount = isNewDay ? 0 : (student.daily_message_count || 0);
  let scanCount = isNewDay ? 0 : (student.daily_scan_count || 0);

  const limit = type === 'message' ? FREE_DAILY_MESSAGE_LIMIT : FREE_DAILY_SCAN_LIMIT;
  const currentCount = type === 'message' ? messageCount : scanCount;

  if (currentCount >= limit) {
    if (isNewDay) {
      await supabase
        .from('students')
        .update({ daily_message_count: 0, daily_scan_count: 0, last_reset_at: now.toISOString() })
        .eq('id', studentId);
    }
    return {
      allowed: false,
      isPremium: false,
      remaining: 0,
      reason: `Daily free limit reached (${limit} ${type === 'message' ? 'messages' : 'scans'}/day). Upgrade to Premium for more!`,
    };
  }

  // 3. Increment and persist
  const updates =
    type === 'message'
      ? { daily_message_count: currentCount + 1, daily_scan_count: scanCount, last_reset_at: isNewDay ? now.toISOString() : (student.last_reset_at || now.toISOString()) }
      : { daily_scan_count: currentCount + 1, daily_message_count: messageCount, last_reset_at: isNewDay ? now.toISOString() : (student.last_reset_at || now.toISOString()) };

  const { error: updateError } = await supabase.from('students').update(updates).eq('id', studentId);
  if (updateError) throw updateError;

  return { allowed: true, isPremium: false, remaining: limit - (currentCount + 1) };
}
