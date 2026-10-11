// backend/src/lib/chatHistory.ts
// Chat history cleaning and image expiration calculations for client responses

// COPPA & Storage Retention Policy: photos expire after 48 hours.
// This constant MUST match the 48-hour photo retention cleanup job.
export const IMAGE_RETENTION_HOURS = 48;

export interface CleanedClientMessage {
  role: string;
  text: string;
  hasImage: boolean;
  imageExpired: boolean;
  createdAt: string;
}

/**
 * Strips storage/image markers and calculates image expiration based on message age.
 * Ensures raw base64 or internal storage paths are never leaked to client responses.
 */
export function cleanMessageForClient(
  role: string,
  content: string,
  createdAt: string
): CleanedClientMessage {
  const safeContent = content || '';
  const hasImage = safeContent.includes('[STORAGE:') || safeContent.includes('[IMAGE:');

  const createdTime = new Date(createdAt).getTime();
  const ageMs = Date.now() - createdTime;
  const imageExpired = hasImage && ageMs > IMAGE_RETENTION_HOURS * 60 * 60 * 1000;

  // Strip 📸 [STORAGE:...] and legacy [IMAGE:...] base64 content
  let text = safeContent
    .replace(/📸\s*\[STORAGE:[^\]]+\]/gi, '')
    .replace(/\[STORAGE:[^\]]+\]/gi, '')
    .replace(/\[IMAGE:[^\]]+\]/gi, '')
    .trim();

  // If text is empty (photo sent with no typed text), provide friendly fallback
  if (!text && hasImage) {
    text = '📷 Homework photo';
  }

  return {
    role,
    text,
    hasImage,
    imageExpired,
    createdAt,
  };
}
