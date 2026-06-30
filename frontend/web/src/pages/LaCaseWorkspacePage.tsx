import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, LinearProgress, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import type { FeatureCollection } from 'geojson';
import axios from 'axios';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { landAcquisitionApi } from '../services/api';
import PageShell from '../components/layout/PageShell';
import SurfaceCard from '../components/layout/SurfaceCard';
import KpiStatCard from '../components/layout/KpiStatCard';
import LaMapPanel from '../components/la/LaMapPanel';
import LaGisLayersPanel from '../components/la/LaGisLayersPanel';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import LaAutoRouteDialog from '../components/la/LaAutoRouteDialog';
import LaLinkProjectPanel from '../components/la/LaLinkProjectPanel';
import LaRouteRecommendationDialog from '../components/la/LaRouteRecommendationDialog';
import LaParcelsTable from '../components/la/LaParcelsTable';
import LaClearanceProposalPanel from '../components/la/LaClearanceProposalPanel';
import LaCompensationTable from '../components/la/LaCompensationTable';
import LaAiAlertsPanel, { type LaAiAlertsBundle } from '../components/la/LaAiAlertsPanel';
import LaWorkflowPipeline from '../components/la/LaWorkflowPipeline';
import LaPipelineWorkflowGuide from '../components/la/LaPipelineWorkflowGuide';
import LaGisDashboardPanel, { type LaGisDashboardData } from '../components/la/LaGisDashboardPanel';
import LaDocumentsPanel from '../components/la/LaDocumentsPanel';
import { laStatusColor, laStatusLabel } from '../constants/laAcquisition';
import type { LaWorkflowProgress } from '../constants/laWorkflow';
import type { LaLayerReadinessRow } from '../constants/laGisLayers';
import { dataTableSx } from '../utils/pagePresentationStyles';
import { useAuth } from '../context/AuthContext';
import { canPerformOperational } from '../utils/operationalAccess';

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function LaCaseWorkspacePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showWorkspaceLinkedBanner, setShowWorkspaceLinkedBanner] = useState(false);
  const { user, hasPermission } = useAuth();
  const roles = user?.roles ?? [];
  const canUpdate = canPerformOperational(roles, hasPermission, 'la_case:update');
  const canApprove = canPerformOperational(roles, hasPermission, 'la_case:approve');
  const [tab, setTab] = useState(0);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [mapGeoJson, setMapGeoJson] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [autoRouteOpen, setAutoRouteOpen] = useState(false);
  const [recommendOpen, setRecommendOpen] = useState(false);
  /** Shared pipeline import — available in Auto Route and AI Route Compare for this case session */
  const [importedPipelineNetwork, setImportedPipelineNetwork] = useState<FeatureCollection | null>(null);
  const [importedPipelineFileName, setImportedPipelineFileName] = useState<string | null>(null);
  const [caseGis, setCaseGis] = useState<LaGisDashboardData | null>(null);
  const [routingCriteria, setRoutingCriteria] = useState<Array<{ code: string; label: string; defaultWeight: number }>>([]);

  const load = useCallback(() => {
    if (!caseId) return;
    setBusy(true);
    Promise.all([
      landAcquisitionApi.getCase(caseId),
      landAcquisitionApi.caseGisDashboard(caseId).catch(() => ({ data: null })),
    ])
      .then(([caseRes, gisRes]) => {
        setDetail(caseRes.data as Record<string, unknown>);
        setCaseGis((gisRes.data ?? null) as LaGisDashboardData | null);
      })
      .catch((err) => setError(getApiError(err, 'Failed to load case')))
      .finally(() => setBusy(false));
  }, [caseId]);

  const loadMap = useCallback(() => {
    if (!caseId) return;
    setMapLoading(true);
    landAcquisitionApi.getMapGeoJson(caseId)
      .then((res) => setMapGeoJson(res.data as FeatureCollection))
      .catch(() => setMapGeoJson(null))
      .finally(() => setMapLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('workspaceLinked') === '1') {
      setShowWorkspaceLinkedBanner(true);
      const next = new URLSearchParams(searchParams);
      next.delete('workspaceLinked');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /** Trigger backend auto-provision via routing-schemes, then refresh if workspace was linked */
  useEffect(() => {
    if (!caseId || detail?.projectId) return;
    let cancelled = false;
    landAcquisitionApi.getRoutingSchemes(caseId)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.linkedProjectId) load();
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [caseId, detail?.projectId, detail?.dprProposalId, load]);

  useEffect(() => { if (caseId) loadMap(); }, [caseId, loadMap, detail?.status]);
  useEffect(() => {
    landAcquisitionApi.getCatalog()
      .then((res) => {
        const rows = (res.data?.routingCriteria as Array<{ code: string; label: string; defaultWeight: number }>) ?? [];
        setRoutingCriteria(rows);
      })
      .catch(() => setRoutingCriteria([]));
  }, []);

  const runAction = (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setSuccess('');
    fn()
      .then((res) => {
        setDetail(res as Record<string, unknown>);
        setSuccess(`${label} completed`);
        loadMap();
      })
      .catch((err) => setError(getApiError(err, `${label} failed`)))
      .finally(() => setBusy(false));
  };

  if (!caseId) return null;

  const parcels = (detail?.parcels as Array<Record<string, unknown>>) ?? [];
  const clearances = (detail?.clearances as Array<Record<string, unknown>>) ?? [];
  const clearanceProposal = detail?.clearanceProposal as Record<string, unknown> | null | undefined;
  const compensations = (detail?.compensations as Array<Record<string, unknown>>) ?? [];
  const compensationSummary = detail?.compensationSummary as Record<string, unknown> | null | undefined;
  const documentCatalog = (detail?.documentCatalog as Array<Record<string, unknown>>) ?? [];
  const documents = (detail?.documents as Array<Record<string, unknown>>) ?? [];
  const readiness = detail?.readiness as Record<string, unknown> | undefined;
  const workflow = detail?.workflow as LaWorkflowProgress | undefined;
  const aiAlerts = detail?.aiAlerts as LaAiAlertsBundle | undefined;
  const layerReadiness = (detail?.layerReadiness as LaLayerReadinessRow[]) ?? [];
  const nextAction = detail?.nextAction as { label?: string } | null;
  const parcelCount = parcels.length || Number(detail?.totalParcels ?? 0);
  const alignmentCount = ((detail?.alignments as unknown[]) ?? []).length;
  const alignments = (detail?.alignments as Array<{ lengthM?: number }>) ?? [];
  const alignmentLengthM = alignments.reduce((sum, a) => sum + Number(a.lengthM ?? 0), 0);
  const alignmentAppliedAt = (() => {
    const events = (detail?.events as Array<Record<string, unknown>>) ?? [];
    const traceEvent = events.find((e) => /trace|route|align/i.test(String(e.action ?? e.remarks ?? '')));
    if (traceEvent?.createdAt) return String(traceEvent.createdAt);
    return detail?.updatedAt ? String(detail.updatedAt) : undefined;
  })();

  const parcelById = new Map(parcels.map((p) => [String(p.id), p]));

  const pipelineWorkflowState = {
    hasProject: Boolean(detail?.projectId),
    hasImportedOrAppliedRoute: Boolean(importedPipelineNetwork?.features.length || alignmentCount),
    alignmentCount,
    parcelCount,
    clearanceCount: clearances.length,
  };

  const mapPublishMeta = detail ? {
    caseNo: String(detail.caseNo),
    title: String(detail.title),
    schemeType: String(detail.schemeType),
    parcelCount,
    alignmentLengthM: alignmentLengthM || undefined,
    clearances: clearances.map((c) => ({
      label: String(c.label ?? c.clearanceType),
      authority: c.authority ? String(c.authority) : undefined,
      status: String(c.status),
      overlayLayer: c.overlayLayerLabel ? String(c.overlayLayerLabel) : undefined,
    })),
    affectedAuthorities: [...new Set(clearances.map((c) => String(c.authority ?? '')).filter(Boolean))],
  } : undefined;

  const mapPipelineInfo = {
    importFileName: importedPipelineFileName,
    appliedAt: alignmentCount > 0 ? alignmentAppliedAt : undefined,
    alignmentLengthM: alignmentLengthM || undefined,
  };

  return (
    <PageShell>
      <Box mb={2}>
        <Button component={RouterLink} to="/land-acquisition" startIcon={<ArrowBackOutlinedIcon />} size="small">
          All LA Cases
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {showWorkspaceLinkedBanner && detail?.projectId && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setShowWorkspaceLinkedBanner(false)}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            DPR GIS workspace linked
          </Typography>
          <Typography variant="body2">
            {detail.isDprGisWorkspace
              ? `GIS workspace "${String(detail.projectName ?? 'DPR scheme')}" is ready. Import pipeline SHP in Auto Route, then Trace Alignment to identify affected parcels.`
              : `Project "${String(detail.projectName ?? 'linked project')}" is linked. Use Auto Route or Trace Alignment to begin pipeline analysis.`}
            {detail.dprProposalNo ? ` Linked to DPR ${String(detail.dprProposalNo)}.` : ''}
          </Typography>
        </Alert>
      )}
      {busy && <LinearProgress sx={{ mb: 2 }} />}

      {detail && (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} mb={2}>
            <Box>
              <Typography variant="h5" fontWeight={700}>{String(detail.title)}</Typography>
              <Typography variant="body2" color="text.secondary">{String(detail.caseNo)}</Typography>
              <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                <Chip size="small" color={laStatusColor(String(detail.status))}
                  label={String(detail.statusLabel ?? laStatusLabel(String(detail.status)))} />
                <Chip size="small" variant="outlined" label={String(detail.schemeType)} />
                {detail.projectId ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    color={detail.isDprGisWorkspace ? 'info' : 'primary'}
                    label={detail.isDprGisWorkspace
                      ? `DPR GIS: ${String(detail.projectName ?? detail.dprProposalNo ?? 'Scheme')}`
                      : String(detail.projectName ?? 'Linked project')}
                  />
                ) : detail.dprProposalId ? (
                  <Chip size="small" variant="outlined" color="info" label="DPR-linked (GIS workspace pending)" />
                ) : (
                  <Chip size="small" variant="outlined" color="warning" label="No project linked" />
                )}
              </Box>
            </Box>
            {(canUpdate || canApprove) && (
            <Box display="flex" gap={1} flexWrap="wrap">
              {canUpdate && (
                <>
                  <Button size="small" variant="contained" color="secondary" startIcon={<RouteOutlinedIcon />}
                    disabled={busy} onClick={() => setAutoRouteOpen(true)}>
                    Auto Route
                  </Button>
                  <Button size="small" variant="contained" startIcon={<AutoAwesomeOutlinedIcon />}
                    disabled={busy} onClick={() => setRecommendOpen(true)}>
                    AI Route Compare
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<PlayArrowOutlinedIcon />}
                    disabled={busy || !detail.projectId}
                    onClick={() => runAction('Trace alignment', () => landAcquisitionApi.traceAlignment(caseId).then((r) => r.data))}>
                    Trace Alignment
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<SearchOutlinedIcon />}
                    disabled={busy || !alignmentCount}
                    onClick={() => runAction('Identify parcels', () => landAcquisitionApi.identifyParcels(caseId).then((r) => r.data))}>
                    Identify Parcels
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<GavelOutlinedIcon />}
                    disabled={busy || !parcelCount}
                    onClick={() => runAction('Detect clearances', () => landAcquisitionApi.detectClearances(caseId).then((r) => r.data))}>
                    Detect Clearances
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<CalculateOutlinedIcon />}
                    disabled={busy || !parcelCount}
                    onClick={() => runAction('Estimate compensation', () => landAcquisitionApi.estimateCompensation(caseId).then((r) => r.data))}>
                    Estimate Compensation
                  </Button>
                </>
              )}
              {canApprove && nextAction?.label && (
                <Button size="small" variant="contained" disabled={busy}
                  onClick={() => runAction(nextAction.label!, () => landAcquisitionApi.advanceCase(caseId).then((r) => r.data))}>
                  {nextAction.label}
                </Button>
              )}
            </Box>
            )}
          </Box>

          <Grid container spacing={2} mb={2}>
            <Grid item xs={6} sm={3}><KpiStatCard label="Parcels" value={Number(detail.totalParcels ?? 0)} /></Grid>
            <Grid item xs={6} sm={3}><KpiStatCard label="Affected Area (m²)" value={Number(detail.totalAreaSqm ?? 0).toLocaleString('en-IN')} /></Grid>
            <Grid item xs={6} sm={3}><KpiStatCard label="Est. Compensation" value={`₹ ${Number(detail.totalCompensationEst ?? 0).toLocaleString('en-IN')}`} /></Grid>
            <Grid item xs={6} sm={3}><KpiStatCard label="Clearances" value={String(detail.clearanceStatus ?? 'pending')} /></Grid>
          </Grid>

          {(readiness?.missingActions as string[] | undefined)?.length ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {(readiness!.missingActions as string[]).map((m) => (
                <Typography key={m} variant="caption" display="block">• {m}</Typography>
              ))}
              {!parcelCount && alignmentCount > 0 && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  • Next step: click <strong>Identify Parcels</strong> to intersect the traced ROW with cadastral layers
                  (or generate ROW placeholder parcels if no cadastral data is imported yet).
                </Typography>
              )}
            </Alert>
          ) : null}

          <Box sx={{ mb: 2 }}>
            <LaPipelineWorkflowGuide state={pipelineWorkflowState} />
          </Box>

          {!detail.projectId && !detail.dprProposalId && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>
                Link a GIS project to enable auto-routing
              </Typography>
              {canUpdate ? (
                <LaLinkProjectPanel
                  caseId={caseId}
                  linkedProjectId={detail.projectId as string | null | undefined}
                  linkedProjectName={detail.projectName as string | null | undefined}
                  linkedProjectStatus={detail.projectStatus as string | null | undefined}
                  dprProposalId={detail.dprProposalId as string | null | undefined}
                  onRoutingResolved={(id) => { if (id && !detail.projectId) load(); }}
                  onLinked={load}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  A division account with LA update permission must link a GIS project before routing can begin.
                </Typography>
              )}
            </Alert>
          )}

          {caseGis && (
            <SurfaceCard title="Case GIS Dashboard" sx={{ mb: 2 }}>
              <LaGisDashboardPanel data={caseGis} title="" />
            </SurfaceCard>
          )}

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} lg={8}>
              <SurfaceCard title="Acquisition Workflow">
                <LaWorkflowPipeline status={String(detail.status)} workflow={workflow} />
              </SurfaceCard>
            </Grid>
            <Grid item xs={12} lg={4}>
              <SurfaceCard title="Workflow Events">
                <TableContainer>
                  <Table size="small" sx={dataTableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Stage</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {((detail.events as Array<Record<string, unknown>>) ?? []).slice(0, 8).map((e) => (
                        <TableRow key={String(e.id)}>
                          <TableCell>
                            <Typography variant="caption">{laStatusLabel(String(e.stage))}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {String(e.remarks ?? e.action ?? '—')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </SurfaceCard>
            </Grid>
          </Grid>

          <SurfaceCard title="AI Alerts" sx={{ mb: 2 }}>
            <LaAiAlertsPanel data={aiAlerts} />
          </SurfaceCard>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Map" />
            <Tab label={`Parcels (${parcels.length})`} />
            <Tab label={`Clearances (${clearances.length})`} />
            <Tab label="GIS Layers" />
            <Tab label="Compensation" />
            <Tab label={`Documents (${documents.length})`} />
          </Tabs>

          {tab === 0 && (
            <SurfaceCard title="Acquisition Map">
              <LaMapPanel
                geoJson={mapGeoJson}
                loading={mapLoading}
                importedPipelineNetwork={importedPipelineNetwork}
                importFileName={importedPipelineFileName}
                pipelineInfo={mapPipelineInfo}
                publishMeta={mapPublishMeta}
                onOpenAutoRoute={canUpdate ? () => setAutoRouteOpen(true) : undefined}
                clearances={clearances.map((c) => {
                  const parcel = c.laParcelId != null ? parcelById.get(String(c.laParcelId)) : undefined;
                  return {
                    id: String(c.id),
                    status: String(c.status),
                    laParcelId: c.laParcelId != null ? String(c.laParcelId) : null,
                    label: String(c.label ?? c.clearanceType),
                    authority: c.authority != null ? String(c.authority) : null,
                    clearanceType: c.clearanceType != null ? String(c.clearanceType) : undefined,
                    overlayLayerLabel: c.overlayLayerLabel != null ? String(c.overlayLayerLabel) : null,
                    khasraNo: parcel?.khasraNo != null ? String(parcel.khasraNo) : null,
                  };
                })}
              />
            </SurfaceCard>
          )}

          {tab === 1 && (
            <SurfaceCard title="Affected Land Parcels — Automatic Detection">
              <LaParcelsTable parcels={parcels} />
            </SurfaceCard>
          )}

          {tab === 2 && (
            <SurfaceCard title="Statutory Clearances">
              <LaClearanceProposalPanel proposal={clearanceProposal as Record<string, unknown> | null | undefined} />
              <Typography variant="subtitle2" fontWeight={600} mb={1}>Detected Clearance Items</Typography>
              <TableContainer>
                <Table size="small" sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Clearance</TableCell>
                      <TableCell>GIS Layer</TableCell>
                      <TableCell>Authority</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clearances.map((c) => (
                      <TableRow key={String(c.id)}>
                        <TableCell>{String(c.label ?? c.clearanceType)}</TableCell>
                        <TableCell>{String(c.overlayLayerLabel ?? c.overlayLayerCode ?? '—')}</TableCell>
                        <TableCell>{String(c.authority ?? '—')}</TableCell>
                        <TableCell><Chip size="small" label={String(c.status)} color={c.status === 'approved' ? 'success' : 'warning'} /></TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {String(c.notes ?? '—')}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {c.status !== 'approved' && canApprove && (
                            <Button size="small" onClick={() => runAction('Approve clearance', () =>
                              landAcquisitionApi.updateClearance(String(c.id), { status: 'approved', referenceNo: 'APPROVED' }).then((r) => r.data))}>
                              Mark Approved
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!clearances.length && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary" py={2}>
                            Run Detect Clearances after parcels are identified. Clearances are generated by intersecting the ROW corridor with configured GIS layers.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </SurfaceCard>
          )}

          {tab === 3 && (
            <SurfaceCard title="GIS Layers Required">
              <LaGisLayersPanel
                layers={layerReadiness}
                projectId={detail.projectId as string | null | undefined}
              />
            </SurfaceCard>
          )}

          {tab === 4 && (
            <SurfaceCard title="Automatic Compensation Calculation (RFCTLARR Act 2013)">
              <LaCompensationTable
                compensations={compensations}
                parcels={parcels}
                summary={compensationSummary as Parameters<typeof LaCompensationTable>[0]['summary']}
              />
            </SurfaceCard>
          )}

          {tab === 5 && caseId && (
            <SurfaceCard title="Auto Generated Documents">
              <LaDocumentsPanel
                caseId={caseId}
                catalog={documentCatalog as Array<{ code: string; label: string; category: string; generated?: boolean; authority?: string; clearanceType?: string }>}
                documents={documents as Array<{ documentCode: string; title: string; status: string; category: string }>}
                onGenerated={() => { load(); setSuccess('Documents generated'); }}
                canGenerate={canUpdate}
                hasParcels={parcelCount > 0}
                hasClearances={clearances.length > 0}
              />
            </SurfaceCard>
          )}
        </>
      )}

      {caseId && canUpdate && (
        <>
          <LaAutoRouteDialog
            caseId={caseId}
            projectId={detail?.projectId as string | null | undefined}
            projectName={detail?.projectName as string | null | undefined}
            projectStatus={detail?.projectStatus as string | null | undefined}
            dprProposalId={detail?.dprProposalId as string | null | undefined}
            isDprGisWorkspace={Boolean(detail?.isDprGisWorkspace)}
            dprProposalNo={detail?.dprProposalNo as string | null | undefined}
            open={autoRouteOpen}
            onClose={() => setAutoRouteOpen(false)}
            onApplied={() => { load(); loadMap(); setSuccess('Auto route applied and alignment traced'); }}
            onProjectLinked={load}
            criteria={routingCriteria}
            importedPipelineNetwork={importedPipelineNetwork}
            onImportedPipelineNetworkChange={setImportedPipelineNetwork}
            importedPipelineFileName={importedPipelineFileName}
            onImportedPipelineFileNameChange={setImportedPipelineFileName}
          />
          <LaRouteRecommendationDialog
            caseId={caseId}
            projectId={detail?.projectId as string | null | undefined}
            projectName={detail?.projectName as string | null | undefined}
            projectStatus={detail?.projectStatus as string | null | undefined}
            dprProposalId={detail?.dprProposalId as string | null | undefined}
            open={recommendOpen}
            onClose={() => setRecommendOpen(false)}
            onApplied={() => { load(); loadMap(); setSuccess('Recommended route applied and alignment traced'); }}
            onProjectLinked={load}
            importedPipelineNetwork={importedPipelineNetwork}
            onImportedPipelineNetworkChange={setImportedPipelineNetwork}
            importedPipelineFileName={importedPipelineFileName}
            onImportedPipelineFileNameChange={setImportedPipelineFileName}
          />
        </>
      )}
    </PageShell>
  );
}
