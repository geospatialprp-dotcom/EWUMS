import { ReactNode } from 'react';
import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { OM_BILLING_WORKFLOW, OM_COLLECTION_WORKFLOW } from '../../constants/omBilling';

export const BILLING_MODULES = [
  { tab: 0, key: 'consumers', label: 'Consumer Accounts', short: 'Accounts' },
  { tab: 1, key: 'tariffs', label: 'Tariffs', short: 'Tariffs' },
  { tab: 2, key: 'readings', label: 'Meter Readings', short: 'Readings' },
  { tab: 3, key: 'bills', label: 'Bills', short: 'Bills' },
  { tab: 4, key: 'collection', label: 'Revenue Collection', short: 'Collection' },
  { tab: 5, key: 'accounting', label: 'Financial Accounting', short: 'Accounting' },
  { tab: 6, key: 'demand', label: 'Demand Register', short: 'Demand' },
  { tab: 7, key: 'arrears', label: 'Arrear & Defaulters', short: 'Arrears' },
  { tab: 8, key: 'gis', label: 'GIS Revenue', short: 'GIS' },
  { tab: 9, key: 'reports', label: 'Revenue Reports', short: 'Reports' },
] as const;

export type BillingPhase = 'billing' | 'collection' | 'analytics';

const PHASE_COLORS: Record<BillingPhase, { gradient: string; chip: string; bar: string; glow: string }> = {
  billing: {
    gradient: 'linear-gradient(135deg, #b45309 0%, #d97706 55%, #f59e0b 100%)',
    chip: '#fef3c7',
    bar: '#d97706',
    glow: 'rgba(217, 119, 6, 0.35)',
  },
  collection: {
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #14b8a6 100%)',
    chip: '#ccfbf1',
    bar: '#0d9488',
    glow: 'rgba(13, 148, 136, 0.35)',
  },
  analytics: {
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
    chip: '#dbeafe',
    bar: '#2563eb',
    glow: 'rgba(37, 99, 235, 0.35)',
  },
};

export function getBillingPhase(tab: number): BillingPhase {
  if (tab <= 3) return 'billing';
  if (tab <= 7) return 'collection';
  return 'analytics';
}

export const billingDialogPaperSx: SxProps<Theme> = {
  borderRadius: 3,
  overflow: 'hidden',
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 64px rgba(15, 23, 42, 0.18)',
};

export const billingDialogContentSx: SxProps<Theme> = {
  p: 2.5,
  bgcolor: '#f8fafc',
};

export const billingDialogActionsSx: SxProps<Theme> = {
  px: 2.5,
  py: 1.5,
  bgcolor: '#fff',
  borderTop: '1px solid #e2e8f0',
  gap: 1,
};

export const billingTabsSx: SxProps<Theme> = {
  minHeight: 48,
  '& .MuiTab-root': {
    minHeight: 48,
    fontWeight: 600,
    fontSize: '0.78rem',
    textTransform: 'none',
    borderRadius: '10px 10px 0 0',
    mx: 0.25,
    color: '#64748b',
    '&.Mui-selected': { color: '#b45309', fontWeight: 800 },
  },
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
    bgcolor: '#d97706',
  },
};

export function BillingDialogHeader({
  title,
  subtitle,
  badge,
  phase = 'billing',
  busy,
}: {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  phase?: BillingPhase;
  busy?: boolean;
}) {
  const colors = PHASE_COLORS[phase];

  return (
    <Box sx={{ px: 2.5, py: 2, background: colors.gradient, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} position="relative" zIndex={1}>
        <Box minWidth={0}>
          <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 600, color: 'rgba(248,250,252,0.9)' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {badge && (
          <Chip size="small" label={badge} sx={{ fontWeight: 700, bgcolor: 'rgba(255,255,255,0.95)', color: '#0f172a' }} />
        )}
      </Box>
      {busy && (
        <LinearProgress sx={{ mt: 1.5, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: '#fff' } }} />
      )}
    </Box>
  );
}

