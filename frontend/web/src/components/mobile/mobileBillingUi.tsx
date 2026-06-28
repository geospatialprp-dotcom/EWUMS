import { ReactNode } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

export const MOBILE_FIELD_TABS = [
  { tab: 0, key: 'home', label: 'Home', short: 'Home' },
  { tab: 1, key: 'reading', label: 'Meter Reading', short: 'Reading' },
  { tab: 2, key: 'payment', label: 'Collect Payment', short: 'Payment' },
  { tab: 3, key: 'queue', label: 'Offline Queue', short: 'Queue' },
] as const;

export type MobileFieldPhase = 'home' | 'reading' | 'payment' | 'sync';

const PHASE_COLORS: Record<MobileFieldPhase, { gradient: string; soft: string; accent: string; glow: string }> = {
  home: {
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)',
    soft: '#ecfdf5',
    accent: '#0f766e',
    glow: 'rgba(13, 148, 136, 0.28)',
  },
  reading: {
    gradient: 'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)',
    soft: '#eff6ff',
    accent: '#1d4ed8',
    glow: 'rgba(37, 99, 235, 0.28)',
  },
  payment: {
    gradient: 'linear-gradient(135deg, #b45309 0%, #d97706 55%, #f59e0b 100%)',
    soft: '#fffbeb',
    accent: '#b45309',
    glow: 'rgba(217, 119, 6, 0.28)',
  },
  sync: {
    gradient: 'linear-gradient(135deg, #334155 0%, #475569 55%, #64748b 100%)',
    soft: '#f8fafc',
    accent: '#334155',
    glow: 'rgba(71, 85, 105, 0.28)',
  },
};

export function getMobileFieldPhase(tab: number): MobileFieldPhase {
  if (tab === 1) return 'reading';
  if (tab === 2) return 'payment';
  if (tab === 3) return 'sync';
  return 'home';
}

export const mobileFieldShellSx: SxProps<Theme> = {
  minHeight: '100vh',
  bgcolor: '#f1f5f9',
  pb: 'calc(88px + env(safe-area-inset-bottom, 0px))',
};

export const mobileFieldCardSx: SxProps<Theme> = {
  borderRadius: 3,
  border: '1px solid #e2e8f0',
  bgcolor: '#fff',
  boxShadow: '0 8px 28px rgba(15, 23, 42, 0.06)',
  overflow: 'hidden',
};

export const mobileFieldInputSx: SxProps<Theme> = {
  mb: 2,
  '& .MuiInputBase-root': {
    minHeight: 52,
    borderRadius: 2.5,
    bgcolor: '#fff',
    fontSize: '1rem',
  },
  '& .MuiInputLabel-root': {
    fontWeight: 600,
  },
};

export const mobileFieldPrimaryButtonSx = (phase: MobileFieldPhase): SxProps<Theme> => ({
  minHeight: 54,
  borderRadius: 2.5,
  fontWeight: 800,
  fontSize: '1rem',
  textTransform: 'none',
  letterSpacing: '-0.01em',
  boxShadow: `0 10px 24px ${PHASE_COLORS[phase].glow}`,
  background: PHASE_COLORS[phase].gradient,
  '&:hover': {
    background: PHASE_COLORS[phase].gradient,
    filter: 'brightness(0.96)',
  },
});

export const mobileBottomNavSx: SxProps<Theme> = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 20,
  pb: 'env(safe-area-inset-bottom, 0px)',
  borderTop: '1px solid #e2e8f0',
  bgcolor: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 -8px 32px rgba(15, 23, 42, 0.08)',
  '& .MuiTab-root': {
    minHeight: 72,
    py: 1,
    fontWeight: 600,
    fontSize: '0.72rem',
    textTransform: 'none',
    color: '#64748b',
    '&.Mui-selected': { color: '#0f766e', fontWeight: 800 },
  },
  '& .MuiTab-iconWrapper': {
    mb: 0.35,
  },
  '& .MuiTabs-indicator': {
    top: 0,
    height: 3,
    borderRadius: '0 0 3px 3px',
    bgcolor: '#0d9488',
  },
};

