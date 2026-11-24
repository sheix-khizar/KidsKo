import { Vibration, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const VIBRATION_STORE_KEY = 'kidsko_vibration_enabled';

let vibrationEnabledCache = true;
let prefsLoaded = false;
let audioModeReady = false;

const SAMPLE_RATE = 22050;
const soundUriCache = new Map<string, string>();

export type KidSoundType = 'start' | 'pop' | 'key' | 'next' | 'back' | 'celebrate';

/**
 * Load persisted vibration preference into memory so feedback triggers instantaneously.
 */
export async function loadFeedbackPreferences(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(VIBRATION_STORE_KEY);
    vibrationEnabledCache = val === null ? true : val === 'true';
    prefsLoaded = true;
  } catch {
    vibrationEnabledCache = true;
  }
  return vibrationEnabledCache;
}

// Warm cache eagerly on app startup
void loadFeedbackPreferences();

export function isVibrationEnabled(): boolean {
  return vibrationEnabledCache;
}

export async function setVibrationEnabled(enabled: boolean): Promise<void> {
  vibrationEnabledCache = enabled;
  prefsLoaded = true;
  try {
    await SecureStore.setItemAsync(VIBRATION_STORE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore SecureStore write errors in restricted environments
  }
}

/**
 * Trigger tactile vibration if enabled in Parental Controls.
 */
export function vibrateTap(pattern: 'light' | 'medium' | 'success' | 'error' = 'light'): void {
  if (!prefsLoaded) {
    void loadFeedbackPreferences();
  }
  if (!vibrationEnabledCache) return;

  try {
    if (pattern === 'light') {
      Vibration.vibrate(Platform.OS === 'android' ? 18 : 12);
    } else if (pattern === 'medium') {
      Vibration.vibrate(Platform.OS === 'android' ? 32 : 20);
    } else if (pattern === 'success') {
      Vibration.vibrate([0, 22, 45, 34]);
    } else if (pattern === 'error') {
      Vibration.vibrate([0, 40, 40, 40]);
    }
  } catch {
    // Never crash UI if device lacks vibrator hardware
  }
}

type SynthNote = {
  freq: number;
  endFreq?: number;
  delayMs: number;
  durationMs: number;
  volume?: number;
};

function encodePcmToWavDataUri(samples: Float32Array): string {
  const numSamples = samples.length;
  const dataByteLength = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
  view.setUint32(4, 36 + dataByteLength, true);
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);

  // fmt chunk
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // data chunk
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function buildChimeUri(notes: SynthNote[]): { uri: string; totalDurationMs: number } {
  const totalMs = notes.reduce((acc, n) => Math.max(acc, n.delayMs + n.durationMs), 80) + 30;
  const totalSamples = Math.floor((totalMs / 1000) * SAMPLE_RATE);
  const mix = new Float32Array(totalSamples);

  for (const note of notes) {
    const startIdx = Math.floor((note.delayMs / 1000) * SAMPLE_RATE);
    const lenSamples = Math.floor((note.durationMs / 1000) * SAMPLE_RATE);
    const vol = note.volume ?? 0.38;
    const attackSamples = Math.max(1, Math.floor(0.008 * SAMPLE_RATE));
    let phase = 0;

    for (let i = 0; i < lenSamples && startIdx + i < totalSamples; i++) {
      const t = i / lenSamples;
      const freq = note.endFreq
        ? note.freq + (note.endFreq - note.freq) * t
        : note.freq;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;

      const attack = i < attackSamples ? i / attackSamples : 1;
      const decay = Math.pow(1 - t, 1.8);
      // Warm marimba-like tone: fundamental + subtle octave harmonic
      const wave = Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.18 + Math.sin(phase * 3) * 0.04;
      mix[startIdx + i] += wave * attack * decay * vol;
    }
  }

  return {
    uri: encodePcmToWavDataUri(mix),
    totalDurationMs: totalMs,
  };
}

const SOUND_NOTES: Record<string, SynthNote[]> = {
  start: [
    { freq: 523.25, delayMs: 0, durationMs: 110, volume: 0.34 },
    { freq: 659.25, delayMs: 65, durationMs: 110, volume: 0.34 },
    { freq: 783.99, delayMs: 130, durationMs: 130, volume: 0.36 },
    { freq: 1046.5, delayMs: 200, durationMs: 190, volume: 0.4 },
  ],
  pop: [
    { freq: 587.33, endFreq: 880, delayMs: 0, durationMs: 85, volume: 0.34 },
  ],
  next: [
    { freq: 659.25, delayMs: 0, durationMs: 100, volume: 0.32 },
    { freq: 987.77, delayMs: 75, durationMs: 150, volume: 0.35 },
  ],
  back: [
    { freq: 659.25, delayMs: 0, durationMs: 85, volume: 0.28 },
    { freq: 523.25, delayMs: 60, durationMs: 120, volume: 0.26 },
  ],
  celebrate: [
    { freq: 523.25, delayMs: 0, durationMs: 120, volume: 0.32 },
    { freq: 659.25, delayMs: 75, durationMs: 120, volume: 0.34 },
    { freq: 783.99, delayMs: 150, durationMs: 130, volume: 0.36 },
    { freq: 1046.5, delayMs: 225, durationMs: 220, volume: 0.42 },
    { freq: 1318.51, delayMs: 300, durationMs: 260, volume: 0.36 },
  ],
};

const XYLOPHONE_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

function getSoundData(type: KidSoundType, keyIndex = 0): { uri: string; durationMs: number } {
  const cacheKey = type === 'key' ? `key_${keyIndex % XYLOPHONE_SCALE.length}` : type;
  const cached = soundUriCache.get(cacheKey);
  if (cached) {
    return { uri: cached, durationMs: type === 'celebrate' ? 600 : type === 'start' ? 420 : 250 };
  }

  const notes: SynthNote[] =
    type === 'key'
      ? [{ freq: XYLOPHONE_SCALE[keyIndex % XYLOPHONE_SCALE.length], delayMs: 0, durationMs: 110, volume: 0.35 }]
      : SOUND_NOTES[type] || SOUND_NOTES.pop;

  const built = buildChimeUri(notes);
  soundUriCache.set(cacheKey, built.uri);
  return { uri: built.uri, durationMs: built.totalDurationMs };
}

/**
 * Play a colorful kid-friendly marimba/xylophone UI sound using expo-audio.
 */
export async function playKidSound(type: KidSoundType, keyIndex = 0): Promise<void> {
  try {
    if (!audioModeReady) {
      audioModeReady = true;
      await setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
      }).catch(() => {});
    }

    const { uri, durationMs } = getSoundData(type, keyIndex);
    const player = createAudioPlayer({ uri });
    player.volume = 0.65;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try {
        player.remove();
      } catch {}
    };

    const sub = player.addListener('playbackStatusUpdate', (status: any) => {
      if (status?.didJustFinish) {
        try {
          sub?.remove?.();
        } catch {}
        cleanup();
      }
    });

    player.play();
    setTimeout(cleanup, durationMs + 500);
  } catch {
    // Sound effects are strictly best-effort and never block interaction
  }
}

/**
 * Trigger both tactile vibration (if enabled) and playful sound feedback.
 */
export function triggerKidFeedback(
  sound: KidSoundType,
  options?: { vibration?: 'light' | 'medium' | 'success' | 'error'; keyIndex?: number }
): void {
  vibrateTap(options?.vibration ?? (sound === 'celebrate' ? 'success' : sound === 'start' || sound === 'next' ? 'medium' : 'light'));
  void playKidSound(sound, options?.keyIndex ?? 0);
}
