import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'kidsko_custom_api_url';

export const isAndroidEmulator = (): boolean => {
  if (Platform.OS !== 'android') return false;
  const constants: any = Platform.constants || {};
  const model = String(constants.Model || '').toLowerCase();
  const fingerprint = String(constants.Fingerprint || '').toLowerCase();
  const brand = String(constants.Brand || '').toLowerCase();
  const hardware = String(constants.Hardware || '').toLowerCase();
  return (
    model.includes('sdk') ||
    model.includes('emulator') ||
    fingerprint.includes('generic') ||
    fingerprint.includes('vbox') ||
    brand.includes('generic') ||
    hardware.includes('ranchu') ||
    hardware.includes('goldfish')
  );
};

export const resolveDevUrl = (url: string): string => {
  if (isAndroidEmulator() && (url.includes('192.168.') || url.includes('localhost') || url.includes('127.0.0.1'))) {
    return url.replace(/http:\/\/[^:]+(:3003.*)/, 'http://10.0.2.2$1');
  }
  return url;
};

export const getDefaultDevApiUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3003';
  }
  return 'http://localhost:3003';
};

// Internal mutable URLs
let rawApiUrl = process.env.EXPO_PUBLIC_API_URL || getDefaultDevApiUrl();
let currentApiUrl = resolveDevUrl(rawApiUrl);
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
    // Purge outdated stale IPs (192.168.18.68 or unreachable LAN IPs on emulator)
    if (saved && saved.trim()) {
      const resolved = resolveDevUrl(saved.trim().replace(/\/+$/, ''));
      currentApiUrl = resolved;
      currentWsUrl = currentApiUrl.replace(/^http/, 'ws');
      API_URL = currentApiUrl;
      WS_URL = currentWsUrl;
      console.log('[CONFIG] Loaded saved API_URL from storage:', currentApiUrl);
      return currentApiUrl;
    }
  } catch (err) {
    console.warn('[CONFIG] Could not load saved API_URL:', err);
  }
  const fallback = process.env.EXPO_PUBLIC_API_URL || getDefaultDevApiUrl();
  currentApiUrl = resolveDevUrl(fallback);
  currentWsUrl = currentApiUrl.replace(/^http/, 'ws');
  API_URL = currentApiUrl;
  WS_URL = currentWsUrl;
  return currentApiUrl;
}

export async function setCustomApiUrl(newUrl: string): Promise<string> {
  let cleanUrl = newUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }
  cleanUrl = resolveDevUrl(cleanUrl);
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
  } catch { }
  const fallback = process.env.EXPO_PUBLIC_API_URL || getDefaultDevApiUrl();
  currentApiUrl = resolveDevUrl(fallback);
  currentWsUrl = currentApiUrl.replace(/^http/, 'ws');
  API_URL = currentApiUrl;
  WS_URL = currentWsUrl;
  console.log('[CONFIG] Reset API_URL to default:', currentApiUrl);
  return currentApiUrl;
}
