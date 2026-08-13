type ThreadImage = {
  base64: string;
  mimeType: string;
  updatedAt: number;
};

// In-memory cache mapping threadId -> latest image base64 & mimeType
const threadImageMap = new Map<string, ThreadImage>();

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
