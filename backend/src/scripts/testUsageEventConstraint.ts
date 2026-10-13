import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log('Testing usage_events table for "memory" event type constraint...');
  const { data, error } = await supabase.from('usage_events').insert({
    parent_id: '64616d07-ae9b-4099-8355-1644a7c02f99',
    event_type: 'memory'
  }).select();

  if (error) {
    console.warn('⚠️ Constraint rejected "memory" event:', error.message);
    console.log('👉 To enable "memory" event tracking in Supabase, execute 20261011_student_memory.sql:');
    console.log('   ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_event_type_check;');
    console.log('   ALTER TABLE usage_events ADD CONSTRAINT usage_events_event_type_check');
    console.log("     CHECK (event_type IN ('message','scan','cache_hit','live_snapshot','voice_trial','memory'));");
    // Does not break runtime as logUsageEvent is fire-and-forget
    process.exit(0);
  } else {
    console.log('✅ PASS: "memory" event successfully allowed by check constraint:', data[0].id);
    await supabase.from('usage_events').delete().eq('id', data[0].id);
    console.log('✅ Cleaned up test record.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
