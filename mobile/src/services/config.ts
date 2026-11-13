import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'kidsko_custom_api_url';
export const CURRENT_LAN_IP = '192.168.18.68';

export const isAndroidEmulator = (): boolean => {
  if (Platform.OS !== 'android') return false;
  const constants: any = Platform.constants || {};
  const fingerprint = String(constants.Fingerprint || '').toLowerCase();
  const model = String(constants.Model || '').toLowerCase();
  const brand = String(constants.Brand || '').toLowerCase();
  const hardware = String(constants.Hardware || '').toLowerCase();
  const product = String(constants.Product || '').toLowerCase();
  const manufacturer = String(constants.Manufacturer || '').toLowerCase();

  return (
    model.includes('sdk') ||
    model.includes('emulator') ||
    fingerprint.includes('generic') ||
    fingerprint.includes('sdk') ||
    brand.includes('google') ||
    hardware.includes('goldfish') ||
    hardware.includes('ranchu') ||
    product.includes('sdk') ||
    manufacturer.includes('genymotion')
  );
};

export const getDefaultDevApiUrl = (): string => {
  if (isAndroidEmulator()) {
    // Android emulator's dedicated loopback bridge directly to host machine port 3003
    return 'http://10.0.2.2:3003';
  }
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() && !envUrl.includes('192.168.18.95')) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (Platform.OS === 'android') {
    return `http://${CURRENT_LAN_IP}:3003`;
  }
  return 'http://localhost:3003';
};

// Internal mutable URLs
let currentApiUrl = getDefaultDevApiUrl();
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
    // Automatically purge old stale IP (192.168.18.95)
    if (saved && saved.trim() && !saved.includes('192.168.18.95')) {
      // If on emulator and saved is a local LAN IP that might not route, keep 10.0.2.2 unless user forced it
      if (isAndroidEmulator() && saved.includes('192.168.')) {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        currentApiUrl = 'http://10.0.2.2:3003';
      } else {
        currentApiUrl = saved.trim().replace(/\/+$/, '');
      }
      currentWsUrl = currentApiUrl.replace(/^http/, 'ws');
      API_URL = currentApiUrl;
      WS_URL = currentWsUrl;
      console.log('[CONFIG] Loaded saved API_URL from storage:', currentApiUrl);
      return currentApiUrl;
    } else if (saved && saved.includes('192.168.18.95')) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[CONFIG] Could not load saved API_URL:', err);
  }
  currentApiUrl = getDefaultDevApiUrl();
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
  currentApiUrl = getDefaultDevApiUrl();
  currentWsUrl = currentApiUrl.replace(/^http/, 'ws');
  API_URL = currentApiUrl;
  WS_URL = currentWsUrl;
  console.log('[CONFIG] Reset API_URL to default:', currentApiUrl);
  return currentApiUrl;
}
