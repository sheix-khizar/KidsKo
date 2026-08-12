import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function resetAllUsageLimits() {
  console.log('🔄 Resetting weekly voice minutes AND live photo snapshot limits to 0 in Supabase...\n');

  const { data, error } = await supabaseAdmin
    .from('family_usage')
    .update({
      weekly_voice_minutes_used: 0.0,
      weekly_live_snapshots_used: 0,
      last_weekly_reset_at: new Date().toISOString(),
    })
    .neq('parent_id', '00000000-0000-0000-0000-000000000000') // matches all rows
    .select();

  if (error) {
    console.error('❌ Error resetting usage limits:', error.message);
  } else {
    console.log(`✅ SUCCESS! Reset voice minutes to 0.0 & photo snapshot count to 0 for ${data?.length || 0} family account(s).`);
    console.log('🎉 You can now make new voice calls and capture homework photos without hitting limit caps!\n');
  }
}

resetAllUsageLimits();
