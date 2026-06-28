import { ReactNode, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { APP_BRAND } from '../../constants/branding';

type ShowcaseSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
  accentSoft: string;
  icon: ReactNode;
  visual: 'map' | 'project' | 'construction' | 'billing';
};

const SLIDES: ShowcaseSlide[] = [
  {
    id: 'gis',
    eyebrow: 'Stage 1 · GIS Mapping',
    title: 'Map every asset on live geography',
    body: 'Feature classes, orthomosaic imagery, digitize pipelines, reservoirs, and FHTC connections — all georeferenced.',
    accent: '#2563eb',
    accentSoft: '#93c5fd',
    icon: <MapOutlinedIcon sx={{ fontSize: 28 }} />,
    visual: 'map',
  },
  {
    id: 'projects',
    eyebrow: 'Stage 2 · Project Control',
    title: 'One portfolio, full visibility',
    body: 'Milestones, work progress from daily DPR, and payment release against approved Govt. BOQ — in one dashboard.',
    accent: '#4f46e5',
    accentSoft: '#a5b4fc',
    icon: <AssignmentOutlinedIcon sx={{ fontSize: 28 }} />,
    visual: 'project',
  },
  {
    id: 'construction',
    eyebrow: 'Stage 3 · Site Execution',
    title: 'DPR to measurement book, end to end',
    body: 'Contractor daily progress, MB entries, BOQ reconciliation, and GIS asset mapping tied to field work.',
    accent: '#0d9488',
    accentSoft: '#5eead4',
    icon: <EngineeringOutlinedIcon sx={{ fontSize: 28 }} />,
    visual: 'construction',
  },
  {
    id: 'billing',
    eyebrow: 'Stage 4 · Finance Release',
    title: 'RA bills through final settlement',
    body: 'Running account generation, recoveries, GST, final bill preparation, and executive reports — audit-ready.',
    accent: '#0891b2',
    accentSoft: '#67e8f9',
    icon: <PaymentsOutlinedIcon sx={{ fontSize: 28 }} />,
    visual: 'billing',
  },
];

