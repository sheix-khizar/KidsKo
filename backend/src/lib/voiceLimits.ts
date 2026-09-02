import { SupabaseClient } from '@supabase/supabase-js';

export const FREE_WEEKLY_VOICE_MINUTES = 5;
export const PREMIUM_WEEKLY_VOICE_MINUTES = 100;

export const FREE_WEEKLY_LIVE_SNAPSHOTS = 3;
export const PREMIUM_WEEKLY_LIVE_SNAPSHOTS = 20;

type VoiceEligibility = {
  allowed: boolean;
  isPremium: boolean;
  minutesRemaining: number;
  reason?: string;
};

type SnapshotEligibility = {
  allowed: boolean;
  remaining: number;
  reason?: string;
};

export async function checkVoiceEligibility(
  supabase: SupabaseClient,
  parentId: string
): Promise<VoiceEligibility> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', parentId)
    .maybeSingle();

  const isPremium = profile?.is_premium || false;
  const limit = isPremium ? PREMIUM_WEEKLY_VOICE_MINUTES : FREE_WEEKLY_VOICE_MINUTES;

  let { data: usage } = await supabase
    .from('family_usage')
    .select('weekly_voice_minutes_used, last_weekly_reset_at')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (!usage) {
    const { data: created, error: createErr } = await supabase
      .from('family_usage')
      .insert({ parent_id: parentId })
      .select('weekly_voice_minutes_used, last_weekly_reset_at')
      .single();
    if (createErr) throw createErr;
    usage = created;
  }

  const lastReset = usage!.last_weekly_reset_at ? new Date(usage!.last_weekly_reset_at) : new Date(0);
  const now = new Date();
  const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24);
  const isNewWeek = daysSinceReset >= 7;

  const minutesUsed = isNewWeek ? 0 : (usage!.weekly_voice_minutes_used || 0);

  if (isNewWeek) {
    await supabase
      .from('family_usage')
      .update({ weekly_voice_minutes_used: 0, weekly_live_snapshots_used: 0, last_weekly_reset_at: now.toISOString() })
      .eq('parent_id', parentId);
  }

  const minutesRemaining = Math.max(0, limit - minutesUsed);

  if (minutesRemaining <= 0) {
    return {
      allowed: false,
      isPremium,
      minutesRemaining: 0,
      reason: isPremium
        ? 'Voice allowance used up for this month.'
        : `Free voice time used up for this week (${FREE_WEEKLY_VOICE_MINUTES} min/week). Upgrade to Premium for more!`,
    };
  }

  return { allowed: true, isPremium, minutesRemaining };
}

// Called periodically DURING a session (every ~10s of connected time) and once
// on close — NOT trusted to the client. This is what makes the cap real.
export async function recordVoiceMinutesUsed(
  supabase: SupabaseClient,
  parentId: string,
  minutesElapsed: number
): Promise<void> {
  const { data: usage } = await supabase
    .from('family_usage')
    .select('weekly_voice_minutes_used')
    .eq('parent_id', parentId)
    .maybeSingle();

  const current = usage?.weekly_voice_minutes_used || 0;
  await supabase
    .from('family_usage')
    .update({ weekly_voice_minutes_used: current + minutesElapsed })
    .eq('parent_id', parentId);
}

// IMPORTANT: only call this from within an already-started voice session —
// i.e. after checkVoiceEligibility() has already run for this connection.
// That function owns the weekly reset logic for BOTH counters (they share
// last_weekly_reset_at); this function assumes the week has already been
// correctly rolled by the time a snapshot is attempted mid-session.
export async function checkSnapshotEligibility(
  supabase: SupabaseClient,
  parentId: string,
  isPremium: boolean
): Promise<SnapshotEligibility> {
  const limit = isPremium ? PREMIUM_WEEKLY_LIVE_SNAPSHOTS : FREE_WEEKLY_LIVE_SNAPSHOTS;

  const { data: usage } = await supabase
    .from('family_usage')
    .select('weekly_live_snapshots_used')
    .eq('parent_id', parentId)
    .maybeSingle();

  const used = usage?.weekly_live_snapshots_used || 0;
  const remaining = Math.max(0, limit - used);

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      reason: isPremium
        ? 'Live photo-help allowance used up for this week.'
        : `Free live photo-help used up for this week (${FREE_WEEKLY_LIVE_SNAPSHOTS}/week). Upgrade to Premium for more!`,
    };
  }

  return { allowed: true, remaining };
}

export async function recordSnapshotUsed(supabase: SupabaseClient, parentId: string): Promise<void> {
  const { data: usage } = await supabase
    .from('family_usage')
    .select('weekly_live_snapshots_used')
    .eq('parent_id', parentId)
    .maybeSingle();

  const current = usage?.weekly_live_snapshots_used || 0;
  await supabase
    .from('family_usage')
    .update({ weekly_live_snapshots_used: current + 1 })
    .eq('parent_id', parentId);
}
