import { ViewStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  pill: 9999,
  full: 9999,
} as const;

export function createGlowShadow(color = 'rgba(255, 107, 107, 0.45)', radius = 14, height = 6): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height },
    shadowOpacity: 0.4,
    shadowRadius: radius,
    elevation: height + 2,
  };
}

export const shadows = {
  card: {
    shadowColor: '#2D3436',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  button: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  glow: (color = '#FF6B6B', radius = 14, height = 6): ViewStyle => createGlowShadow(color, radius, height),
  mascotSplash: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  mascotCall: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
};
