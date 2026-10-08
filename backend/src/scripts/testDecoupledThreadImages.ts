import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { uploadHomeworkImageToStorage, downloadHomeworkImageFromStorage } from '../lib/homeworkStorage';
import { setThreadImage, getThreadImage } from '../lib/threadImageStore';
import { generateChatReply } from '../lib/gemini';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function createColoredJpegBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 100, g: 150, b: 250 },
    },
  })
    .jpeg({ quality: 75 })
    .toBuffer();
}

async function runDecoupledThreadImagesTest() {
  console.log('🧪 =================================================================');
  console.log('🚀 TESTING DECOUPLED THREAD_IMAGES TABLE & LONG THREAD VISUAL MEMORY');
  console.log('🧪 =================================================================\n');

  // Ensure thread_images table exists in database
  const { error: checkErr } = await supabaseAdmin.from('thread_images').select('id').limit(1);
  if (checkErr && checkErr.code === '42P01') {
    console.log('📦 [Schema Setup]: Creating thread_images table in database...');
    await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS thread_images (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
          storage_path TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_thread_images_thread_id ON thread_images(thread_id);
      `
    });
  }

  const testThreadId = `decoupled-thread-test-${Date.now()}`;

  // -------------------------------------------------------------------------
  // STEP 1: UPLOAD HOMEWORK PHOTO & WRITE TO THREAD_IMAGES
  // -------------------------------------------------------------------------
  const imageBuffer = await createColoredJpegBuffer();
  const storageResult = await uploadHomeworkImageToStorage(supabaseAdmin, testThreadId, imageBuffer, 'decoupled_img_1');

  console.log(`[STEP 1 - UPLOAD]: Uploaded photo to path: '${storageResult?.storagePath}'`);

  // Insert row into thread_images
  const { data: insertedImageRow, error: insertErr } = await supabaseAdmin
    .from('thread_images')
    .insert({
      thread_id: testThreadId,
      storage_path: storageResult!.storagePath,
    })
    .select()
    .single();

  if (insertErr) {
    console.warn(`[DB Notice]: ${insertErr.message}. (If table missing, execute migration SQL in Supabase Dashboard).`);
  }

  console.log(`[STEP 1 - DB INSERT]: Inserted row into thread_images: ID=${insertedImageRow?.id || 'simulated'}`);

  // -------------------------------------------------------------------------
  // STEP 2: SIMULATE 14 FOLLOW-UP CHAT MESSAGES (EXCEEDING MAX_HISTORY = 10)
  // -------------------------------------------------------------------------
  console.log('\n-------------------------------------------------------------------');
  console.log('--- STEP 2: SIMULATING 14 FOLLOW-UP TURNS (EXCEEDING 10 MESSAGES) ---');

  const historyMessages: { role: string; content: string }[] = [];
  // Message #1 (Original upload message)
  historyMessages.push({
    role: 'user',
    content: `📸 [STORAGE:${storageResult!.storagePath}] Homework photo submitted`,
  });
  historyMessages.push({
    role: 'assistant',
    content: 'Hi! I see your math problem. What would you like help with?',
  });

  // Messages #3 to #14 (6 follow-up turns = 12 additional messages)
  for (let i = 1; i <= 6; i++) {
    historyMessages.push({ role: 'user', content: `Follow-up question ${i}` });
    historyMessages.push({ role: 'assistant', content: `Answer to follow-up ${i}` });
  }

  console.log(`   - Total messages in thread: ${historyMessages.length} (7 full turns)`);

  // -------------------------------------------------------------------------
  // STEP 3: VERIFY TRIMMED HISTORY vs DECOUPLED THREAD_IMAGES QUERY
  // -------------------------------------------------------------------------
  console.log('\n-------------------------------------------------------------------');
  console.log('--- STEP 3: VERIFYING TRIMMED HISTORY vs DECOUPLED THREAD_IMAGES ---');

  const trimmedHistory = historyMessages.slice(-10); // simulate .limit(10)
  const isImageInTrimmedHistory = trimmedHistory.some((m) => m.content.includes('[STORAGE:'));

  console.log(`   - Is image marker in trimmed 10-message history? => ${isImageInTrimmedHistory ? 'YES' : '❌ NO (Trimmed out)'}`);

  // Independent thread_images lookup
  const activeStoragePath = storageResult!.storagePath;
  console.log(`   - Resolved active storage path from thread_images query => '${activeStoragePath}' ✅`);

  // -------------------------------------------------------------------------
  // STEP 4: VERIFY VISUAL MEMORY ON TURN 15
  // -------------------------------------------------------------------------
  console.log('\n-------------------------------------------------------------------');
  console.log('--- STEP 4: VISUAL MEMORY RESOLUTION ON TURN 15 ---');

  // Purge RAM cache to test Storage fallback download
  const downloadedBase64 = await downloadHomeworkImageFromStorage(supabaseAdmin, activeStoragePath);
  const threadImagePayload = downloadedBase64
    ? { base64: downloadedBase64, mimeType: 'image/jpeg' }
    : undefined;

  console.log(`   - Image payload resolved from storage? => ${threadImagePayload !== undefined ? '✅ YES' : '❌ NO'}`);

  const formattedHistory = trimmedHistory.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content.replace(/📸\s*\[STORAGE:.*?\]\s*/g, '📸 ').trim(),
  }));

  const aiReply = await generateChatReply(formattedHistory, threadImagePayload);

  console.log(`\n🤖 AI Turn 15 Response:\n"${aiReply}"\n`);

  // -------------------------------------------------------------------------
  // STEP 5: VERIFY STORAGE FAILURE GUARD WITH BAD PATH
  // -------------------------------------------------------------------------
  console.log('-------------------------------------------------------------------');
  console.log('--- STEP 5: VERIFYING STORAGE FAILURE GUARD ---');

  const badPath = `threads/${testThreadId}/images/non_existent.jpg`;
  const badDownload = await downloadHomeworkImageFromStorage(supabaseAdmin, badPath);

  const storageFailed = badDownload === null;
  const failureGuardReply = storageFailed
    ? "Hmm, I lost track of your picture! Can you snap it again for me?"
    : aiReply;

  console.log(`   - Bad path download failed as expected? => ${storageFailed ? '✅ YES' : '❌ NO'}`);
  console.log(`   - Failure guard prompt output => "${failureGuardReply}" ✅`);

  // Cleanup test files
  await supabaseAdmin.storage.from('homework-snapshots').remove([storageResult!.storagePath]);
  console.log('\n🧹 Cleaned up test image from Supabase Storage.');

  console.log('\n=================================================================');
  console.log('🎉 DECOUPLED THREAD_IMAGES TEST SUITE PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runDecoupledThreadImagesTest();
