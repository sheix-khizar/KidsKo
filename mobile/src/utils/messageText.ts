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

export type FormattedTextSpan = {
  text: string;
  bold: boolean;
};

/**
 * Parses a string containing markdown bold syntax (**bold**) into an array of styled text spans.
 */
export function parseFormattedText(content: string): FormattedTextSpan[] {
  if (!content || typeof content !== 'string') return [];
  const parts: FormattedTextSpan[] = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: content.substring(lastIndex, match.index), bold: false });
    }
    if (match[1]) {
      parts.push({ text: match[1], bold: true });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ text: content.substring(lastIndex), bold: false });
  }

  return parts;
}
