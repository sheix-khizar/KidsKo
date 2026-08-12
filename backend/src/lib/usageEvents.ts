import { SupabaseClient } from '@supabase/supabase-js';

export async function logUsageEvent(
  supabase: SupabaseClient,
  parentId: string,
  studentId: string,
  eventType: 'message' | 'scan' | 'cache_hit' | 'live_snapshot'
): Promise<void> {
  // Fire-and-forget by design — a logging failure should never break the user-facing request
  const { error } = await supabase.from('usage_events').insert({
    parent_id: parentId,
    student_id: studentId,
    event_type: eventType,
  });
  if (error) console.error('usage_events insert failed:', error.message);
}
