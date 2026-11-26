import * as SecureStore from 'expo-secure-store';

export type AvatarId = 'girl' | 'boy' | 'kid' | 'astronaut' | 'hero' | 'fairy';

export type AvatarOption = {
  id: AvatarId;
  emoji: string;
  label: string;
  colors: readonly [string, string];
  bg: string;
};

export const CHILD_AVATARS: readonly AvatarOption[] = [
  { id: 'girl', emoji: '👧', label: 'Girl', colors: ['#FF6B6B', '#FF9F43'] as const, bg: '#FFF0EE' },
  { id: 'boy', emoji: '👦', label: 'Boy', colors: ['#4ECDC4', '#74B9FF'] as const, bg: '#EBF8FF' },
  { id: 'kid', emoji: '🧒', label: 'Explorer', colors: ['#A78BFA', '#FD79A8'] as const, bg: '#F4EEFF' },
  { id: 'astronaut', emoji: '👩‍🚀', label: 'Astronaut', colors: ['#95E1A3', '#4ECDC4'] as const, bg: '#EAFBF3' },
  { id: 'hero', emoji: '🦸', label: 'Hero', colors: ['#FFE66D', '#FF9F43'] as const, bg: '#FFF8E1' },
  { id: 'fairy', emoji: '🧚', label: 'Spark', colors: ['#FD79A8', '#A78BFA'] as const, bg: '#FFF0F7' },
];

const AVATAR_STORE_PREFIX = 'kidsko_avatar_';

export function getAvatarOption(avatarOrEmoji?: string | null): AvatarOption {
  if (avatarOrEmoji) {
    const clean = avatarOrEmoji.trim();
    const matched = CHILD_AVATARS.find((a) => a.id === clean || a.emoji === clean);
    if (matched) return matched;
  }
  return CHILD_AVATARS[0];
}

export async function saveLocalStudentAvatar(studentId: string, avatar: string): Promise<void> {
  if (!studentId || !avatar) return;
  try {
    const opt = getAvatarOption(avatar);
    await SecureStore.setItemAsync(`${AVATAR_STORE_PREFIX}${studentId}`, opt.id);
  } catch {}
}

export async function getLocalStudentAvatar(studentId: string): Promise<AvatarId | null> {
  if (!studentId) return null;
  try {
    const val = await SecureStore.getItemAsync(`${AVATAR_STORE_PREFIX}${studentId}`);
    if (!val) return null;
    return getAvatarOption(val).id;
  } catch {
    return null;
  }
}

export async function removeLocalStudentAvatar(studentId: string): Promise<void> {
  if (!studentId) return;
  try {
    await SecureStore.deleteItemAsync(`${AVATAR_STORE_PREFIX}${studentId}`);
  } catch {}
}
