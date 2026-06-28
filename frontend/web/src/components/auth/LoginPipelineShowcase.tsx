import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { PIPELINE_ROTATE_MS, PIPELINE_SHOWCASE, type PipelineShowcaseItem } from '../../constants/pipelineShowcase';

/** Compact label — MS for MSERW on login strip */
function pipeShortLabel(code: string) {
  return code === 'MSERW' ? 'MS' : code;
}

function StripPreview({ item, active }: { item: PipelineShowcaseItem; active: boolean }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        opacity: active ? 1 : 0,
        transition: 'opacity 0.55s ease',
      }}
    >
      <Box
        component="img"
        src={`${item.imageUrl}?id=${item.id}`}
        alt={item.name}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          animation: active ? 'stripKenBurns 12s ease-in-out infinite alternate' : 'none',
          '@keyframes stripKenBurns': {
            '0%': { transform: 'scale(1)' },
            '100%': { transform: 'scale(1.08)' },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(15,23,42,0.55) 0%, transparent 55%)',
        }}
      />
      {active && (
        <Box
          sx={{
            position: 'absolute',
            inset: 4,
            borderRadius: 1.5,
            border: `2px solid ${item.accentSoft}`,
            boxShadow: `0 0 12px ${item.accent}55`,
            animation: 'stripGlow 2.5s ease-in-out infinite',
            '@keyframes stripGlow': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            },
          }}
        />
      )}
    </Box>
  );
}

/** Bottom strip — GI / MS / DI pipeline photos in leftover hero space */
export default function LoginPipelineStrip({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % PIPELINE_SHOWCASE.length);
    }, PIPELINE_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const item = PIPELINE_SHOWCASE[active];

  return (
    <Box
      sx={{
        flexShrink: 0,
        mx: compact ? 2 : { md: 4, lg: 5 },
        mb: compact ? 1 : 1.25,
        mt: compact ? 1 : 0.75,
        p: compact ? 1 : 1.25,
        borderRadius: 3,
        border: '1px solid rgba(148,163,184,0.2)',
        bgcolor: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        transition: 'border-color 0.3s ease',
        '&:hover': { borderColor: `${item.accent}55` },
      }}
    >
      <Typography
        variant="overline"
        sx={{
          color: '#64748b',
          letterSpacing: '0.12em',
          fontWeight: 700,
          display: 'block',
          mb: 1,
          fontSize: '0.625rem',
        }}
      >
        Field pipeline assets
      </Typography>

      <Box display="flex" gap={1.5} alignItems="stretch">
        <Box
          sx={{
            position: 'relative',
            width: compact ? 96 : 120,
            height: compact ? 72 : 76,
            flexShrink: 0,
            borderRadius: 2,
            overflow: 'hidden',
            border: `1px solid ${item.accent}66`,
            boxShadow: `0 4px 16px ${item.accent}33`,
          }}
        >
          {PIPELINE_SHOWCASE.map((pipe, index) => (
            <StripPreview key={pipe.id} item={pipe} active={index === active} />
          ))}
        </Box>

        <Box flex={1} minWidth={0} display="flex" flexDirection="column" justifyContent="center">
          <Typography
            variant="caption"
            sx={{ color: item.accentSoft, fontWeight: 800, letterSpacing: '0.12em', mb: 0.25 }}
          >
            {pipeShortLabel(item.code)} PIPE
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{ color: '#f1f5f9', lineHeight: 1.25, mb: 0.25 }}
            noWrap={compact}
          >
            {item.name}
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', lineHeight: 1.4 }} noWrap={compact}>
            {item.typicalUse}
          </Typography>
        </Box>

        <Box display="flex" flexDirection="column" gap={0.75} justifyContent="center">
          {PIPELINE_SHOWCASE.map((pipe, index) => {
            const selected = index === active;
            return (
              <Box
                key={pipe.id}
                onClick={() => setActive(index)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: selected ? pipe.accent : 'rgba(148,163,184,0.25)',
                  bgcolor: selected ? `${pipe.accent}22` : 'rgba(255,255,255,0.04)',
                  boxShadow: selected ? `0 0 0 2px ${pipe.accent}33` : 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: pipe.accentSoft },
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: selected ? `2px solid ${pipe.accent}` : '1px solid rgba(148,163,184,0.3)',
                  }}
                >
                  <Box
                    component="img"
                    src={`${pipe.imageUrl}?id=${pipe.id}`}
                    alt={pipeShortLabel(pipe.code)}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: selected ? '#f8fafc' : '#94a3b8',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    minWidth: 24,
                  }}
                >
                  {pipeShortLabel(pipe.code)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
