import { SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'homework-snapshots';
let bucketChecked = false;

// Automatically ensures that the Supabase Storage bucket exists
async function ensureBucketExists(supabase: SupabaseClient) {
  if (bucketChecked) return;
  try {
    const { data: bucket } = await supabase.storage.getBucket(BUCKET_NAME);
    if (!bucket) {
      console.log(`[Supabase Storage]: Bucket '${BUCKET_NAME}' not found. Auto-creating public bucket...`);
      const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      if (createErr) {
        console.warn(`[Supabase Storage Auto-Create Notice]: ${createErr.message}. If using anon client, create bucket in Supabase Dashboard.`);
      } else {
        console.log(`[Supabase Storage]: Bucket '${BUCKET_NAME}' created automatically!`);
        bucketChecked = true;
      }
    } else {
      bucketChecked = true;
    }
  } catch (err: any) {
    console.warn(`[Supabase Storage Notice]: Could not check bucket status (${err.message}).`);
  }
}

export type StorageResult = {
  storagePath: string;
  publicUrl?: string;
};

// Uploads a compressed JPEG buffer to Supabase Storage bucket
export async function uploadHomeworkImageToStorage(
  supabase: SupabaseClient,
  threadId: string,
  imageBuffer: Buffer
): Promise<StorageResult | null> {
  const fileName = `threads/${threadId}/latest.jpg`;

  await ensureBucketExists(supabase);

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error(`[Supabase Storage Upload Error]: Bucket '${BUCKET_NAME}' path '${fileName}' failed: ${error.message}`);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return {
      storagePath: fileName,
      publicUrl: urlData?.publicUrl,
    };
  } catch (err: any) {
    console.error(`[Supabase Storage Upload Exception]: Path 'threads/${threadId}/latest.jpg' error:`, err.message);
    return null;
  }
}

// Downloads image buffer from Supabase Storage bucket and converts to Base64
export async function downloadHomeworkImageFromStorage(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error || !data) {
      console.error(`[Supabase Storage Download Failure]: Could not download '${storagePath}' from bucket '${BUCKET_NAME}'. Error details: ${error?.message || 'Empty data returned'}`);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (err: any) {
    console.error(`[Supabase Storage Download Exception]: Path '${storagePath}' thrown error:`, err.stack || err.message);
    return null;
  }
}
