import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Chip, Grid, Tab, Tabs, Typography,
} from '@mui/material';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import { omApi } from '../services/api';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import KpiStatCard from '../components/layout/KpiStatCard';
import {
  OM_ASSET_CATEGORIES,
  OM_WORKFLOW_STAGES,
  type OmStageKey,
  type OmWorkflowStage,
} from '../constants/omWorkflow';
import OmHandoverStage from '../components/om/OmHandoverStage';
import OmAssetRegistrationStage from '../components/om/OmAssetRegistrationStage';
import OmInspectionStage from '../components/om/OmInspectionStage';
import OmPreventiveMaintenanceStage from '../components/om/OmPreventiveMaintenanceStage';
import OmBreakdownStage from '../components/om/OmBreakdownStage';
import OmWaterQualityStage from '../components/om/OmWaterQualityStage';
import OmEnergyStage from '../components/om/OmEnergyStage';
import OmScadaStage from '../components/om/OmScadaStage';
import OmConsumerServiceStage from '../components/om/OmConsumerServiceStage';
import OmComplaintStage from '../components/om/OmComplaintStage';
import OmContractStage from '../components/om/OmContractStage';
import OmLifecycleStage from '../components/om/OmLifecycleStage';
import OmDashboardStage from '../components/om/OmDashboardStage';
import OmReportsStage from '../components/om/OmReportsStage';
import OmJalMitraAnalyticsStage from '../components/om/OmJalMitraAnalyticsStage';
import { OM_WQ_PARAMETER_GROUPS } from '../constants/omWaterQuality';
import { OM_ENERGY_METRICS, OM_ENERGY_REPORT_TYPES } from '../constants/omEnergy';
import { OM_SCADA_ALERT_TYPES, OM_SCADA_SITES } from '../constants/omScada';
import { OM_CONSUMER_SERVICE_TYPES } from '../constants/omConsumerService';
import { OM_COMPLAINT_CHANNELS, OM_COMPLAINT_TYPES } from '../constants/omComplaints';
import { OM_CONTRACT_KPIS, OM_CONTRACT_MONITORING_AREAS } from '../constants/omContracts';
import { OM_LIFECYCLE_CATEGORIES } from '../constants/omLifecycle';
import { OM_GIS_DASHBOARD_PANELS } from '../constants/omDashboard';
import { OM_REPORT_TYPES } from '../constants/omReports';
import { useDivisionScopeKey } from '../context/DivisionContext';
import { useTranslation } from '../context/LanguageContext';
import { useLocalizedOmWorkflowStages, usePageCopy } from '../hooks/useLocalizedOmWorkflow';
import {
  OmChipRow,
  OmInfoTile,
  OmKpiGroupLabel,
  OmPipelineTracker,
  OmSectionCard,
  getOmPhase,
  omTabsSx,
} from '../components/om/omUi';