function MapVisual({ accent }: { accent: string }) {
  return (
    <Box sx={{ position: 'relative', width: '100%', height: 160, overflow: 'hidden',
      bgcolor: 'rgba(15,23,42,0.72)' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Box key={`h${i}`} sx={{ position: 'absolute', left: 0, right: 0, top: `${i * 12.5}%`, height: 1, bgcolor: 'rgba(148,163,184,0.15)' }} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <Box key={`v${i}`} sx={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 10}%`, width: 1, bgcolor: 'rgba(148,163,184,0.12)' }} />
      ))}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 180,
          height: 180,
          marginTop: '-90px',
          marginLeft: '-90px',
          borderRadius: '50%',
          border: `1px dashed ${accent}44`,
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 20,
            borderRadius: '50%',
            border: `1px dashed ${accent}33`,
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 90,
          height: 2,
          marginTop: -1,
          transformOrigin: '0% 50%',
          background: `linear-gradient(90deg, ${accent}, transparent)`,
          animation: 'radarSweep 4s linear infinite',
          '@keyframes radarSweep': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' },
          },
        }}
      />
      <Box sx={{
        position: 'absolute', top: '42%', left: '8%', right: '12%', height: 4, borderRadius: 2,
        background: `linear-gradient(90deg, ${accent}44, ${accent}, ${accent}44)`,
        animation: 'pipelinePulse 3s ease-in-out infinite',
        '@keyframes pipelinePulse': { '0%,100%': { opacity: 0.65 }, '50%': { opacity: 1 } },
      }} />
      {[
        { top: '38%', left: '18%' }, { top: '55%', left: '45%' }, { top: '32%', left: '72%' }, { top: '68%', left: '58%' },
      ].map((p, i) => (
        <Box key={i} sx={{
          position: 'absolute', ...p, width: 12, height: 12, borderRadius: '50%',
          bgcolor: accent, boxShadow: `0 0 16px ${accent}`,
          animation: `pinPop 2.4s ease-in-out ${i * 0.4}s infinite`,
          '@keyframes pinPop': { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.3)' } },
        }} />
      ))}
      <Box sx={{ position: 'absolute', top: 10, right: 10, px: 1, py: 0.35, borderRadius: 1, bgcolor: `${accent}33`, border: `1px solid ${accent}55` }}>
        <Typography variant="caption" sx={{ color: accent, fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.08em' }}>LIVE GIS</Typography>
      </Box>
      <Box sx={{ position: 'absolute', bottom: 8, left: 10, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(37,99,235,0.25)', fontSize: '0.65rem', color: '#e2e8f0' }}>
        Orthomosaic · Vector layers · 847 assets
      </Box>
    </Box>
  );
}

function ProjectVisual({ accent }: { accent: string }) {
  const bars = [72, 45, 28, 88];
  return (
    <Box sx={{ p: 1.75, height: 160, bgcolor: 'rgba(15,23,42,0.72)' }}>
      <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1.5, display: 'block' }}>Badhangarhi Water Supply Scheme</Typography>
      {bars.map((pct, i) => (
        <Box key={i} sx={{ mb: 1.25 }}>
          <Box display="flex" justifyContent="space-between" mb={0.35}>
            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>{['Pipeline Laying', 'Procurement', 'Reservoir', 'FHTC'][i]}</Typography>
            <Typography variant="caption" sx={{ color: accent, fontWeight: 700 }}>{pct}%</Typography>
          </Box>
          <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <Box sx={{
              width: `${pct}%`, height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${accent}66, ${accent}, ${accent}cc)`,
              animation: `barGrow 1.4s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.15}s both`,
              '@keyframes barGrow': {
                from: { width: '0%' },
                to: { width: `${pct}%` },
              },
            }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function ConstructionVisual({ accent }: { accent: string }) {
  const steps = ['Work Planning', 'Daily DPR', 'Measurement Book', 'BOQ Match'];
  return (
    <Box sx={{ p: 1.75, height: 160, bgcolor: 'rgba(15,23,42,0.72)' }}>
      {steps.map((label, i) => (
        <Box key={label} display="flex" alignItems="center" gap={1} mb={i < steps.length - 1 ? 0.75 : 0}>
          <Box sx={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${accent}33`, border: `2px solid ${accent}`,
            color: accent, fontSize: '0.75rem', fontWeight: 800,
          }}>
            {i + 1}
          </Box>
          <Box flex={1}>
            <Typography variant="body2" sx={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.8125rem' }}>{label}</Typography>
            {i < steps.length - 1 && (
              <Box sx={{ width: 2, height: 16, bgcolor: `${accent}55`, ml: 1.75, mt: 0.5 }} />
            )}
          </Box>
          {i === 1 && (
            <Typography variant="caption" sx={{ color: accent, fontWeight: 700 }}>Live</Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

function BillingVisual({ accent }: { accent: string }) {
  return (
    <Box sx={{ p: 1.75, height: 160, bgcolor: 'rgba(15,23,42,0.72)' }}>
      {[
        { label: 'Contract Value', value: '₹1.05 Cr', w: '100%' },
        { label: 'MB Certified', value: '₹32.4 L', w: '68%' },
        { label: 'RA Released', value: '₹3.0 L', w: '24%' },
      ].map((row) => (
        <Box key={row.label} sx={{ mb: 1.75 }}>
          <Box display="flex" justifyContent="space-between" mb={0.35}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>{row.label}</Typography>
            <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>{row.value}</Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <Box sx={{
              width: row.w,
              height: '100%',
              borderRadius: 4,
              background: `linear-gradient(90deg, ${accent}66, ${accent})`,
              transformOrigin: 'left',
              animation: 'billingBarGrow 1.2s cubic-bezier(0.22, 1, 0.36, 1) both',
              '@keyframes billingBarGrow': {
                from: { transform: 'scaleX(0)' },
                to: { transform: 'scaleX(1)' },
              },
            }} />
          </Box>
        </Box>
      ))}
      <Box sx={{ mt: 2, p: 1, borderRadius: 1, bgcolor: `${accent}22`, border: `1px dashed ${accent}66` }}>
        <Typography variant="caption" sx={{ color: accent, fontWeight: 600 }}>RA Bill #3 · Pending EE approval</Typography>
      </Box>
    </Box>
  );
}

function SlideVisual({ type, accent }: { type: ShowcaseSlide['visual']; accent: string }) {
  switch (type) {
    case 'map': return <MapVisual accent={accent} />;
    case 'project': return <ProjectVisual accent={accent} />;
    case 'construction': return <ConstructionVisual accent={accent} />;
    case 'billing': return <BillingVisual accent={accent} />;
  }
}

const INTERVAL_MS = 5200;

export default function LoginHeroShowcase({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFadeIn(false);
      window.setTimeout(() => {
        setActive((prev) => (prev + 1) % SLIDES.length);
        setFadeIn(true);
      }, 320);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const slide = SLIDES[active];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', px: compact ? 0 : { xs: 3, md: 4, lg: 5 }, py: compact ? 0 : { xs: 1, md: 0.5 }, minHeight: 0, overflow: 'hidden' }}>
      {!compact && (
        <Typography variant="overline" sx={{ color: '#64748b', letterSpacing: '0.12em', fontWeight: 700, mb: 0.5, fontSize: '0.65rem' }}>
          How {APP_BRAND.name} works
        </Typography>
      )}

      {!compact && (
        <Box display="flex" gap={0.5} mb={1} sx={{ maxWidth: 440 }}>
          {SLIDES.map((s, i) => (
            <Box
              key={s.id}
              flex={1}
              sx={{
                height: 3,
                borderRadius: 999,
                bgcolor: i <= active ? s.accent : 'rgba(148,163,184,0.2)',
                opacity: i <= active ? 1 : 0.45,
                transition: 'all 0.45s ease',
                boxShadow: i === active ? `0 0 14px ${s.accent}99` : 'none',
              }}
            />
          ))}
        </Box>
      )}

      <Box sx={{
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
      }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: compact ? `${slide.accent}15` : `${slide.accent}22`,
            color: compact ? slide.accent : slide.accentSoft,
            border: `1px solid ${slide.accent}44`,
          }}>
            {slide.icon}
          </Box>
          <Typography variant="caption" sx={{ color: compact ? slide.accent : slide.accentSoft, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {slide.eyebrow}
          </Typography>
        </Box>

        <Typography variant={compact ? 'subtitle1' : 'h5'} fontWeight={800} sx={{ color: compact ? '#0f172a' : '#f8fafc', letterSpacing: '-0.02em', mb: 0.5, maxWidth: 440, lineHeight: 1.2 }}>
          {slide.title}
        </Typography>
        <Typography variant="body2" sx={{ color: compact ? '#64748b' : '#94a3b8', mb: compact ? 1 : 1.25, maxWidth: 420, lineHeight: 1.5, fontSize: '0.8125rem' }}>
          {slide.body}
        </Typography>

        {!compact && (
          <Box sx={{ maxWidth: 420, position: 'relative' }}>
            <Box
              sx={{
                position: 'relative',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                overflow: 'hidden',
              }}
            >
              <SlideVisual type={slide.visual} accent={slide.accent} />
            </Box>
          </Box>
        )}
      </Box>

      <Box display="flex" gap={1} mt={1.25} alignItems="center">
        {SLIDES.map((s, i) => (
          <Box
            key={s.id}
            onClick={() => { setFadeIn(false); window.setTimeout(() => { setActive(i); setFadeIn(true); }, 200); }}
            sx={{
              width: i === active ? 32 : 8,
              height: 8,
              borderRadius: 999,
              bgcolor: i === active ? slide.accent : 'rgba(148,163,184,0.3)',
              cursor: 'pointer',
              boxShadow: i === active ? `0 0 12px ${slide.accent}88` : 'none',
              transition: 'width 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease',
            }}
          />
        ))}
        <Typography variant="caption" sx={{ color: '#64748b', ml: 1, fontWeight: 600 }}>
          {active + 1} / {SLIDES.length}
        </Typography>
      </Box>
    </Box>
  );
}

export { SLIDES };
