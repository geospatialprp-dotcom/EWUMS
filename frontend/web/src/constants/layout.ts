export const BREAKPOINTS = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
} as const;

export const TOUCH_TARGET_MIN = 44;

export const DRAWER_WIDTH = 200;
export const DRAWER_WIDTH_MINI = 60;

export const APP_TOOLBAR_MIN_HEIGHT = {
  xs: 64,
  sm: 68,
} as const;

export const APP_HEADER_HEIGHT_MD = APP_TOOLBAR_MIN_HEIGHT.sm;