export function BillingModuleTracker({
  activeTab,
  onModuleSelect,
  compact,
}: {
  activeTab?: number;
  onModuleSelect?: (tab: number) => void;
  compact?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', gap: compact ? 0.5 : 0.75, overflowX: 'auto', pb: 0.5 }}>
      {BILLING_MODULES.map((m) => {
        const phase = getBillingPhase(m.tab);
        const colors = PHASE_COLORS[phase];
        const isActive = activeTab === m.tab;

        return (
          <Box
            key={m.key}
            onClick={onModuleSelect ? () => onModuleSelect(m.tab) : undefined}
            role={onModuleSelect ? 'button' : undefined}
            tabIndex={onModuleSelect ? 0 : undefined}
            sx={{
              flex: compact ? '0 0 88px' : '0 0 104px',
              p: compact ? 0.75 : 1,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isActive ? colors.bar : 'rgba(255,255,255,0.25)',
              bgcolor: isActive ? colors.chip : 'rgba(255,255,255,0.12)',
              boxShadow: isActive ? `0 4px 16px ${colors.glow}` : 'none',
              cursor: onModuleSelect ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '&:hover': onModuleSelect ? { bgcolor: isActive ? colors.chip : 'rgba(255,255,255,0.22)' } : undefined,
            }}
          >
            <Typography variant="caption" sx={{ color: isActive ? colors.bar : 'rgba(248,250,252,0.85)', fontWeight: 800, fontSize: '0.62rem' }}>
              {m.tab + 1}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{
                color: isActive ? '#0f172a' : '#f8fafc',
                fontWeight: isActive ? 700 : 500,
                lineHeight: 1.25,
                mt: 0.25,
                fontSize: compact ? '0.6rem' : '0.66rem',
              }}
            >
              {compact ? m.short : (m.short.length > 22 ? `${m.short.slice(0, 20)}…` : m.short)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export function BillingWorkflowTracker({ type = 'billing' }: { type?: 'billing' | 'collection' }) {
  const steps = type === 'collection' ? OM_COLLECTION_WORKFLOW : OM_BILLING_WORKFLOW;
  const colors = type === 'collection' ? PHASE_COLORS.collection : PHASE_COLORS.billing;

  return (
    <Box display="flex" gap={0.75} flexWrap="wrap" alignItems="center">
      {steps.map((step, idx) => (
        <Box key={step.step} display="flex" alignItems="center" gap={0.75}>
          <Chip
            size="small"
            label={step.label}
            sx={{
              fontWeight: 600,
              bgcolor: colors.chip,
              border: `1px solid ${colors.bar}33`,
              color: '#0f172a',
            }}
          />
          {idx < steps.length - 1 && (
            <Typography variant="caption" sx={{ color: colors.bar, fontWeight: 700 }}>→</Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

export function BillingSectionCard({
  title,
  children,
  action,
  phase = 'billing',
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  phase?: BillingPhase;
}) {
  const bar = PHASE_COLORS[phase].bar;

  return (
    <Box sx={{ borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff', overflow: 'hidden', mb: 2, boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)' }}>
      <Box sx={{ px: 1.75, py: 1.25, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderLeft: `4px solid ${bar}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} color="#0f172a">{title}</Typography>
        {action}
      </Box>
      <Box sx={{ p: 1.75 }}>{children}</Box>
    </Box>
  );
}

export function BillingChipRow({ children }: { children: ReactNode }) {
  return (
    <Box display="flex" gap={0.75} flexWrap="wrap">
      {children}
    </Box>
  );
}

export function BillingKpiGroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', mt: 0.5 }}>
      {children}
    </Typography>
  );
}

export function billingTabFromHash(hash: string): number | null {
  const key = hash.replace('#', '').toLowerCase();
  const aliases: Record<string, number> = {
    consumers: 0,
    accounts: 0,
    tariffs: 1,
    readings: 2,
    'meter-readings': 2,
    bills: 3,
    collection: 4,
    payments: 4,
    accounting: 5,
    'financial-accounting': 5,
    demand: 6,
    arrears: 7,
    defaulters: 7,
    gis: 8,
    'gis-revenue': 8,
    reports: 9,
    'revenue-reports': 9,
  };
  if (key in aliases) return aliases[key];
  const mod = BILLING_MODULES.find((m) => m.key === key);
  return mod?.tab ?? null;
}

export function billingHashFromTab(tab: number): string {
  return BILLING_MODULES.find((m) => m.tab === tab)?.key ?? 'consumers';
}
