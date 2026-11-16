import { getToken } from './api';
import { getApiUrl } from './config';

export type ThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ThreadMessage = {
  role: 'user' | 'assistant';
  text: string;
  hasImage: boolean;
  imageExpired: boolean;
  createdAt: string;
};

export type GetThreadsResponse = {
  threads: ThreadSummary[];
  nextBefore: string | null;
};

export async function getThreads(studentId: string, before?: string): Promise<GetThreadsResponse> {
  const token = await getToken();
  let url = `${getApiUrl()}/api/chat/threads?studentId=${encodeURIComponent(studentId)}&limit=30`;
  if (before) {
    url += `&before=${encodeURIComponent(before)}`;
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to fetch chat history');
    err.status = res.status;
    throw err;
  }
  return data as GetThreadsResponse;
}

export async function getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
  const token = await getToken();
  const res = await fetch(`${getApiUrl()}/api/chat/threads/${encodeURIComponent(threadId)}/messages?limit=200`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to load messages');
    err.status = res.status;
    throw err;
  }
  return (data.messages || []) as ThreadMessage[];
}

export async function deleteThread(threadId: string): Promise<boolean> {
  const token = await getToken();
  const res = await fetch(`${getApiUrl()}/api/chat/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to delete chat thread');
    err.status = res.status;
    throw err;
  }
  return true;
}
