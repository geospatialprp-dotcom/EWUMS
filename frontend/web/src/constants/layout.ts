/** Responsive breakpoints — mobile-first (matches theme.ts). */
export const BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1366,
  xxl: 1920,
} as const;

export const TOUCH_TARGET_MIN = 44;

export const DRAWER_WIDTH = 260;
export const DRAWER_WIDTH_MINI = 72;

export const APP_TOOLBAR_MIN_HEIGHT = { xs: 64, sm: 68 } as const;
