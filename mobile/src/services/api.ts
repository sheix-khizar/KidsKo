import * as SecureStore from 'expo-secure-store';
import { getApiUrl, setCustomApiUrl, CURRENT_LAN_IP } from './config';

import { configureBilling } from './billing';

const TOKEN_KEY = 'kidsko_access_token';
const USER_ID_KEY = 'kidsko_user_id';
const EMAIL_KEY = 'kidsko_user_email';

const CANDIDATE_HOSTS = [
  'http://10.0.2.2:3003',
  `http://${CURRENT_LAN_IP}:3003`,
  'http://127.0.0.1:3003',
];

async function probeHost(host: string, timeoutMs = 1500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${host}/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function findWorkingHost(): Promise<string | null> {
  for (const host of CANDIDATE_HOSTS) {
    if (await probeHost(host)) {
      return host;
    }
  }
  return null;
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const normPath = path.startsWith('/') ? path : `/${path}`;
  const initialUrl = `${getApiUrl()}${normPath}`;

  try {
    return await fetch(initialUrl, options);
  } catch (err: any) {
    const msg = String(err?.message || '');
    const isConnErr =
      msg.includes('ConnectException') ||
      msg.includes('Network request failed') ||
      msg.includes('Failed to connect') ||
      msg.includes('ECONNREFUSED');

    if (isConnErr) {
      console.warn(`[API] Connection failed to ${initialUrl}. Probing candidate backend hosts...`);
      const workingHost = await findWorkingHost();
      if (workingHost && workingHost !== getApiUrl()) {
        console.log(`[API] Auto-switched to active backend: ${workingHost}`);
        await setCustomApiUrl(workingHost);
        return await fetch(`${workingHost}${normPath}`, options);
      }
    }
    throw err;
  }
}

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
  return SecureStore.getItemAsync(EMAIL_KEY);
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
}

// ---- Auth endpoints ----
export async function register(email: string, password: string) {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data as { userId: string; session: { access_token: string } };
}

export async function login(email: string, password: string) {
  const res = await apiFetch('/api/auth/login', {
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
  const res = await apiFetch('/api/students', {
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

export async function getStudents() {
  const token = await getToken();
  const res = await apiFetch('/api/students', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load students');
  return data.students as { id: string; student_name: string }[];
}

export async function getTranscript(studentId: string) {
  const token = await getToken();
  const res = await apiFetch(`/api/transcript/${studentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load transcript');
  return data as {
    studentName: string;
    messages: { role: string; content: string; message_type: string; created_at: string }[];
  };
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
  const res = await apiFetch(`/api/students/${studentId}/memory`, {
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
  const res = await apiFetch(`/api/students/${studentId}/memory`, {
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
  const res = await apiFetch(`/api/students/${studentId}/memory`, {
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
  const res = await apiFetch(`/api/students/${studentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not delete child profile');
  return data as { success: boolean; deletedStudentId: string };
}

// Category 2 Phase 1: Delete parent account & all family records (App Store Guideline 5.1.1)
export async function deleteAccount(): Promise<{ success: boolean; message: string }> {
  const token = await getToken();
  const res = await apiFetch('/api/auth/account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not delete parent account');
  return data as { success: boolean; message: string };
}

