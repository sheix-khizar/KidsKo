import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function inspectSchema() {
  console.log('🔍 Checking Supabase `messages` and `chat_threads` schema...');

  const { data: msgData, error: msgError } = await supabaseAdmin
    .from('messages')
    .select('*')
    .limit(1);
    
  console.log('Messages columns sample:', msgData);
  if (msgError) console.error('msgError:', msgError.message);

  const { data: threadData, error: threadError } = await supabaseAdmin
    .from('chat_threads')
    .select('*')
    .limit(1);

  console.log('Chat Threads columns sample:', threadData);
  if (threadError) console.error('threadError:', threadError.message);
}

inspectSchema();
