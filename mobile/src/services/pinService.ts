import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'kidsko_parent_pin_hash';
const PIN_SALT_KEY = 'kidsko_parent_pin_salt';
const FAIL_COUNT_KEY = 'kidsko_parent_pin_fail_count';
const LOCKOUT_UNTIL_KEY = 'kidsko_parent_pin_lockout_until';
const UNLOCK_TIMESTAMP_KEY = 'kidsko_parents_unlocked_at';

// Pure-JS SHA-256 implementation (standard FIPS 180-4, zero external dependencies)
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let i2 = 3; i2 >= 0; i2--) {
      const c = (hash[i] >> (i2 * 8)) & 255;
      result += (c < 16 ? '0' : '') + c.toString(16);
    }
  }
  return result;
}

function generateSalt(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let salt = '';
  for (let i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/** Check if parent PIN is configured */
export async function isPinConfigured(): Promise<boolean> {
  try {
    const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
    return !!hash && hash.length === 64;
  } catch {
    return false;
  }
}

/** Set or update the 4-digit PIN */
export async function savePin(pin: string): Promise<void> {
  const cleanPin = pin.trim();
  if (cleanPin.length !== 4) {
    throw new Error('PIN must be exactly 4 digits');
  }
  const salt = generateSalt();
  const hash = sha256(`${cleanPin}_${salt}`);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.deleteItemAsync(FAIL_COUNT_KEY);
  await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
}

/** Check current lockout status */
export async function getLockoutStatus(): Promise<{ isLocked: boolean; secondsRemaining: number }> {
  try {
    const untilStr = await SecureStore.getItemAsync(LOCKOUT_UNTIL_KEY);
    if (!untilStr) return { isLocked: false, secondsRemaining: 0 };
    const until = parseInt(untilStr, 10);
    const now = Date.now();
    if (until > now) {
      const remaining = Math.ceil((until - now) / 1000);
      return { isLocked: true, secondsRemaining: remaining };
    }
    return { isLocked: false, secondsRemaining: 0 };
  } catch {
    return { isLocked: false, secondsRemaining: 0 };
  }
}

/** Verify a submitted 4-digit PIN */
export async function verifyPin(
  pin: string
): Promise<{ success: boolean; isLocked: boolean; secondsRemaining: number; failCount: number }> {
  const lockout = await getLockoutStatus();
  if (lockout.isLocked) {
    return { success: false, isLocked: true, secondsRemaining: lockout.secondsRemaining, failCount: 5 };
  }

  const salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);

  if (!salt || !storedHash) {
    return { success: false, isLocked: false, secondsRemaining: 0, failCount: 0 };
  }

  const computedHash = sha256(`${pin.trim()}_${salt}`);
  if (computedHash === storedHash) {
    // Reset failure counter on correct PIN
    await SecureStore.deleteItemAsync(FAIL_COUNT_KEY);
    await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
    await recordUnlockSession();
    return { success: true, isLocked: false, secondsRemaining: 0, failCount: 0 };
  }

  // Increment failure count
  let currentFails = 1;
  try {
    const rawFails = await SecureStore.getItemAsync(FAIL_COUNT_KEY);
    currentFails = (rawFails ? parseInt(rawFails, 10) : 0) + 1;
    await SecureStore.setItemAsync(FAIL_COUNT_KEY, currentFails.toString());
  } catch {}

  // Lockout after 5 failed attempts: 30s base, 60s for subsequent multiples
  if (currentFails >= 5) {
    const lockoutDurationSec = currentFails >= 10 ? 120 : currentFails >= 7 ? 60 : 30;
    const lockoutUntil = Date.now() + lockoutDurationSec * 1000;
    await SecureStore.setItemAsync(LOCKOUT_UNTIL_KEY, lockoutUntil.toString());
    return { success: false, isLocked: true, secondsRemaining: lockoutDurationSec, failCount: currentFails };
  }

  return { success: false, isLocked: false, secondsRemaining: 0, failCount: currentFails };
}

/** Clear all stored PIN data */
export async function removePin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(FAIL_COUNT_KEY);
  await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
  await SecureStore.deleteItemAsync(UNLOCK_TIMESTAMP_KEY);
}

/** Record session unlock timestamp */
export async function recordUnlockSession(): Promise<void> {
  try {
    await SecureStore.setItemAsync(UNLOCK_TIMESTAMP_KEY, Date.now().toString());
  } catch {}
}

/** Check if parent session is still valid (< 5 min idle) */
export async function isParentSessionActive(): Promise<boolean> {
  try {
    const tsStr = await SecureStore.getItemAsync(UNLOCK_TIMESTAMP_KEY);
    if (!tsStr) return false;
    const ts = parseInt(tsStr, 10);
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - ts < fiveMinutes;
  } catch {
    return false;
  }
}

/** Lock parent session immediately */
export async function lockParentSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(UNLOCK_TIMESTAMP_KEY);
  } catch {}
}
