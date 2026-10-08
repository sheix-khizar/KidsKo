import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testPhase4C() {
  console.log('🧪 ==========================================================');
  console.log('🚀 TESTING PHASE 4C: LIVE SNAPSHOT ELIGIBILITY & ACCOUNTING');
  console.log('🧪 ==========================================================\n');

  // 1. Verify family_usage table has weekly_live_snapshots_used column
  const { data: usage, error: colError } = await supabaseAdmin
    .from('family_usage')
    .select('weekly_live_snapshots_used')
    .limit(1);

  if (colError) {
    console.error('❌ Column error:', colError.message);
    console.log('👉 Make sure to run the SQL migration in Supabase SQL Editor:');
    console.log('   ALTER TABLE family_usage ADD COLUMN IF NOT EXISTS weekly_live_snapshots_used INT DEFAULT 0;');
    return;
  }
  console.log('✅ [CHECK 1] Column weekly_live_snapshots_used verified in family_usage table!');

  // 2. Verify usage_events constraint accepts live_snapshot
  const { error: eventError } = await supabaseAdmin
    .from('usage_events')
    .insert({
      parent_id: '00000000-0000-0000-0000-000000000000',
      student_id: '00000000-0000-0000-0000-000000000000',
      event_type: 'live_snapshot',
    });

  if (eventError && !eventError.message.includes('foreign key') && !eventError.message.includes('violates foreign key')) {
    console.error('❌ usage_events insert error:', eventError.message);
  } else {
    console.log('✅ [CHECK 2] usage_events constraint verified for "live_snapshot" event type!');
  }

  console.log('\n🎉 ==========================================================');
  console.log('🏆 PHASE 4C BACKEND SCHEMA & INTEGRATION TEST COMPLETE');
  console.log('🎉 ==========================================================\n');
}

testPhase4C();
