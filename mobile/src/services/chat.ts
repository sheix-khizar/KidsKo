import { getToken } from './api';
import { API_URL } from './config';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatResponse = {
  threadId: string;
  reply: string;
  remaining: number;
  isPremium: boolean;
};

export async function sendMessage(studentId: string, message: string, threadId?: string): Promise<ChatResponse> {
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
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to send message');
    err.status = res.status;
    throw err;
  }
  return data as ChatResponse;
}
