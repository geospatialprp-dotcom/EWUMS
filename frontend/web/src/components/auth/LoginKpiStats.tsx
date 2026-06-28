import { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { PLATFORM_MODULE_STATS } from '../../constants/platformModules';

type LoginStatKey = 'modules' | 'gisAssets' | 'divisions';

type LoginStatItem = {
  key: LoginStatKey;
  label: string;
  icon: SvgIconComponent;
  color: string;
  suffix?: string;
  fallback: number;
};

type PlatformStatsResponse = {
  modules?: number;
  gisAssets?: number;
  divisions?: number;
  live?: boolean;
  updatedAt?: string;
};

const STAT_ITEMS: LoginStatItem[] = [
  {
    key: 'modules',
    label: 'Modules',
    icon: AnalyticsOutlinedIcon,
    color: '#93c5fd',
    fallback: PLATFORM_MODULE_STATS.total,
  },
  {
    key: 'gisAssets',
    label: 'GIS Assets',
    icon: MapOutlinedIcon,
    color: '#5eead4',
    suffix: '+',
    fallback: 0,
  },
  {
    key: 'divisions',
    label: 'Divisions',
    icon: GroupsOutlinedIcon,
    color: '#a5b4fc',
    fallback: 13,
  },
];

const POLL_MS = 45_000;

function useAnimatedNumber(target: number, duration = 1100) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>();
  const startRef = useRef(0);
  const fromRef = useRef(0);
  const displayRef = useRef(0);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    fromRef.current = displayRef.current;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(fromRef.current + (target - fromRef.current) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return display;
}

function StatCard({
  item,
  value,
  pulse,
}: {
  item: LoginStatItem;
  value: number;
  pulse: boolean;
}) {
  const animated = useAnimatedNumber(value);
  const Icon = item.icon;
  const showSuffix = item.suffix && value > 0;

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        p: 1,
        borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        backdropFilter: 'blur(8px)',
        transition: 'transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
        animation: pulse ? 'kpiPulse 0.6s ease' : 'none',
        '@keyframes kpiPulse': {
          '0%': { boxShadow: `0 0 0 0 ${item.color}44` },
          '70%': { boxShadow: `0 0 0 8px ${item.color}00` },
          '100%': { boxShadow: 'none' },
        },
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: `${item.color}55`,
        },
      }}
    >
      <Icon sx={{ fontSize: 16, color: item.color, mb: 0.25 }} />
      <Typography
        variant="subtitle1"
        fontWeight={800}
        sx={{
          color: '#f8fafc',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {animated.toLocaleString('en-IN')}
        {showSuffix ? item.suffix : ''}
      </Typography>
      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
        {item.label}
      </Typography>
    </Box>
  );
}

export default function LoginKpiStats() {
  const [values, setValues] = useState<Record<LoginStatKey, number>>({
    modules: PLATFORM_MODULE_STATS.total,
    gisAssets: 0,
    divisions: 13,
  });
  const [live, setLive] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/v1/auth/platform-stats');
        if (!res.ok) return;
        const data = (await res.json()) as PlatformStatsResponse;
        if (cancelled) return;

        setValues((prev) => {
          const next = {
            modules: data.modules ?? prev.modules,
            gisAssets: data.gisAssets ?? prev.gisAssets,
            divisions: data.divisions ?? prev.divisions,
          };
          if (
            next.modules !== prev.modules
            || next.gisAssets !== prev.gisAssets
            || next.divisions !== prev.divisions
          ) {
            setPulseKey((k) => k + 1);
          }
          return next;
        });
        setLive(Boolean(data.live));
      } catch {
        // keep fallbacks
      }
    };

    void load();
    const timer = window.setInterval(() => { void load(); }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.75}>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Live platform snapshot
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: live ? '#22c55e' : '#64748b',
              boxShadow: live ? '0 0 8px rgba(34,197,94,0.7)' : 'none',
              animation: live ? 'liveDot 2s ease-in-out infinite' : 'none',
              '@keyframes liveDot': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.45 },
              },
            }}
          />
          <Typography variant="caption" sx={{ color: live ? '#86efac' : '#64748b', fontWeight: 700, fontSize: '0.65rem' }}>
            {live ? 'Live' : 'Demo'}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1}>
        {STAT_ITEMS.map((item) => (
          <StatCard
            key={item.key}
            item={item}
            value={values[item.key] ?? item.fallback}
            pulse={pulseKey > 0}
          />
        ))}
      </Stack>
    </Box>
  );
}
