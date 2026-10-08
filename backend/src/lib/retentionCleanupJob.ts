import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';
import { clearThreadImageCache } from './threadImageStore';

const BUCKET_NAME = 'homework-snapshots';

export type CleanupReport = {
  scannedFiles: number;
  purgedFiles: number;
  purgedPaths: string[];
};

// Scheduled job: purges any storage image created > maxAgeHours ago (COPPA NFR-4 Backstop Job)
export async function runCoppaRetentionCleanup(
  maxAgeHours: number = 48,
  customSupabase?: SupabaseClient
): Promise<CleanupReport> {
  const dbClient = customSupabase || supabaseAdmin;
  const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
  const purgedPaths: string[] = [];

  console.log(`[COPPA Retention Job]: Starting 48-hour backstop purge (cutoff: ${new Date(cutoffTime).toISOString()})...`);

  try {
    // 1. List top-level thread folders in bucket
    const { data: threadFolders, error: folderErr } = await dbClient.storage
      .from(BUCKET_NAME)
      .list('threads', { limit: 100 });

    if (folderErr || !threadFolders) {
      console.warn(`[COPPA Retention Job Notice]: No threads directory found or error: ${folderErr?.message}`);
      return { scannedFiles: 0, purgedFiles: 0, purgedPaths: [] };
    }

    let scannedFilesCount = 0;

    for (const folder of threadFolders) {
      const threadId = folder.name;
      const subPath = `threads/${threadId}/images`;

      // List image files under subPath
      const { data: files, error: listErr } = await dbClient.storage
        .from(BUCKET_NAME)
        .list(subPath, { limit: 100 });

      if (listErr || !files) continue;

      for (const file of files) {
        scannedFilesCount++;
        const filePath = `${subPath}/${file.name}`;
        const fileCreatedAt = file.created_at ? new Date(file.created_at).getTime() : 0;

        // If file created older than cutoffTime (or if maxAgeHours === 0 for testing)
        if (maxAgeHours === 0 || fileCreatedAt < cutoffTime) {
          const { error: removeErr } = await dbClient.storage.from(BUCKET_NAME).remove([filePath]);
          if (!removeErr) {
            purgedPaths.push(filePath);
            clearThreadImageCache(filePath);
            clearThreadImageCache(threadId);
          } else {
            console.error(`[COPPA Retention Job Error]: Failed to purge '${filePath}': ${removeErr.message}`);
          }
        }
      }
    }

    console.log(`[COPPA Retention Job Complete]: Scanned ${scannedFilesCount} files, Purged ${purgedPaths.length} expired files older than ${maxAgeHours}h.`);
    return {
      scannedFiles: scannedFilesCount,
      purgedFiles: purgedPaths.length,
      purgedPaths,
    };
  } catch (err: any) {
    console.error(`[COPPA Retention Job Exception]: ${err.message}`);
    return { scannedFiles: 0, purgedFiles: 0, purgedPaths: [] };
  }
}
