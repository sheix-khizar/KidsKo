import { Platform } from 'react-native';

/**
 * Centralized API Base URL configuration for the Kidsko mobile app.
 *
 * Networking resolution:
 * 1. Explicit environment override: process.env.EXPO_PUBLIC_API_URL (if provided)
 * 2. Android (Emulator): http://10.0.2.2:3003 (standard NAT loopback to host PC, immune to Wi-Fi IP changes)
 * 3. iOS Simulator / Web: http://localhost:3003
 */
const getDefaultDevApiUrl = (): string => {
  if (Platform.OS === 'android') {
    return 'http://192.168.18.95:3003';
  }
  return 'http://localhost:3003';
};

export const API_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultDevApiUrl();

// Derived WebSocket URL for voice streaming (converts http -> ws, https -> wss)
export const WS_URL = API_URL.replace(/^http/, 'ws');

console.log('[API CONFIG] API_URL =', API_URL);
console.log('[VOICE CONFIG] WS_URL =', WS_URL);

