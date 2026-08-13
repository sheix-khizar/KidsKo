type ThreadImage = {
  base64: string;
  mimeType: string;
  updatedAt: number;
};

// In-memory cache mapping threadId -> latest image base64 & mimeType
const threadImageMap = new Map<string, ThreadImage>();

// In-flight upload promise registry mapping threadId -> Promise<any>
const pendingUploadsMap = new Map<string, Promise<any>>();

// Keep max 100 recent thread images to prevent memory leaks
const MAX_CACHED_THREADS = 100;

export function setThreadImage(threadId: string, base64: string, mimeType: string = 'image/jpeg') {
  if (!threadId || !base64) return;

  // Prune oldest if cache size exceeded
  if (threadImageMap.size >= MAX_CACHED_THREADS) {
    const oldestKey = threadImageMap.keys().next().value;
    if (oldestKey) threadImageMap.delete(oldestKey);
  }

  threadImageMap.set(threadId, {
    base64,
    mimeType,
    updatedAt: Date.now(),
  });
}

export function getThreadImage(threadId?: string): ThreadImage | undefined {
  if (!threadId) return undefined;
  return threadImageMap.get(threadId);
}

// Register an in-flight image compression/upload promise for a thread
export function registerPendingUpload(threadId: string, promise: Promise<any>) {
  if (!threadId || !promise) return;
  pendingUploadsMap.set(threadId, promise);
  promise.finally(() => {
    if (pendingUploadsMap.get(threadId) === promise) {
      pendingUploadsMap.delete(threadId);
    }
  });
}

// Await any in-flight image upload for a thread to prevent race conditions
export async function awaitPendingUpload(threadId?: string): Promise<void> {
  if (!threadId) return;
  const pending = pendingUploadsMap.get(threadId);
  if (pending) {
    console.log(`[Race Condition Shield]: Awaiting in-flight image processing/upload for thread ${threadId}...`);
    try {
      await pending;
    } catch (err: any) {
      console.warn(`[Race Condition Shield]: In-flight image processing for thread ${threadId} encountered error (${err?.message})`);
    }
  }
}
