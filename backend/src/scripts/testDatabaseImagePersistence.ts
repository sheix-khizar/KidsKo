import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function testDatabaseImagePersistence() {
  console.log('🧪 Testing Supabase DB storage of base64 image in messages table...');

  // Create 100x100 test image
  const buf = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg({ quality: 75 })
    .toBuffer();
  const testBase64 = buf.toString('base64');

  // Insert a test message with image prefix
  const testThreadId = '00000000-0000-0000-0000-000000000000'; // dummy or query active
  const { data: threads } = await supabaseAdmin.from('chat_threads').select('id, student_id').limit(1);

  if (!threads || threads.length === 0) {
    console.error('No threads found to test');
    return;
  }

  const thread = threads[0];
  const formattedContent = `📸 [IMAGE:${testBase64}] Solve question 1 part a`;

  const { data: insertedMsg, error: insertErr } = await supabaseAdmin
    .from('messages')
    .insert({
      thread_id: thread.id,
      student_id: thread.student_id,
      role: 'user',
      content: formattedContent,
      message_type: 'image',
    })
    .select()
    .single();

  if (insertErr) {
    console.error('❌ Insert Error:', insertErr.message);
    return;
  }

  console.log('✅ Inserted message ID:', insertedMsg.id);

  // Fetch back
  const { data: fetchedMsg, error: fetchErr } = await supabaseAdmin
    .from('messages')
    .select('content')
    .eq('id', insertedMsg.id)
    .single();

  if (fetchErr) {
    console.error('❌ Fetch Error:', fetchErr.message);
    return;
  }

  const matches = fetchedMsg.content.match(/📸 \[IMAGE:(.*?)\]\s*(.*)/s);
  if (matches) {
    console.log('✅ SUCCESS! Extracted Base64 length:', matches[1].length);
    console.log('✅ SUCCESS! Extracted Prompt text:', matches[2]);
  } else {
    console.error('❌ Regex match failed!');
  }

  // Cleanup test row
  await supabaseAdmin.from('messages').delete().eq('id', insertedMsg.id);
  console.log('🧹 Cleaned up test message.');
}

testDatabaseImagePersistence();