export function MobileFieldHeader({
  title,
  subtitle,
  online,
  queueCount,
}: {
  title: string;
  subtitle?: string;
  online: boolean;
  queueCount?: number;
}) {
  return (
    <Box
      sx={{
        px: 2,
        pt: 'max(12px, env(safe-area-inset-top, 0px))',
        pb: 2.5,
        background: 'linear-gradient(160deg, #042f2e 0%, #0f766e 38%, #0d9488 100%)',
        color: '#f8fafc',
        boxShadow: '0 12px 36px rgba(15, 23, 42, 0.18)',
      }}
    >
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box minWidth={0}>
          <Typography variant="overline" sx={{ letterSpacing: '0.14em', fontWeight: 700, color: 'rgba(248,250,252,0.72)' }}>
            Field revenue collection
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(248,250,252,0.88)', fontWeight: 500 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.75}>
          <Chip
            size="small"
            label={online ? 'Online' : 'Offline'}
            sx={{
              fontWeight: 800,
              bgcolor: online ? 'rgba(220,252,231,0.95)' : 'rgba(254,243,199,0.95)',
              color: online ? '#166534' : '#92400e',
              border: '1px solid',
              borderColor: online ? '#86efac' : '#fcd34d',
            }}
          />
          {(queueCount ?? 0) > 0 && (
            <Chip
              size="small"
              label={`${queueCount} pending sync`}
              sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.28)' }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export function MobileKpiTile({
  label,
  value,
  phase = 'home',
}: {
  label: string;
  value: ReactNode;
  phase?: MobileFieldPhase;
}) {
  const colors = PHASE_COLORS[phase];

  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 2.5,
        bgcolor: colors.soft,
        border: `1px solid ${colors.accent}22`,
        minHeight: 88,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, color: colors.accent, letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function MobileActionCard({
  title,
  subtitle,
  phase,
  icon,
  onClick,
  badge,
}: {
  title: string;
  subtitle: string;
  phase: MobileFieldPhase;
  icon: ReactNode;
  onClick: () => void;
  badge?: string;
}) {
  const colors = PHASE_COLORS[phase];

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        textAlign: 'left',
        border: '1px solid #e2e8f0',
        borderRadius: 3,
        p: 2,
        bgcolor: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        boxShadow: '0 6px 20px rgba(15, 23, 42, 0.05)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:active': { transform: 'scale(0.985)' },
        '&:hover': { boxShadow: `0 10px 28px ${colors.glow}` },
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: 2.5,
          display: 'grid',
          placeItems: 'center',
          background: colors.gradient,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0f172a', lineHeight: 1.25 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {subtitle}
        </Typography>
      </Box>
      {badge && (
        <Chip size="small" label={badge} sx={{ fontWeight: 800, bgcolor: colors.soft, color: colors.accent }} />
      )}
    </Box>
  );
}

export function MobileFieldSection({
  title,
  subtitle,
  phase = 'home',
  children,
}: {
  title: string;
  subtitle?: string;
  phase?: MobileFieldPhase;
  children: ReactNode;
}) {
  const colors = PHASE_COLORS[phase];

  return (
    <Box sx={mobileFieldCardSx}>
      <Box px={2} py={1.5} sx={{ borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ width: 4, height: 18, borderRadius: 999, bgcolor: colors.accent }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0f172a' }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
      <Box p={2}>{children}</Box>
    </Box>
  );
}

export function MobileFieldChipRow({ children }: { children: ReactNode }) {
  return (
    <Box display="flex" flexWrap="wrap" gap={0.75}>
      {children}
    </Box>
  );
}

export function MobileCaptureTile({
  label,
  value,
  icon,
  onClick,
  active,
}: {
  label: string;
  value?: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        border: '1px dashed',
        borderColor: active ? '#0d9488' : '#cbd5e1',
        borderRadius: 2.5,
        p: 1.5,
        bgcolor: active ? '#ecfdf5' : '#f8fafc',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        textAlign: 'left',
        mb: 2,
      }}
    >
      <Box sx={{ color: active ? '#0f766e' : '#64748b' }}>{icon}</Box>
      <Box minWidth={0}>
        <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
          {label}
        </Typography>
        {value && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25, wordBreak: 'break-all' }}>
            {value}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function MobilePaymentModeChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Chip
      clickable
      onClick={onClick}
      label={label}
      sx={{
        minHeight: 40,
        px: 0.5,
        fontWeight: 700,
        bgcolor: selected ? '#fef3c7' : '#fff',
        color: selected ? '#92400e' : '#475569',
        border: '1px solid',
        borderColor: selected ? '#f59e0b' : '#e2e8f0',
        boxShadow: selected ? '0 4px 14px rgba(217, 119, 6, 0.18)' : 'none',
      }}
    />
  );
}
