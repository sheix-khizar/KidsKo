export type GradientSpec = {
  colors: readonly [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export const gradients = {
  primary: {
    colors: ['#FF6B6B', '#FF9F43'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  splash: {
    colors: ['#FFF0F5', '#FFF8F0', '#F0FFF4'] as const,
    start: { x: 0.1, y: 0 },
    end: { x: 0.9, y: 1 },
  },
  callDark: {
    colors: ['#1A1A2E', '#16213E', '#0F3460'] as const,
    start: { x: 0.1, y: 0 },
    end: { x: 0.9, y: 1 },
  },
  parents: {
    colors: ['#1E3A5F', '#2980B9'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  teal: {
    colors: ['#4ECDC4', '#74B9FF'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
} as const;

export type GradientName = keyof typeof gradients;
