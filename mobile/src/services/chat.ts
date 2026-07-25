import { getToken } from './api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export async function sendMessage(studentId: string, message: string, threadId?: string) {
  const token = await getToken();
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ studentId, message, threadId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send message');
  return data as { threadId: string; reply: string };
}
