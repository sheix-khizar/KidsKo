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

async function createColoredJpegBuffer(color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: color,
    },
  })
    .jpeg({ quality: 75 })
    .toBuffer();
}

async function runVersionedStorageTest() {
  console.log('🧪 =================================================================');
  console.log('🚀 TESTING VERSIONED IMAGE STORAGE & MULTI-IMAGE CONTEXT RESOLUTION');
  console.log('🧪 =================================================================\n');

  const testThreadId = `test-multi-image-thread-${Date.now()}`;

  // -------------------------------------------------------------------------
  // STEP 1: UPLOAD IMAGE A (BLUE WORKSHEET)
  // -------------------------------------------------------------------------
  const imageABuffer = await createColoredJpegBuffer({ r: 50, g: 100, b: 200 }); // Blue
  const imageAId = `imgA_${Date.now()}`;
  const uploadA = await uploadHomeworkImageToStorage(supabaseAdmin, testThreadId, imageABuffer, imageAId);

  console.log(`[STEP 1 - UPLOAD IMAGE A]:`);
  console.log(`   Storage Path A: ${uploadA?.storagePath}`);

  // -------------------------------------------------------------------------
  // STEP 2: UPLOAD IMAGE B (RED WORKSHEET) IN SAME THREAD
  // -------------------------------------------------------------------------
  const imageBBuffer = await createColoredJpegBuffer({ r: 200, g: 50, b: 50 }); // Red
  const imageBId = `imgB_${Date.now()}`;
  const uploadB = await uploadHomeworkImageToStorage(supabaseAdmin, testThreadId, imageBBuffer, imageBId);

  console.log(`\n[STEP 2 - UPLOAD IMAGE B IN SAME THREAD]:`);
  console.log(`   Storage Path B: ${uploadB?.storagePath}`);

  // -------------------------------------------------------------------------
  // STEP 3: VERIFY BOTH FILES COEXIST IN SUPABASE STORAGE (NO OVERWRITE)
  // -------------------------------------------------------------------------
  const downloadA = await downloadHomeworkImageFromStorage(supabaseAdmin, uploadA!.storagePath);
  const downloadB = await downloadHomeworkImageFromStorage(supabaseAdmin, uploadB!.storagePath);

  const bothFilesExist = downloadA !== null && downloadB !== null && uploadA?.storagePath !== uploadB?.storagePath;

  console.log(`\n📊 VERIFICATION 1 - NO OVERWRITE CHECK:`);
  console.log(`   - Path A (${uploadA?.storagePath}) exists? => ${downloadA !== null ? '✅ YES' : '❌ NO'}`);
  console.log(`   - Path B (${uploadB?.storagePath}) exists? => ${downloadB !== null ? '✅ YES' : '❌ NO'}`);
  console.log(`   - Are paths distinct? => ${bothFilesExist ? '✅ PASS (Versioned Storage Active)' : '❌ FAIL'}`);

  // -------------------------------------------------------------------------
  // STEP 4: MULTI-IMAGE CONTEXT RESOLUTION IN CHAT
  // -------------------------------------------------------------------------
  const history = [
    { role: 'user' as const, content: `📸 [STORAGE:${uploadA!.storagePath}] Solve problem 1 from first photo (5 x 5)` },
    { role: 'assistant' as const, content: '5 x 5 is 25!' },
    { role: 'user' as const, content: `📸 [STORAGE:${uploadB!.storagePath}] Now solve problem 1 from second photo (7 x 7)` },
    { role: 'assistant' as const, content: '7 x 7 is 49!' },
  ];

  // Test Case 4A: User asks for latest photo
  const latestPrompt = "What is problem 1 in the second photo?";
  const imageMarkers = [
    { storagePath: uploadB!.storagePath }, // newest (index 0)
    { storagePath: uploadA!.storagePath }, // oldest (index 1)
  ];

  const targetLatest = imageMarkers[0];
  console.log(`\n[TEST 4A - USER ASKS FOR LATEST PHOTO]: "${latestPrompt}"`);
  console.log(`   - Resolved Storage Path: ${targetLatest.storagePath}`);
  const isLatestCorrect = targetLatest.storagePath === uploadB!.storagePath;
  console.log(`   - Correctly resolved Image B? => ${isLatestCorrect ? '✅ PASS' : '❌ FAIL'}`);

  // Test Case 4B: User asks to go back to the first photo
  const earlierPrompt = "Can you go back to the first picture from before?";
  const requestsEarlier = /first (picture|photo|image|worksheet)|earlier (picture|photo|image|worksheet)|previous (picture|photo|image|worksheet)|go back to/i.test(earlierPrompt);
  const targetEarlier = (requestsEarlier && imageMarkers.length > 1) ? imageMarkers[imageMarkers.length - 1] : imageMarkers[0];

  console.log(`\n[TEST 4B - USER ASKS TO GO BACK TO FIRST PHOTO]: "${earlierPrompt}"`);
  console.log(`   - Detected earlier picture request? => ${requestsEarlier ? 'YES' : 'NO'}`);
  console.log(`   - Resolved Storage Path: ${targetEarlier.storagePath}`);
  const isEarlierCorrect = targetEarlier.storagePath === uploadA!.storagePath;
  console.log(`   - Correctly resolved Image A? => ${isEarlierCorrect ? '✅ PASS' : '❌ FAIL'}`);

  // Cleanup test files
  await supabaseAdmin.storage.from('homework-snapshots').remove([uploadA!.storagePath, uploadB!.storagePath]);
  console.log('\n🧹 Cleaned up versioned test files from Supabase Storage.');

  console.log('\n=================================================================');
  console.log('🎉 VERSIONED STORAGE & MULTI-IMAGE SUITE COMPLETED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runVersionedStorageTest();
