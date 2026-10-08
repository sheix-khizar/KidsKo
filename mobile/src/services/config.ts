import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'kidsko_custom_api_url';

export const getDefaultDevApiUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3003';
  }
  return 'http://localhost:3003';
};

// Internal mutable URLs
let currentApiUrl = process.env.EXPO_PUBLIC_API_URL || getDefaultDevApiUrl();
let currentWsUrl = currentApiUrl.replace(/^http/, 'ws');

export function getApiUrl(): string {
  return currentApiUrl;
}

export function getWsUrl(): string {
  return currentWsUrl;
}

// Retain legacy exports for backwards compatibility
export let API_URL = currentApiUrl;
export let WS_URL = currentWsUrl;

export async function loadSavedApiUrl(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(STORAGE_KEY);
    if (saved && saved.trim()) {
      currentApiUrl = saved.trim().replace(/\/+$/, '');
      currentWsUrl = currentApiUrl.replace(/^http/, 'ws');
      API_URL = currentApiUrl;
      WS_URL = currentWsUrl;
      console.log('[CONFIG] Loaded saved API_URL from storage:', currentApiUrl);
      return currentApiUrl;
    }
  } catch (err) {
    console.warn('[CONFIG] Could not load saved API_URL:', err);
  }
  return currentApiUrl;
}

export async function setCustomApiUrl(newUrl: string): Promise<string> {
  let cleanUrl = newUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }
  currentApiUrl = cleanUrl;
  currentWsUrl = cleanUrl.replace(/^http/, 'ws');
  API_URL = currentApiUrl;
  WS_URL = currentWsUrl;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, cleanUrl);
    console.log('[CONFIG] Saved custom API_URL to storage:', cleanUrl);
  } catch (err) {
    console.warn('[CONFIG] Could not save API_URL to storage:', err);
  }
  return cleanUrl;
}

export async function resetApiUrlToDefault(): Promise<string> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {}
  currentApiUrl = process.env.EXPO_PUBLIC_API_URL || getDefaultDevApiUrl();
  currentWsUrl = currentApiUrl.replace(/^http/, 'ws');
  API_URL = currentApiUrl;
  WS_URL = currentWsUrl;
  console.log('[CONFIG] Reset API_URL to default:', currentApiUrl);
  return currentApiUrl;
}
