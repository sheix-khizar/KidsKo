/**
 * Shared message text cleaner for ChatScreen and TranscriptScreen.
 * Strips raw storage markers ([STORAGE:...]) and legacy base64 image strings ([IMAGE:...]).
 * When a photo message has no typed question, returns "📷 Homework photo".
 */
export function cleanMessageText(content: string): string {
  if (!content || typeof content !== 'string') return '';

  if (content.includes('[STORAGE:') || content.includes('[IMAGE:')) {
    const cleaned = content
      .replace(/📸\s*\[STORAGE:.*?\]\s*/g, '📸 ')
      .replace(/📸\s*\[IMAGE:.*?\]\s*/g, '📸 ')
      .replace(/\[STORAGE:.*?\]\s*/g, '')
      .replace(/\[IMAGE:.*?\]\s*/g, '')
      .trim();

    if (!cleaned || cleaned === '📸' || cleaned === '📷') {
      return '📷 Homework photo';
    }

    return cleaned;
  }

  return content;
}
