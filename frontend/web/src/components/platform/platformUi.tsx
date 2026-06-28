import { ReactNode } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { PLATFORM_MODULE_GROUPS } from '../../constants/platformModules';
import type { PlatformModule, PlatformModuleStatus } from '../../constants/platformModules';

export type PlatformGroupKey = (typeof PLATFORM_MODULE_GROUPS)[number]['key'];

const GROUP_THEMES: Record<PlatformGroupKey, { gradient: string; chip: string; bar: string; glow: string; soft: string }> = {
  'planning-construction': {
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
    chip: '#dbeafe',
    bar: '#2563eb',
    glow: 'rgba(37, 99, 235, 0.28)',
    soft: '#eff6ff',
  },
  'gis-assets': {
    gradient: 'linear-gradient(135deg, #0e7490 0%, #0891b2 55%, #22d3ee 100%)',
    chip: '#cffafe',
    bar: '#0891b2',
    glow: 'rgba(8, 145, 178, 0.28)',
    soft: '#ecfeff',
  },
  operations: {
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #14b8a6 100%)',
    chip: '#ccfbf1',
    bar: '#0d9488',
    glow: 'rgba(13, 148, 136, 0.28)',
    soft: '#ecfdf5',
  },
  commercial: {
    gradient: 'linear-gradient(135deg, #b45309 0%, #d97706 55%, #f59e0b 100%)',
    chip: '#fef3c7',
    bar: '#d97706',
    glow: 'rgba(217, 119, 6, 0.28)',
    soft: '#fffbeb',
  },
  intelligence: {
    gradient: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #a78bfa 100%)',
    chip: '#ede9fe',
    bar: '#7c3aed',
    glow: 'rgba(124, 58, 237, 0.28)',
    soft: '#f5f3ff',
  },
  'platform-services': {
    gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #6366f1 100%)',
    chip: '#e0e7ff',
    bar: '#4f46e5',
    glow: 'rgba(79, 70, 229, 0.28)',
    soft: '#eef2ff',
  },
};

export function getPlatformGroupTheme(group: string) {
  return GROUP_THEMES[group as PlatformGroupKey] ?? GROUP_THEMES['platform-services'];
}

