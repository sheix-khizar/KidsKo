import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function resetVoiceLimits() {
  console.log('🔄 Resetting weekly voice usage minutes to 0 in Supabase...\n');

  const { data, error } = await supabaseAdmin
    .from('family_usage')
    .update({
      weekly_voice_minutes_used: 0.0,
      last_weekly_reset_at: new Date().toISOString(),
    })
    .neq('parent_id', '00000000-0000-0000-0000-000000000000') // matches all rows
    .select();

  if (error) {
    console.error('❌ Error resetting voice limits:', error.message);
  } else {
    console.log(`✅ SUCCESS! Reset voice usage minutes to 0.0 for ${data?.length || 0} family account(s).`);
    console.log('🎉 You can now make new voice calls without hitting weekly limit caps!\n');
  }
}

resetVoiceLimits();
