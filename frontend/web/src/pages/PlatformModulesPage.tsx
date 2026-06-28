import { useCallback, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Chip, Grid, Typography } from '@mui/material';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import KpiStatCard from '../components/layout/KpiStatCard';
import { useAuth } from '../context/AuthContext';
import { useDivisionScope } from '../context/DivisionContext';
import { buildMapExplorerUrl, divisionScopeSubtitle } from '../utils/divisionAccess';
import {
  PLATFORM_MODULE_GROUPS,
  PLATFORM_MODULES,
  PLATFORM_MODULE_STATS,
  buildPlatformModulePath,
  type PlatformModule,
} from '../constants/platformModules';
import {
  PlatformChipRow,
  PlatformGroupTracker,
  PlatformKpiGroupLabel,
  PlatformModuleCard,
  PlatformQuickAccessCard,
  PlatformSectionHeader,
  platformCatalogSx,
} from '../components/platform/platformUi';

export default function PlatformModulesPage() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const { activeDivisionId, activeDivision } = useDivisionScope();
  const canViewAllDivisions = user?.canViewAllDivisions ?? false;
  const scopeSubtitle = divisionScopeSubtitle(canViewAllDivisions, activeDivision);
  const [activeGroup, setActiveGroup] = useState<string>(PLATFORM_MODULE_GROUPS[0].key);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visibleModules = useMemo(
    () => PLATFORM_MODULES.filter((m) => !m.permission || hasPermission(m.permission)),
    [hasPermission],
  );

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const group of PLATFORM_MODULE_GROUPS) {
      counts[group.key] = visibleModules.filter((m) => m.group === group.key).length;
    }
    return counts;
  }, [visibleModules]);

  const openModule = (mod: PlatformModule) => {
    if (mod.group === 'planning-construction') {
      navigate('/projects', { state: { constructionTab: mod.hash ?? 'dashboard' } });
      return;
    }
    if (mod.route === '/map' && activeDivisionId) {
      navigate(buildMapExplorerUrl(activeDivisionId));
      return;
    }
    navigate(buildPlatformModulePath(mod));
  };

  const scrollToGroup = useCallback((groupKey: string) => {
    setActiveGroup(groupKey);
    requestAnimationFrame(() => {
      groupRefs.current[groupKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return (
    <PageShell>
      <PageHeader
        eyebrow="S2T2R Integrated Platform"
        title="Platform Modules"
        subtitle={scopeSubtitle ?? 'Twenty end-to-end modules — DPR & construction · GIS · O&M · billing & ERP · analytics · mobile field services'}
        accent="indigo"
        leading={<AppsOutlinedIcon sx={{ fontSize: 36, color: '#4f46e5', mt: 0.5 }} />}
      />

      <Box
        sx={{
          mb: 2.5,
          p: 2.5,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 42%, #0d9488 100%)',
          color: '#f8fafc',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.2)',
        }}
      >
        <Typography variant="overline" sx={{ letterSpacing: '0.14em', fontWeight: 700, color: 'rgba(248,250,252,0.75)' }}>
          Unified water supply platform
        </Typography>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
          Planning → Construction → GIS → O&M → Billing → Analytics → Field services
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.85)', mb: 2, maxWidth: 760 }}>
          Click a module group below to jump to live and partial integrations across Uttarakhand Jal Sansthan schemes.
        </Typography>
        <PlatformGroupTracker activeGroup={activeGroup} onGroupSelect={scrollToGroup} counts={groupCounts} />
      </Box>

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12}><PlatformKpiGroupLabel>Platform coverage</PlatformKpiGroupLabel></Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Total Modules" value={PLATFORM_MODULE_STATS.total} tone="violet" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Live" value={PLATFORM_MODULE_STATS.live} tone="teal" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Partial" value={PLATFORM_MODULE_STATS.partial} tone="amber" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Visible to you" value={visibleModules.length} tone="blue" />
        </Grid>
      </Grid>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} mb={2.5}>
        <PlatformQuickAccessCard title="Core workspaces">
          <PlatformChipRow>
            <Chip component={RouterLink} to="/dpr-planning" clickable icon={<FactCheckOutlinedIcon />} label="DPR & Planning" color="primary" variant="outlined" />
            <Chip component={RouterLink} to="/projects" clickable icon={<EngineeringOutlinedIcon />} label="Projects" color="primary" variant="outlined" />
            <Chip component={RouterLink} to={buildMapExplorerUrl(activeDivisionId ?? '')} clickable icon={<MapOutlinedIcon />} label="GIS Map" color="primary" variant="outlined" />
            <Chip component={RouterLink} to="/om" clickable icon={<BuildCircleOutlinedIcon />} label="O&M" color="primary" variant="outlined" />
          </PlatformChipRow>
        </PlatformQuickAccessCard>
        <PlatformQuickAccessCard title="Revenue & field">
          <PlatformChipRow>
            <Chip component={RouterLink} to="/billing" clickable icon={<ReceiptLongOutlinedIcon />} label="Billing & Revenue" color="primary" variant="outlined" />
            <Chip component={RouterLink} to="/mobile-billing" clickable icon={<PhoneAndroidOutlinedIcon />} label="Mobile Billing" color="primary" variant="outlined" />
            <Chip component={RouterLink} to="/dashboard" clickable label="Executive Dashboard" color="primary" variant="outlined" />
            <Chip label="Construction modules open per project" size="small" variant="outlined" />
          </PlatformChipRow>
        </PlatformQuickAccessCard>
      </Box>

      {PLATFORM_MODULE_GROUPS.map((group) => {
        const modules = visibleModules.filter((m) => m.group === group.key);
        if (!modules.length) return null;
        return (
          <Box
            key={group.key}
            mb={3}
            ref={(el: HTMLDivElement | null) => { groupRefs.current[group.key] = el; }}
            sx={platformCatalogSx}
          >
            <PlatformSectionHeader
              title={group.label}
              description={group.description}
              groupKey={group.key}
              moduleCount={modules.length}
            />
            <Grid container spacing={2}>
              {modules.map((mod) => (
                <Grid item xs={12} sm={6} lg={4} key={mod.key}>
                  <PlatformModuleCard mod={mod} onOpen={() => openModule(mod)} />
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}
    </PageShell>
  );
}
