import { SupabaseClient } from '@supabase/supabase-js';
import { clearThreadImageCache } from './threadImageStore';
import { supabaseAdmin } from './supabase';

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

// Uploads a compressed JPEG buffer to Supabase Storage bucket using versioned paths
export async function uploadHomeworkImageToStorage(
  supabase: SupabaseClient,
  threadId: string,
  imageBuffer: Buffer,
  imageId?: string
): Promise<StorageResult | null> {
  const imageTag = imageId || `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fileName = `threads/${threadId}/images/${imageTag}.jpg`;

  await ensureBucketExists(supabaseAdmin);

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error(`[Supabase Storage Upload Error]: Bucket '${BUCKET_NAME}' path '${fileName}' failed: ${error.message}`);
      return null;
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return {
      storagePath: fileName,
      publicUrl: urlData?.publicUrl,
    };
  } catch (err: any) {
    console.error(`[Supabase Storage Upload Exception]: Path '${fileName}' error:`, err.message);
    return null;
  }
}

// Downloads image buffer from Supabase Storage bucket and converts to Base64
export async function downloadHomeworkImageFromStorage(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
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

// Deletes a single image file from Supabase Storage and clears RAM cache
export async function deleteSingleImageFromStorage(
  supabase: SupabaseClient,
  storagePath: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error || !data || data.length === 0) {
      console.error(`[Supabase Storage Deletion Error]: Could not remove '${storagePath}':`, error?.message || 'No items removed');
      return false;
    }
    clearThreadImageCache(storagePath);
    return true;
  } catch (err: any) {
    console.error(`[Supabase Storage Deletion Exception]: '${storagePath}' error: ${err.message}`);
    return false;
  }
}

// Deletes all images belonging to a specific thread from Supabase Storage and clears RAM cache
export async function deleteThreadImagesFromStorage(
  supabase: SupabaseClient,
  threadId: string
): Promise<number> {
  try {
    let deletedCount = 0;

    // List images directly in subfolder threads/{threadId}/images
    const { data: imgFiles } = await supabaseAdmin.storage.from(BUCKET_NAME).list(`threads/${threadId}/images`, { limit: 100 });

    if (imgFiles && imgFiles.length > 0) {
      const validFiles = imgFiles.filter((f) => f.name && !f.name.startsWith('.'));
      for (const f of validFiles) {
        const fullPath = `threads/${threadId}/images/${f.name}`;
        const ok = await deleteSingleImageFromStorage(supabaseAdmin, fullPath);
        if (ok) deletedCount++;
      }
    }

    // Also list legacy images directly under threads/{threadId}/
    const { data: legacyFiles } = await supabaseAdmin.storage.from(BUCKET_NAME).list(`threads/${threadId}`, { limit: 100 });
    if (legacyFiles && legacyFiles.length > 0) {
      const validLegacy = legacyFiles.filter((f) => f.name && f.name.endsWith('.jpg'));
      for (const f of validLegacy) {
        const fullPath = `threads/${threadId}/${f.name}`;
        const ok = await deleteSingleImageFromStorage(supabaseAdmin, fullPath);
        if (ok) deletedCount++;
      }
    }

    clearThreadImageCache(threadId);
    console.log(`[COPPA Data Retention]: Purged ${deletedCount} images for thread '${threadId}' from Supabase Storage & RAM cache.`);
    return deletedCount;
  } catch (err: any) {
    console.error(`[COPPA Data Retention Exception]: Could not purge thread '${threadId}' images: ${err.message}`);
    return 0;
  }
}
