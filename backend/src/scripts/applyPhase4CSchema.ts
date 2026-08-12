import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function verifySchema() {
  console.log('🔍 Checking family_usage table for weekly_live_snapshots_used column...');
  const { data, error } = await supabaseAdmin.from('family_usage').select('weekly_live_snapshots_used').limit(1);

  if (error) {
    console.log('⚠️ Column weekly_live_snapshots_used not found yet or error:', error.message);
    console.log('👉 Please execute the SQL in Supabase Dashboard SQL Editor.');
  } else {
    console.log('✅ Column weekly_live_snapshots_used is ACTIVE in Supabase!');
  }
}

verifySchema();
