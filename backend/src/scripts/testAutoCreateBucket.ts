import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { supabaseAdmin } from '../lib/supabase';
import { uploadHomeworkImageToStorage, downloadHomeworkImageFromStorage } from '../lib/homeworkStorage';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testAutoCreateBucket() {
  console.log('🧪 Testing Supabase Storage Auto-Bucket Creation & File Upload/Download via Admin Client...');

  // Create 100x100 test JPEG
  const buf = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 50, g: 150, b: 250 },
    },
  })
    .jpeg({ quality: 75 })
    .toBuffer();

  const testThreadId = `test-admin-bucket-thread-${Date.now()}`;

  // Upload image using admin client
  const uploadResult = await uploadHomeworkImageToStorage(supabaseAdmin, testThreadId, buf);

  console.log('Upload Result:', uploadResult);

  if (!uploadResult) {
    console.error('❌ Upload failed!');
    return;
  }

  console.log('✅ Upload succeeded! Storage Path:', uploadResult.storagePath);

  // Download image using admin client
  const downloadedBase64 = await downloadHomeworkImageFromStorage(supabaseAdmin, uploadResult.storagePath);

  if (downloadedBase64) {
    console.log('✅ Download succeeded! Base64 length:', downloadedBase64.length);
  } else {
    console.error('❌ Download failed!');
  }

  // Cleanup test object
  await supabaseAdmin.storage.from('homework-snapshots').remove([uploadResult.storagePath]);
  console.log('🧹 Cleaned up test storage file.');
}

testAutoCreateBucket();