const STATUS_STYLES: Record<PlatformModuleStatus, { bg: string; color: string; border: string }> = {
  live: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  partial: { bg: '#fff7ed', color: '#9a3412', border: '#fdba74' },
  planned: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

export function PlatformStatusChip({ status }: { status: PlatformModuleStatus }) {
  const theme = STATUS_STYLES[status];
  const label = status === 'live' ? 'Live' : status === 'partial' ? 'Partial' : 'Planned';
  return (
    <Chip
      size="small"
      label={label}
      sx={{ fontWeight: 800, bgcolor: theme.bg, color: theme.color, border: `1px solid ${theme.border}` }}
    />
  );
}

export function PlatformGroupTracker({
  activeGroup,
  onGroupSelect,
  counts,
}: {
  activeGroup?: string;
  onGroupSelect?: (groupKey: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
      {PLATFORM_MODULE_GROUPS.map((group, idx) => {
        const theme = getPlatformGroupTheme(group.key);
        const isActive = activeGroup === group.key;
        return (
          <Box
            key={group.key}
            onClick={onGroupSelect ? () => onGroupSelect(group.key) : undefined}
            role={onGroupSelect ? 'button' : undefined}
            tabIndex={onGroupSelect ? 0 : undefined}
            sx={{
              flex: '0 0 118px',
              p: 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isActive ? theme.bar : 'rgba(255,255,255,0.25)',
              bgcolor: isActive ? theme.chip : 'rgba(255,255,255,0.12)',
              boxShadow: isActive ? `0 4px 16px ${theme.glow}` : 'none',
              cursor: onGroupSelect ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '&:hover': onGroupSelect ? { bgcolor: isActive ? theme.chip : 'rgba(255,255,255,0.22)' } : undefined,
            }}
          >
            <Typography variant="caption" sx={{ color: isActive ? theme.bar : 'rgba(248,250,252,0.85)', fontWeight: 800, fontSize: '0.62rem' }}>
              {idx + 1}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{
                color: isActive ? '#0f172a' : '#f8fafc',
                fontWeight: isActive ? 700 : 500,
                lineHeight: 1.25,
                mt: 0.25,
                fontSize: '0.66rem',
              }}
            >
              {group.label.replace(' & ', ' · ').replace('Management', '').trim().slice(0, 28)}
            </Typography>
            <Typography variant="caption" sx={{ color: isActive ? theme.bar : 'rgba(248,250,252,0.7)', fontWeight: 700, fontSize: '0.6rem' }}>
              {counts[group.key] ?? 0} modules
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export function PlatformSectionHeader({
  title,
  description,
  groupKey,
  moduleCount,
}: {
  title: string;
  description: string;
  groupKey: string;
  moduleCount: number;
}) {
  const theme = getPlatformGroupTheme(groupKey);
  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 3,
        background: theme.soft,
        border: `1px solid ${theme.bar}22`,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box minWidth={0}>
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <Box sx={{ width: 4, height: 22, borderRadius: 999, bgcolor: theme.bar }} />
          <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
          {description}
        </Typography>
      </Box>
      <Chip label={`${moduleCount} modules`} sx={{ fontWeight: 800, bgcolor: '#fff', border: `1px solid ${theme.bar}33` }} />
    </Box>
  );
}

export function PlatformModuleCard({
  mod,
  onOpen,
}: {
  mod: PlatformModule;
  onOpen: () => void;
}) {
  const theme = getPlatformGroupTheme(mod.group);

  return (
    <Box
      sx={{
        height: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        bgcolor: '#fff',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { boxShadow: `0 12px 32px ${theme.glow}`, transform: 'translateY(-2px)' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, background: theme.gradient, color: '#fff' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
          <Chip
            size="small"
            label={`#${mod.id}`}
            sx={{ fontWeight: 800, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}
          />
          <PlatformStatusChip status={mod.status} />
        </Box>
        <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 1, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          {mod.title}
        </Typography>
      </Box>

      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, flexGrow: 1 }}>
          {mod.description}
        </Typography>
        <PlatformChipRow>
          {mod.highlights.slice(0, 3).map((h) => (
            <Chip key={h} size="small" variant="outlined" label={h} sx={{ fontWeight: 600, maxWidth: '100%' }} />
          ))}
        </PlatformChipRow>
        <Box
          component="button"
          type="button"
          onClick={onOpen}
          sx={{
            mt: 1.75,
            alignSelf: 'flex-start',
            border: 'none',
            borderRadius: 2,
            px: 2,
            py: 1,
            fontWeight: 800,
            fontSize: '0.82rem',
            color: '#fff',
            cursor: 'pointer',
            background: theme.gradient,
            boxShadow: `0 6px 18px ${theme.glow}`,
            '&:hover': { filter: 'brightness(0.96)' },
          }}
        >
          Open module →
        </Box>
      </Box>
    </Box>
  );
}

export function PlatformChipRow({ children }: { children: ReactNode }) {
  return (
    <Box display="flex" flexWrap="wrap" gap={0.75}>
      {children}
    </Box>
  );
}

export function PlatformKpiGroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ display: 'block', fontWeight: 800, letterSpacing: '0.12em', color: '#64748b', mb: -0.5 }}
    >
      {children}
    </Typography>
  );
}

export function PlatformQuickAccessCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        bgcolor: '#fff',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Box px={2} py={1.25} sx={{ borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0f172a' }}>
          {title}
        </Typography>
      </Box>
      <Box p={2}>{children}</Box>
    </Box>
  );
}

export const platformCatalogSx: SxProps<Theme> = {
  scrollMarginTop: '88px',
};
