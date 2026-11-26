import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { supabaseAdmin } from '../lib/supabase';
import {
  uploadHomeworkImageToStorage,
  downloadHomeworkImageFromStorage,
  getHomeworkImageSignedUrl,
} from '../lib/homeworkStorage';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testAutoCreateBucket() {
  console.log('🧪 Testing Private Homework Bucket, Upload Signed URL & Download via Admin Client...');

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

  if (!uploadResult) {
    console.error('❌ Upload failed!');
    process.exit(1);
  }

  console.log('✅ Upload succeeded! Storage Path:', uploadResult.storagePath);

  try {
    const { data: bucketInfo } = await supabaseAdmin.storage.getBucket('homework-snapshots');
    console.log('📦 Bucket public flag:', bucketInfo?.public);
    if (bucketInfo?.public) {
      console.warn('⚠️ Existing bucket is still public in Supabase Dashboard — flip homework-snapshots to Private!');
    } else {
      console.log('✅ Bucket is Private (public === false).');
    }

    if (!uploadResult.signedUrl || uploadResult.signedUrl.includes('/object/public/') || !uploadResult.signedUrl.includes('token=')) {
      console.error('❌ Upload did not return a private signed URL:', uploadResult.signedUrl);
      process.exit(1);
    }
    console.log('✅ Upload returned signed URL (not public URL).');

    const fetchedSigned = await getHomeworkImageSignedUrl(supabaseAdmin, uploadResult.storagePath);
    if (!fetchedSigned || fetchedSigned.includes('/object/public/') || !fetchedSigned.includes('token=')) {
      console.error('❌ getHomeworkImageSignedUrl failed to return a signed URL:', fetchedSigned);
      process.exit(1);
    }

    const httpRes = await fetch(fetchedSigned);
    if (!httpRes.ok) {
      console.error('❌ Fetching signed URL returned HTTP', httpRes.status);
      process.exit(1);
    }
    console.log('✅ Signed URL HTTP fetch succeeded with status:', httpRes.status);

    // Download image using admin client
    const downloadedBase64 = await downloadHomeworkImageFromStorage(supabaseAdmin, uploadResult.storagePath);
    if (!downloadedBase64) {
      console.error('❌ Admin download failed!');
      process.exit(1);
    }
    console.log('✅ Download succeeded! Base64 length:', downloadedBase64.length);

    // Ensure getHomeworkImageSignedUrl returns null (never a public URL) on invalid/missing input
    const emptySigned = await getHomeworkImageSignedUrl(supabaseAdmin, '');
    if (emptySigned !== null) {
      console.error('❌ Expected null signed URL for empty path, got:', emptySigned);
      process.exit(1);
    }
    console.log('✅ Signed URL fails closed (null) without public URL fallback.');
  } finally {
    await supabaseAdmin.storage.from('homework-snapshots').remove([uploadResult.storagePath]);
    console.log('🧹 Cleaned up test storage file.');
  }
}

testAutoCreateBucket().catch((err) => {
  console.error(err);
  process.exit(1);
});
