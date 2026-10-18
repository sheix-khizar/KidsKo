export const colors = {
  // Brand accents
  coral: '#FF6B6B',
  coralStrong: '#D94A4A', // WCAG 4.5:1+ contrast against white for buttons & text
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

  // Text & Borders
  text: '#2D3436',
  subtext: '#636E72',
  border: '#F0E6D3',
  borderLight: '#F5ECE0',

  // Status & Role
  parentNavy: '#1E3A5F',
  parentBlue: '#2980B9',
  error: '#D94A4A',
  errorBg: '#FFEAEA',
  errorBorder: '#FFC7C7',
  warningBg: '#FFF3CD',
  warningBorder: '#FFEEBA',
  warningText: '#856404',
  mutedText: '#B2BEC3',
  disabledBg: '#E2E8F0',
  success: '#00B894',
  white: '#FFFFFF',
} as const;

export type ColorName = keyof typeof colors;
