import { getToken } from './api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
    // 429 responses still carry a useful error message — surface it as a normal error
    throw new Error(data.error || 'Failed to send message');
  }
  return data as ChatResponse;
}
