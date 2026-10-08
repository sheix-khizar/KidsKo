type ThreadImage = {
  base64: string;
  mimeType: string;
  updatedAt: number;
};

// In-memory cache mapping threadId or storagePath -> image base64 & mimeType
const threadImageMap = new Map<string, ThreadImage>();

// Persistent mapping threadId -> latest storagePath
const threadStoragePathMap = new Map<string, string>();

// In-flight upload promise registry mapping threadId -> Promise<any>
const pendingUploadsMap = new Map<string, Promise<any>>();

// Keep max 100 recent thread images to prevent memory leaks
const MAX_CACHED_THREADS = 100;

export function setThreadImage(key: string, base64: string, mimeType: string = 'image/jpeg') {
  if (!key || !base64) return;

  // Prune oldest if cache size exceeded
  if (threadImageMap.size >= MAX_CACHED_THREADS) {
    const oldestKey = threadImageMap.keys().next().value;
    if (oldestKey) threadImageMap.delete(oldestKey);
  }

  threadImageMap.set(key, {
    base64,
    mimeType,
    updatedAt: Date.now(),
  });
}

export function getThreadImage(key?: string): ThreadImage | undefined {
  if (!key) return undefined;
  return threadImageMap.get(key);
}

export function setThreadStoragePath(threadId: string, storagePath: string) {
  if (!threadId || !storagePath) return;
  threadStoragePathMap.set(threadId, storagePath);
}

export function getThreadStoragePath(threadId?: string): string | undefined {
  if (!threadId) return undefined;
  return threadStoragePathMap.get(threadId);
}

// Purges RAM Base64 image cache entries for a specific key, path, or threadId (COPPA compliance & storage fallback testing)
export function clearThreadImageCache(keyOrThreadId: string) {
  if (!keyOrThreadId) return;
  threadImageMap.delete(keyOrThreadId);
  for (const k of Array.from(threadImageMap.keys())) {
    if (k.includes(keyOrThreadId)) {
      threadImageMap.delete(k);
    }
  }
}

// Purges all memory stores for a thread (Thread deletion / cleanup)
export function clearAllThreadMemory(threadId: string) {
  if (!threadId) return;
  clearThreadImageCache(threadId);
  threadStoragePathMap.delete(threadId);
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
