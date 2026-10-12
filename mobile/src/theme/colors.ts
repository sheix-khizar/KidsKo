export const colors = {
  // Brand accents from Prototype
  coral: '#FF6B6B',
  coralStrong: '#D94A4A',
  orange: '#FF9F43',
  sun: '#FFE66D',
  sky: '#4ECDC4',
  mint: '#95E1A3',
  blue: '#74B9FF',
  purple: '#A78BFA',
  pink: '#FD79A8',
  green: '#00B894',

  // Surfaces & Backgrounds
  background: '#FFF8F0', // Warm cream background
  cardBg: '#FFFFFF',
  cardBgMuted: '#FFF3E4',
  darkBg: '#1A1A2E',
  darkSurface: '#16213E',

  // Text & Borders
  text: '#2D3436',
  subtext: '#636E72',
  border: '#F0E6D3',
  borderLight: '#F5ECE0',

  // Status & Role
  parentNavy: '#1E3A5F',
  parentBlue: '#2980B9',
  error: '#EF4444',
  success: '#00B894',
  white: '#FFFFFF',
} as const;

export const gradients = {
  primary: ['#FF6B6B', '#FF9F43'] as const,
  teal: ['#4ECDC4', '#74B9FF'] as const,
  purple: ['#A78BFA', '#FD79A8'] as const,
  parents: ['#1E3A5F', '#2980B9'] as const,
  callDark: ['#1A1A2E', '#16213E', '#0F3460'] as const,
  splash: ['#FFF0F5', '#FFF8F0', '#F0FFF4'] as const,
  greenMint: ['#95E1A3', '#4ECDC4'] as const,
} as const;

export type ColorName = keyof typeof colors;

