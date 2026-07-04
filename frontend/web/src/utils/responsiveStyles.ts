import type { SxProps, Theme } from '@mui/material';
import { TOUCH_TARGET_MIN } from '../constants/layout';

/** Prevent page-level horizontal scroll; use inside scroll regions instead. */
export function responsivePageSx(): SxProps<Theme> {
  return {
    minWidth: 0,
    maxWidth: '100%',
    overflowX: 'hidden',
  };
}

/** Wide data tables — horizontal scroll on small screens, full width on desktop. */
export function responsiveTableScrollSx(): SxProps<Theme> {
  return {
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    '& .MuiTable-root': {
      minWidth: { xs: 640, md: '100%' },
    },
  };
}

/** Two-column form/grid that stacks on mobile. */
export function responsiveGrid2ColSx(): SxProps<Theme> {
  return {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
    gap: { xs: 1.5, sm: 2 },
  };
}

/** KPI / card grid — 1 → 2 → 3 → 4 columns by breakpoint. */
export function responsiveCardGridSx(): SxProps<Theme> {
  return {
    display: 'grid',
    gridTemplateColumns: {
      xs: '1fr',
      sm: 'repeat(2, minmax(0, 1fr))',
      lg: 'repeat(3, minmax(0, 1fr))',
      xl: 'repeat(4, minmax(0, 1fr))',
    },
    gap: { xs: 1.5, sm: 2 },
  };
}

/** Dialog — full-bleed on phones, centered card on tablet+. */
export function responsiveDialogPaperSx(): SxProps<Theme> {
  return {
    m: { xs: 1, sm: 2 },
    width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
    maxWidth: { xs: '100%', sm: 560, md: 720, lg: 900 },
    maxHeight: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
  };
}

/** Stack page header actions below title on narrow screens. */
export function responsiveHeaderStackSx(): SxProps<Theme> {
  return {
    display: 'flex',
    flexDirection: { xs: 'column', sm: 'row' },
    alignItems: { xs: 'stretch', sm: 'center' },
    justifyContent: 'space-between',
    gap: { xs: 1.5, sm: 2 },
  };
}

/** Touch-friendly icon / button target. */
export function touchTargetSx(): SxProps<Theme> {
  return {
    minWidth: TOUCH_TARGET_MIN,
    minHeight: TOUCH_TARGET_MIN,
  };
}

/** Map / chart container — fixed aspect on mobile, flexible height on desktop. */
export function responsiveChartContainerSx(minHeight = 240): SxProps<Theme> {
  return {
    width: '100%',
    minWidth: 0,
    minHeight: { xs: minHeight, md: minHeight + 80 },
    maxHeight: { xs: 360, lg: 'none' },
    '& canvas, & svg': { maxWidth: '100%', height: 'auto' },
  };
}
