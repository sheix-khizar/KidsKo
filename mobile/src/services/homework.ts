import { getToken } from './api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export async function analyzeHomework(studentId: string, imageBase64: string, threadId?: string) {
  const token = await getToken();
  const res = await fetch(`${API_URL}/api/homework/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ studentId, imageBase64, threadId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not analyze homework image.');
  return data as { threadId: string; explanation: string };
}
