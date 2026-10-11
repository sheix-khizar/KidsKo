import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './config';

import { configureBilling } from './billing';

const TOKEN_KEY = 'kidsko_access_token';
const USER_ID_KEY = 'kidsko_user_id';

// ---- Token storage helpers ----
export async function saveToken(token: string, userId?: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (userId) {
    await SecureStore.setItemAsync(USER_ID_KEY, userId);
    configureBilling(userId);
  }
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
}

// ---- Auth endpoints ----
export async function register(email: string, password: string) {
  const res = await fetch(`${getApiUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data as { userId: string; session: { access_token: string } };
}

export async function login(email: string, password: string) {
  const res = await fetch(`${getApiUrl()}/api/auth/login`, {
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
  const res = await fetch(`${getApiUrl()}/api/students`, {
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
  const res = await fetch(`${getApiUrl()}/api/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load students');
  return data.students as { id: string; student_name: string }[];
}

export async function getTranscript(studentId: string) {
  const token = await getToken();
  const res = await fetch(`${getApiUrl()}/api/transcript/${studentId}`, {
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
  const res = await fetch(`${getApiUrl()}/api/students/${studentId}/memory`, {
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
  const res = await fetch(`${getApiUrl()}/api/students/${studentId}/memory`, {
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
  const res = await fetch(`${getApiUrl()}/api/students/${studentId}/memory`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not clear student memory');
  return data as { success: boolean; studentId: string };
}
