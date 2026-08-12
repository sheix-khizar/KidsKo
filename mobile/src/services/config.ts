// Centralized API Base URL configuration for mobile app
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.18.95:3003';

// Derived WebSocket URL for voice streaming (converts http -> ws, https -> wss)
export const WS_URL = API_URL.replace(/^http/, 'ws');

console.log('[API CONFIG] API_URL =', API_URL);
console.log('[VOICE CONFIG] WS_URL =', WS_URL);
