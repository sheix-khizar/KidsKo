import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getApiUrl, setCustomApiUrl } from './config';
import { clearPin } from './pinService';

import { configureBilling } from './billing';

const TOKEN_KEY = 'kidsko_access_token';
const USER_ID_KEY = 'kidsko_user_id';
const EMAIL_KEY = 'kidsko_user_email';

// ---- Token storage helpers ----
export async function saveToken(token: string, userId?: string, email?: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (userId) {
    await SecureStore.setItemAsync(USER_ID_KEY, userId);
    configureBilling(userId);
  }
  if (email) {
    await SecureStore.setItemAsync(EMAIL_KEY, email);
  }
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const cached = await SecureStore.getItemAsync(EMAIL_KEY);
  if (cached && cached.trim()) return cached.trim();
  // Fallback: Query backend /api/auth/me to fetch email if signed in before email tracking
  try {
    const token = await getToken();
    if (!token) return null;
    const res = await fetchWithTimeout(`${getApiUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }, 4000);
    if (res.ok) {
      const data = await res.json();
      if (data?.email) {
        await SecureStore.setItemAsync(EMAIL_KEY, data.email);
        return data.email;
      }
    }
  } catch {}
  return null;
}

export async function getSavedUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(USER_ID_KEY);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_ID_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
  try {
    await SecureStore.deleteItemAsync('kidsko_custom_api_url');
  } catch {}
  try {
    await clearPin();
  } catch {}
}

// Helper: fetch with 4s timeout to prevent UI freezing on dead/stale IPs with auto-fallback to Android emulator host
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (Platform.OS === 'android' && !url.includes('10.0.2.2')) {
      const fallbackUrl = url.replace(/http:\/\/[0-9.]+(:3003.*)/, 'http://10.0.2.2$1');
      if (fallbackUrl !== url) {
        try {
          const fallbackRes = await fetch(fallbackUrl, options);
          if (fallbackRes.ok) {
            // Persist the working host immediately so subsequent calls don't stall
            setCustomApiUrl('http://10.0.2.2:3003').catch(() => {});
          }
          return fallbackRes;
        } catch {}
      }
    }
    if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
      throw new Error(`Connection timed out (${Math.round(timeoutMs / 1000)}s). Please check server IP.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Auth endpoints ----
export async function register(email: string, password: string) {
  const res = await fetchWithTimeout(`${getApiUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data as { userId: string; session: { access_token: string } };
}

export async function login(email: string, password: string) {
  const res = await fetchWithTimeout(`${getApiUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data as { userId: string; session: { access_token: string } };
}

// ---- Student endpoints (require a token) ----
export async function createStudent(studentName: string) {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/students`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ student_name: studentName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not create student');
  return data.student;
}

export async function updateStudent(studentId: string, studentName: string) {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/students/${studentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ student_name: studentName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not update student');
  return data.student as { id: string; student_name: string };
}

export async function getStudents() {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load students');
  return data.students as { id: string; student_name: string }[];
}

export async function getTranscript(studentId: string) {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/transcript/${studentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load transcript');
  return data as {
    studentName: string;
    messages: { role: string; content: string; message_type: string; created_at: string }[];
  };
}

export type ChatThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
  message_count?: number;
};

export async function getChatThreads(studentId: string): Promise<ChatThreadSummary[]> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/chat/threads?studentId=${studentId}&limit=30`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load threads');
  return (data.threads || []) as ChatThreadSummary[];
}

// ---- Student Memory endpoints (Stage 10 / Step 4.5 mobile half) ----
export type StudentMemoryData = {
  studentId: string;
  studentName?: string;
  preferredName: string | null;
  facts: string[];
  enabled: boolean;
};

export async function getStudentMemory(studentId: string): Promise<StudentMemoryData> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/students/${studentId}/memory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load student memory');
  return data as StudentMemoryData;
}

export async function updateStudentMemory(
  studentId: string,
  updates: { enabled?: boolean; preferredName?: string | null; facts?: string[] }
): Promise<StudentMemoryData> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/students/${studentId}/memory`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not update student memory');
  return data as StudentMemoryData;
}

export async function clearStudentMemory(studentId: string): Promise<{ success: boolean; studentId: string }> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/students/${studentId}/memory`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not clear student memory');
  return data as { success: boolean; studentId: string };
}

// Category 2 Phase 1: Delete child profile permanently
export async function deleteStudent(studentId: string): Promise<{ success: boolean; deletedStudentId: string }> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/students/${studentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not delete child profile');
  return data as { success: boolean; deletedStudentId: string };
}

// Real Learning Activity endpoints
export type TopicSummary = {
  name: string;
  icon: string;
  count: number;
  color: string;
};

export type StudentActivityData = {
  studentId: string;
  studentName: string;
  questionsToday: number;
  questionsThisWeek: number;
  topicsExplored: number;
  streak: number;
  dailyCounts: Record<string, number>;
  topics?: TopicSummary[];
};

export async function getStudentActivity(studentId: string): Promise<StudentActivityData> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/students/${studentId}/activity`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load student activity');
  return data as StudentActivityData;
}

// Enforce Chat Retention pruning
export async function pruneChatRetention(retentionDays: number): Promise<{ success: boolean; prunedCount: number }> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/chat/retention/prune`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ retentionDays }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not prune chat history');
  return data as { success: boolean; prunedCount: number };
}

// Category 2: Delete parent account & all family records (App Store Guideline 5.1.1 compliant)
export async function deleteAccount(password: string): Promise<{ success: boolean; message: string }> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/auth/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not delete parent account');
  return data as { success: boolean; message: string };
}

// Update parent account password
export async function updateParentPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/auth/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not update password');
  return data as { success: boolean; message: string };
}

// Update parent account email
export async function updateParentEmail(password: string, newEmail: string): Promise<{ success: boolean; email: string; message: string }> {
  const token = await getToken();
  const res = await fetchWithTimeout(`${getApiUrl()}/api/auth/email`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password, newEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not update email');
  if (data?.email) {
    await SecureStore.setItemAsync(EMAIL_KEY, data.email);
  }
  return data as { success: boolean; email: string; message: string };
}

