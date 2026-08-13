import { SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'homework-snapshots';

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

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn(`[Supabase Storage Notice]: Upload to bucket '${BUCKET_NAME}' failed (${error.message}).`);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return {
      storagePath: fileName,
      publicUrl: urlData?.publicUrl,
    };
  } catch (err: any) {
    console.warn(`[Supabase Storage Warning]: Exception during storage upload (${err.message}).`);
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
      console.warn(`[Supabase Storage Download Error]: Could not download image ${storagePath} (${error?.message}).`);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString('base64');
  } catch (err: any) {
    console.warn(`[Supabase Storage Download Exception]: ${err.message}`);
    return null;
  }
}