function StageOverview({ stageKey, stages }: { stageKey: OmStageKey; stages: OmWorkflowStage[] }) {
  const { t } = useTranslation();
  const stage = stages.find((s) => s.key === stageKey)!;
  const phase = getOmPhase(stage.stage);

  return (
    <OmSectionCard title={stage.name} accent={phase}>
      <Typography variant="body2" color="text.secondary" mb={2}>{stage.summary}</Typography>
      <OmSectionCard title={t('common.workflowSteps')} accent={phase}>
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {stage.steps.map((step) => (
            <Typography component="li" variant="body2" key={step} sx={{ mb: 0.5 }}>{step}</Typography>
          ))}
        </Box>
      </OmSectionCard>
      {stage.actors && (
        <OmSectionCard title={t('common.responsibleRoles')} accent={phase}>
          <OmChipRow>
            {stage.actors.map((a) => <Chip key={a} label={a} size="small" />)}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stage.integrations && (
        <OmSectionCard title={t('common.integrations')} accent={phase}>
          <OmChipRow>
            {stage.integrations.map((i) => <Chip key={i} label={i} size="small" color="primary" variant="outlined" />)}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'consumer-service' && (
        <OmSectionCard title={t('om.consumerServiceCatalogue')} accent="service">
          <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
            Consumer ID · FHTC Number · Mobile · GIS Location · Village · Meter Details
          </Typography>
          <OmChipRow>
            {OM_CONSUMER_SERVICE_TYPES.map((t) => (
              <Chip key={t.type} size="small" variant="outlined" label={t.label} />
            ))}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'complaints' && (
        <OmSectionCard title="Complaint channels & types" accent="service">
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Registration channels</Typography>
          <OmChipRow>
            {OM_COMPLAINT_CHANNELS.map((c) => (
              <Chip key={c.code} size="small" color="primary" variant="outlined" label={c.label} />
            ))}
          </OmChipRow>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mt: 1.5 }}>Complaint types</Typography>
          <OmChipRow>
            {OM_COMPLAINT_TYPES.map((t) => (
              <Chip key={t.code} size="small" variant="outlined" label={t.label} />
            ))}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'contracts' && (
        <OmSectionCard title="Contract monitoring" accent="service">
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Monitoring areas</Typography>
          <OmChipRow>
            {OM_CONTRACT_MONITORING_AREAS.map((m) => (
              <Chip key={m.key} size="small" color="primary" variant="outlined" label={m.label} />
            ))}
          </OmChipRow>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mt: 1.5 }}>Contractor KPIs</Typography>
          <OmChipRow>
            {OM_CONTRACT_KPIS.map((k) => (
              <Chip key={k.key} size="small" variant="outlined" label={k.label} />
            ))}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'lifecycle' && (
        <OmSectionCard title="Lifecycle asset categories" accent="service">
          <OmChipRow>
            {OM_LIFECYCLE_CATEGORIES.map((c) => (
              <Chip key={c.category} size="small" color="primary" variant="outlined" label={c.label} />
            ))}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'dashboard' && (
        <OmSectionCard title="Real-time dashboard panels" accent="insights">
          <OmChipRow>
            {OM_GIS_DASHBOARD_PANELS.map((p) => (
              <Chip key={p.key} size="small" color="primary" variant="outlined" label={p.label} />
            ))}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'reports' && (
        <OmSectionCard title={`Available report outputs (${OM_REPORT_TYPES.length})`} accent="insights">
          <OmChipRow>
            {OM_REPORT_TYPES.map((r) => (
              <Chip key={r.type} size="small" variant="outlined" label={r.label} />
            ))}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'scada-iot' && (
        <OmSectionCard title="SCADA & IoT coverage" accent="operations">
          <Grid container spacing={1.5} mb={2}>
            {OM_SCADA_SITES.map((s) => (
              <Grid item xs={12} sm={6} md={3} key={s.category}>
                <OmInfoTile title={s.label}>
                  <Typography variant="caption" color="text.secondary">{s.metrics.map((m) => m.label).join(' · ')}</Typography>
                </OmInfoTile>
              </Grid>
            ))}
          </Grid>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Automated alerts</Typography>
          <OmChipRow>
            {OM_SCADA_ALERT_TYPES.map((a) => (
              <Chip key={a.type} size="small" variant="outlined" label={a.label} />
            ))}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'energy' && (
        <OmSectionCard title="Energy monitoring" accent="operations">
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Monitored metrics</Typography>
          <OmChipRow>
            {OM_ENERGY_METRICS.map((m) => (
              <Chip key={m.key} size="small" variant="outlined" label={`${m.label}${m.unit ? ` (${m.unit})` : ''}`} />
            ))}
          </OmChipRow>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mt: 1.5 }}>Generated reports</Typography>
          <OmChipRow>
            {OM_ENERGY_REPORT_TYPES.map((r) => (
              <Chip key={r.type} size="small" label={r.label} color="primary" variant="outlined" />
            ))}
          </OmChipRow>
        </OmSectionCard>
      )}
      {stageKey === 'water-quality' && (
        <OmSectionCard title="Water quality parameters" accent="operations">
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <OmInfoTile title="Sample points">
                <Typography variant="caption" color="text.secondary">Source · Reservoir · Distribution Network · FHTC Locations</Typography>
              </OmInfoTile>
            </Grid>
            {OM_WQ_PARAMETER_GROUPS.map((g) => (
              <Grid item xs={12} md={4} key={g.group}>
                <OmInfoTile title={g.label}>
                  <Typography variant="caption" color="text.secondary">{g.parameters.map((p) => p.label).join(' · ')}</Typography>
                </OmInfoTile>
              </Grid>
            ))}
          </Grid>
        </OmSectionCard>
      )}
      {stageKey === 'breakdown' && (
        <OmSectionCard title="Breakdown complaint categories" accent="operations">
          <Grid container spacing={1.5}>
            {BD_CATALOG.map((g) => (
              <Grid item xs={12} sm={6} md={3} key={g.group}>
                <OmInfoTile title={g.label}>
                  <Typography variant="caption" color="text.secondary">
                    {g.complaints.map((c) => c.label).join(' · ')}
                  </Typography>
                </OmInfoTile>
              </Grid>
            ))}
          </Grid>
        </OmSectionCard>
      )}
      {stageKey === 'preventive-maintenance' && (
        <OmSectionCard title="PM task catalogue" accent="operations">
          <Grid container spacing={1.5}>
            {[
              { title: 'Pump', items: 'Daily: lubrication, temperature, noise · Monthly: bearing, alignment · Annual: overhauling' },
              { title: 'Reservoir', items: 'Monthly: visual inspection · Quarterly: cleaning & disinfection · Annual: structural inspection' },
              { title: 'Pipeline', items: 'Monthly: leakage survey · Quarterly: valve testing · Annual: network audit' },
            ].map((c) => (
              <Grid item xs={12} md={4} key={c.title}>
                <OmInfoTile title={c.title}>
                  <Typography variant="caption" color="text.secondary">{c.items}</Typography>
                </OmInfoTile>
              </Grid>
            ))}
          </Grid>
        </OmSectionCard>
      )}
      {stageKey === 'inspections' && (
        <OmSectionCard title="Inspection cycles" accent="operations">
          <Grid container spacing={1.5}>
            {[
              { title: 'Daily', who: 'Pump / Plant / Field Operator', items: 'Pump hours, levels, flow, pressure, chlorine, power, leakage, geo-photos' },
              { title: 'Weekly', who: 'Junior Engineer', items: 'Pump house, reservoir, valves, network, electrical safety, leakage points' },
              { title: 'Monthly', who: 'Assistant Engineer', items: 'Asset health, supply performance, O&M compliance, coverage, energy efficiency' },
            ].map((c) => (
              <Grid item xs={12} md={4} key={c.title}>
                <OmInfoTile title={c.title}>
                  <Typography variant="caption" color="primary" display="block" mb={0.5}>{c.who}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.items}</Typography>
                </OmInfoTile>
              </Grid>
            ))}
          </Grid>
        </OmSectionCard>
      )}
      {stageKey === 'asset-registration' && (
        <OmSectionCard title="Asset categories" accent="foundation">
          <Grid container spacing={1.5}>
            {OM_ASSET_CATEGORIES.map((cat) => (
              <Grid item xs={12} sm={6} key={cat.group}>
                <OmInfoTile title={cat.group}>
                  <Typography variant="caption" color="text.secondary">{cat.items.join(' · ')}</Typography>
                </OmInfoTile>
              </Grid>
            ))}
          </Grid>
        </OmSectionCard>
      )}
    </OmSectionCard>
  );
}

export default function OmManagementPage() {
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState<Record<string, number | null>>({});
  const [handovers, setHandovers] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState('');
  const stagePanelRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const pageCopy = usePageCopy('om');
  const workflowStages = useLocalizedOmWorkflowStages();

  const scrollToStagePanel = useCallback(() => {
    requestAnimationFrame(() => {
      stagePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const divisionScopeKey = useDivisionScopeKey();

  const load = () => {
    Promise.all([
      omApi.dashboard(),
      omApi.listHandovers(),
    ])
      .then(([dash, ho]) => {
        setDashboard(dash.data);
        setHandovers(ho.data);
      })
      .catch((err) => setError(err?.response?.data?.message ?? 'Failed to load O&M data'));
  };

  useEffect(() => { load(); }, [divisionScopeKey]);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      const idx = OM_WORKFLOW_STAGES.findIndex((s) => s.key === hash);
      if (idx >= 0) setTab(idx);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  useEffect(() => {
    const assetId = searchParams.get('asset');
    const assetCode = searchParams.get('code');
    if (!assetId && !assetCode) return;

    const idx = OM_WORKFLOW_STAGES.findIndex((s) => s.key === 'asset-registration');
    if (idx >= 0) setTab(idx);
    scrollToStagePanel();
  }, [searchParams, scrollToStagePanel]);

  const activeStage = workflowStages[tab];
  const implementedStages = ['handover', 'asset-registration', 'inspections', 'preventive-maintenance', 'breakdown', 'water-quality', 'energy', 'scada-iot', 'consumer-service', 'complaints', 'contracts', 'lifecycle', 'dashboard', 'reports', 'jal-mitra'];

  const goToStage = (stageNum: number) => {
    const idx = OM_WORKFLOW_STAGES.findIndex((s) => s.stage === stageNum);
    if (idx >= 0) {
      setTab(idx);
      const key = OM_WORKFLOW_STAGES[idx].key;
      window.history.replaceState(null, '', `#${key}`);
      scrollToStagePanel();
    }
  };

  const handleTabChange = (_: unknown, v: number) => {
    setTab(v);
    const key = OM_WORKFLOW_STAGES[v]?.key;
    if (key) window.history.replaceState(null, '', `#${key}`);
    scrollToStagePanel();
  };

  return (
    <PageShell fullHeight>
      <PageHeader
        eyebrow={pageCopy.eyebrow}
        title={pageCopy.title}
        subtitle={pageCopy.subtitle}
        accent="teal"
        leading={<BuildCircleOutlinedIcon sx={{ fontSize: 36, color: '#0d9488', mt: 0.5 }} />}
      />

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box
        sx={{
          mb: 2.5,
          p: 2.5,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #042f2e 0%, #0f766e 42%, #0284c7 100%)',
          color: '#f8fafc',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box position="relative" zIndex={1}>
          <Typography variant="overline" sx={{ letterSpacing: '0.14em', fontWeight: 700, color: 'rgba(248,250,252,0.75)' }}>
            O&M lifecycle
          </Typography>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
            Handover → Assets → Inspections → Maintenance → Consumer service → Analytics
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.85)', mb: 2, maxWidth: 760 }}>
            Click any stage below to jump directly. Each module covers scheme operations from post-commissioning handover through Jal Mitra AI analytics.
          </Typography>
          <OmPipelineTracker activeStage={activeStage.stage} onStageSelect={goToStage} />
        </Box>
      </Box>

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12}><OmKpiGroupLabel>Handover & asset foundation</OmKpiGroupLabel></Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Handover Records" value={dashboard.handoverRecords ?? 0} tone="teal" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Critical Assets" value={dashboard.criticalAssets ?? 0} tone="rose" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Avg Health Index" value={dashboard.avgHealthIndex ?? '—'} tone="teal" />
        </Grid>

        <Grid item xs={12}><OmKpiGroupLabel>Field operations & maintenance</OmKpiGroupLabel></Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Open Breakdowns" value={dashboard.openBreakdowns ?? 0} tone="amber" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Closed Breakdowns" value={dashboard.closedBreakdowns ?? 0} tone="blue" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Inspections Due" value={dashboard.inspectionDue ?? 0} tone="rose" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="PM Overdue" value={dashboard.pmOverdue ?? 0} tone="rose" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="SCADA Alerts" value={dashboard.scadaAlerts ?? 0} tone="amber" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Water Quality Alerts" value={dashboard.waterQualityAlerts ?? 0} tone="violet" />
        </Grid>

        <Grid item xs={12}><OmKpiGroupLabel>Consumer service & contracts</OmKpiGroupLabel></Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Open Complaints" value={dashboard.openComplaints ?? 0} tone="amber" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard label="Active Contracts" value={dashboard.activeContracts ?? 0} tone="teal" />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <KpiStatCard
            label="Avg SLA Compliance"
            value={dashboard.avgSlaCompliancePct != null ? `${dashboard.avgSlaCompliancePct}%` : '—'}
            tone="blue"
          />
        </Grid>
      </Grid>

      <Box ref={stagePanelRef} sx={{ scrollMarginTop: '88px' }}>
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 0,
          overflowX: 'auto',
          bgcolor: '#fff',
          borderRadius: '12px 12px 0 0',
          border: '1px solid #e2e8f0',
          borderBottom: 'none',
          px: 1,
          pt: 0.5,
        }}
      >
        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={omTabsSx}
        >
          {workflowStages.map((s) => (
            <Tab key={s.key} label={`${s.stage}. ${s.name}`} />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 12px 12px', p: 2, mb: 2 }}>
      {activeStage.key === 'asset-registration' && (
        <>
          <StageOverview stages={workflowStages} stageKey="asset-registration" />
          <OmAssetRegistrationStage />
        </>
      )}

      {activeStage.key === 'inspections' && (
        <>
          <StageOverview stages={workflowStages} stageKey="inspections" />
          <OmInspectionStage />
        </>
      )}

      {activeStage.key === 'preventive-maintenance' && (
        <>
          <StageOverview stages={workflowStages} stageKey="preventive-maintenance" />
          <OmPreventiveMaintenanceStage />
        </>
      )}

      {activeStage.key === 'breakdown' && (
        <>
          <StageOverview stages={workflowStages} stageKey="breakdown" />
          <OmBreakdownStage />
        </>
      )}

      {activeStage.key === 'water-quality' && (
        <>
          <StageOverview stages={workflowStages} stageKey="water-quality" />
          <OmWaterQualityStage />
        </>
      )}

      {activeStage.key === 'energy' && (
        <>
          <StageOverview stages={workflowStages} stageKey="energy" />
          <OmEnergyStage />
        </>
      )}

      {activeStage.key === 'scada-iot' && (
        <>
          <StageOverview stages={workflowStages} stageKey="scada-iot" />
          <OmScadaStage />
        </>
      )}

      {activeStage.key === 'consumer-service' && (
        <>
          <StageOverview stages={workflowStages} stageKey="consumer-service" />
          <OmConsumerServiceStage />
        </>
      )}

      {activeStage.key === 'complaints' && (
        <>
          <StageOverview stages={workflowStages} stageKey="complaints" />
          <OmComplaintStage />
        </>
      )}

      {activeStage.key === 'contracts' && (
        <>
          <StageOverview stages={workflowStages} stageKey="contracts" />
          <OmContractStage />
        </>
      )}

      {activeStage.key === 'lifecycle' && (
        <>
          <StageOverview stages={workflowStages} stageKey="lifecycle" />
          <OmLifecycleStage />
        </>
      )}

      {activeStage.key === 'dashboard' && (
        <>
          <StageOverview stages={workflowStages} stageKey="dashboard" />
          <OmDashboardStage />
        </>
      )}

      {activeStage.key === 'reports' && (
        <>
          <StageOverview stages={workflowStages} stageKey="reports" />
          <OmReportsStage />
        </>
      )}

      {activeStage.key === 'jal-mitra' && (
        <>
          <StageOverview stages={workflowStages} stageKey="jal-mitra" />
          <OmJalMitraAnalyticsStage />
        </>
      )}

      {activeStage.key === 'handover' && (
        <>
          <StageOverview stages={workflowStages} stageKey="handover" />
          <OmHandoverStage handovers={handovers} onRefresh={load} />
        </>
      )}

      {!implementedStages.includes(activeStage.key) && (
        <StageOverview stages={workflowStages} stageKey={activeStage.key} />
      )}
      </Box>
      </Box>
    </PageShell>
  );
}
