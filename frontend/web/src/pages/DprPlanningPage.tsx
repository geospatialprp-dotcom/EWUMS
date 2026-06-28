import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent,
  Grid, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import axios from 'axios';
import { dprPlanningApi } from '../services/api';
import BilingualRemarkField from '../components/forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../hooks/useBilingualRemark';
import { serializeBilingualText, type BilingualText } from '../utils/bilingualText';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import { dataTableSx } from '../utils/pagePresentationStyles';
import KpiStatCard from '../components/layout/KpiStatCard';
import SurfaceCard from '../components/layout/SurfaceCard';
import DprStage1InitiationPanel from '../components/dpr/DprStage1InitiationPanel';
import DprHqReviewPanel from '../components/dpr/DprHqReviewPanel';
import DprStage3PreparationPanel from '../components/dpr/DprStage3PreparationPanel';
import DprTacReviewPanel from '../components/dpr/DprTacReviewPanel';
import DprRevisionPanel from '../components/dpr/DprRevisionPanel';
import DprSecretariatPanel from '../components/dpr/DprSecretariatPanel';
import DprTacRound2Panel from '../components/dpr/DprTacRound2Panel';
import DprRound2CompliancePanel from '../components/dpr/DprRound2CompliancePanel';
import DprSanctionPanel from '../components/dpr/DprSanctionPanel';
import DprTenderInitiationPanel from '../components/dpr/DprTenderInitiationPanel';
import DprTenderProcessingPanel from '../components/dpr/DprTenderProcessingPanel';
import { useAuth } from '../context/AuthContext';
import {
  canForwardDprToTac,
  canForwardToSecretariat,
  canInitiateDprTenderPrep,
  canPerformHqReview,
  canPerformTacReview,
  canPerformTacRound2Review,
  canRecordDprSanction,
  DPR_ACTION_LABELS,
  DPR_DOCUMENT_TYPES,
} from '../constants/dprPlanningWorkflow';
import { useDivisionScopeKey } from '../context/DivisionContext';
import {
  DprDialogHeader,
  DprPipelineTracker,
  DprStageProgress,
  DprStatusChip,
  dprDialogActionsSx,
  dprDialogContentSx,
  dprDialogPaperSx,
} from '../components/dpr/dprUi';

type ProposalRow = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  currentStage: number;
  stageLabel?: string;
  divisionName?: string | null;
  preliminaryEstimate?: number | null;
  updatedAt?: string;
  allowedActions?: string[];
};

type DashboardData = {
  total?: number;
  sanctioned?: number;
  tacPending?: number;
  hqPending?: number;
  dprPreparationInProgress?: number;
  secretariatPending?: number;
  tacRound2Pending?: number;
  govtConcurrencePending?: number;
  tenderPrepPending?: number;
  tenderInProgress?: number;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function DprPlanningPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isSuperAdmin = roles.includes('super_admin');
  const canInitiateAsEe = (roles.includes('ee') || roles.includes('je')) && !isSuperAdmin;
  const canHqReview = canPerformHqReview(roles);
  const canForwardToTac = canForwardDprToTac(roles);
  const canTacReview = canPerformTacReview(roles);
  const canSecretariatForward = canForwardToSecretariat(roles);
  const canTacRound2Review = canPerformTacRound2Review(roles);
  const canRecordSanction = canRecordDprSanction(roles);
  const canInitiateTender = canInitiateDprTenderPrep(roles);
  const [dashboard, setDashboard] = useState<DashboardData>({});
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [stage1Open, setStage1Open] = useState<string | null>(null);
  const [hqReviewOpen, setHqReviewOpen] = useState<string | null>(null);
  const [stage3Open, setStage3Open] = useState<string | null>(null);
  const [tacReviewOpen, setTacReviewOpen] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState<string | null>(null);
  const [secretariatOpen, setSecretariatOpen] = useState<string | null>(null);
  const [tacRound2Open, setTacRound2Open] = useState<string | null>(null);
  const [round2ComplianceOpen, setRound2ComplianceOpen] = useState<string | null>(null);
  const [sanctionOpen, setSanctionOpen] = useState<string | null>(null);
  const [tenderInitOpen, setTenderInitOpen] = useState<string | null>(null);
  const [tenderProcessingOpen, setTenderProcessingOpen] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState<ProposalRow | null>(null);
  const [docOpen, setDocOpen] = useState<ProposalRow | null>(null);

  const [createForm, setCreateForm] = useState({
    title: '',
    preliminaryEstimate: '',
    fundingSource: '',
    priority: 'medium',
  });
  const [createSchemeJustification, setCreateSchemeJustification] = useState<BilingualText>(EMPTY_BILINGUAL);

  const [advanceForm, setAdvanceForm] = useState({
    action: 'submit',
    secretariatRef: '',
    administrativeApprovalNo: '',
    expenditureSanctionNo: '',
    sanctionedAmount: '',
    budgetHead: '',
    sanctionDate: '',
    nitRef: '',
    taskOrderRef: '',
  });
  const [advanceComments, setAdvanceComments] = useState<BilingualText>(EMPTY_BILINGUAL);

  const [docForm, setDocForm] = useState({
    documentType: DPR_DOCUMENT_TYPES[0].type,
    fileName: '',
    fileUrl: '',
  });
  const [docRemarks, setDocRemarks] = useState<BilingualText>(EMPTY_BILINGUAL);

  const divisionScopeKey = useDivisionScopeKey();

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.all([dprPlanningApi.dashboard(), dprPlanningApi.listProposals()])
      .then(([dashRes, listRes]) => {
        setDashboard(dashRes.data ?? {});
        setRows(listRes.data ?? []);
      })
      .catch((err) => setError(getApiError(err, 'Failed to load DPR pipeline')))
      .finally(() => setBusy(false));
  }, [divisionScopeKey]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => {
    if (!createForm.title.trim()) {
      setError('Proposal title is required');
      return;
    }
    setBusy(true);
    dprPlanningApi.createProposal({
      title: createForm.title.trim(),
      schemeJustification: serializeBilingualText(createSchemeJustification).trim() || undefined,
      preliminaryEstimate: createForm.preliminaryEstimate ? Number(createForm.preliminaryEstimate) : undefined,
      fundingSource: createForm.fundingSource.trim() || undefined,
      priority: createForm.priority,
    })
      .then((res) => {
        const created = res.data as ProposalRow;
        setCreateOpen(false);
        setCreateForm({ title: '', preliminaryEstimate: '', fundingSource: '', priority: 'medium' });
        setCreateSchemeJustification(EMPTY_BILINGUAL);
        setSuccess(`Proposal initiated — ID: ${created.proposalNo}. Upload required documents and forward to HQ.`);
        setStage1Open(created.id);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to create proposal')))
      .finally(() => setBusy(false));
  };

  const openWorkflow = (row: ProposalRow) => {
    setWorkflowOpen(row);
    dprPlanningApi.getProposal(row.id)
      .then((res) => {
        const detail = res.data as ProposalRow;
        setWorkflowOpen(detail);
        setAdvanceForm({
          action: detail.allowedActions?.[0] ?? 'submit',
          secretariatRef: '',
          administrativeApprovalNo: '',
          expenditureSanctionNo: '',
          sanctionedAmount: '',
          budgetHead: '',
          sanctionDate: '',
          nitRef: '',
          taskOrderRef: '',
        });
        setAdvanceComments(EMPTY_BILINGUAL);
      })
      .catch((err) => setError(getApiError(err, 'Failed to load proposal')));
  };

  const handleAdvance = () => {
    if (!workflowOpen) return;
    setBusy(true);
    dprPlanningApi.advanceProposal(workflowOpen.id, {
      action: advanceForm.action,
      comments: serializeBilingualText(advanceComments).trim() || undefined,
      secretariatRef: advanceForm.secretariatRef.trim() || undefined,
      administrativeApprovalNo: advanceForm.administrativeApprovalNo.trim() || undefined,
      expenditureSanctionNo: advanceForm.expenditureSanctionNo.trim() || undefined,
      sanctionedAmount: advanceForm.sanctionedAmount ? Number(advanceForm.sanctionedAmount) : undefined,
      budgetHead: advanceForm.budgetHead.trim() || undefined,
      sanctionDate: advanceForm.sanctionDate || undefined,
      nitRef: advanceForm.nitRef.trim() || undefined,
      taskOrderRef: advanceForm.taskOrderRef.trim() || undefined,
    })
      .then(() => {
        setWorkflowOpen(null);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to advance workflow')))
      .finally(() => setBusy(false));
  };

  const handleUploadDoc = () => {
    if (!docOpen || !docForm.fileUrl.trim()) {
      setError('Document URL is required');
      return;
    }
    setBusy(true);
    dprPlanningApi.uploadDocument(docOpen.id, {
      documentType: docForm.documentType,
      fileName: docForm.fileName.trim() || undefined,
      fileUrl: docForm.fileUrl.trim(),
      remarks: serializeBilingualText(docRemarks).trim() || undefined,
    })
      .then(() => {
        setDocOpen(null);
        setDocForm({ documentType: DPR_DOCUMENT_TYPES[0].type, fileName: '', fileUrl: '' });
        setDocRemarks(EMPTY_BILINGUAL);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to upload document')))
      .finally(() => setBusy(false));
  };

  const [trackerStage, setTrackerStage] = useState<number | undefined>(undefined);

  const initiateButton = (
    <Button
      variant="contained"
      color="primary"
      size="medium"
      startIcon={<AddOutlinedIcon />}
      onClick={() => setCreateOpen(true)}
      sx={{
        fontWeight: 700,
        px: 2.5,
        borderRadius: 2,
        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
      }}
    >
      Initiate Proposal
    </Button>
  );

  return (
    <PageShell loading={busy && !rows.length}>
      <PageHeader
        title="DPR Approval & Sanction Pipeline"
        subtitle="Detailed Project Report — Division proposal through TAC, Secretariat, administrative sanction, and tendering"
        leading={<DescriptionOutlinedIcon color="primary" />}
        actions={canInitiateAsEe ? initiateButton : undefined}
      />

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Box
        sx={{
          mb: 2.5,
          p: 2.5,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 45%, #1d4ed8 100%)',
          color: '#f8fafc',
          boxShadow: '0 12px 40px rgba(15, 23, 42, 0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box position="relative" zIndex={1}>
          <Typography variant="overline" sx={{ letterSpacing: '0.14em', fontWeight: 700, color: 'rgba(248,250,252,0.75)' }}>
            End-to-end pipeline
          </Typography>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
            Division proposal → HQ → TAC → Secretariat → Sanction → Tender
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.85)', mb: 2, maxWidth: 720 }}>
            Track every DPR from initiation through administrative approval and procurement. Select a stage below to highlight it in the tracker.
          </Typography>
          <DprPipelineTracker activeStage={trackerStage} />
        </Box>
      </Box>

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Intake & preparation
          </Typography>
        </Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="Total Proposals" value={dashboard.total ?? 0} tone="blue" /></Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="DPR Preparation" value={dashboard.dprPreparationInProgress ?? 0} tone="blue" /></Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="HQ Review Pending" value={dashboard.hqPending ?? 0} tone="amber" /></Grid>
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', mt: 0.5, display: 'block' }}>
            Technical & secretariat review
          </Typography>
        </Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="TAC Pending" value={dashboard.tacPending ?? 0} tone="violet" /></Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="Round 2 TAC" value={dashboard.tacRound2Pending ?? 0} tone="violet" /></Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="Secretariat Pending" value={dashboard.secretariatPending ?? 0} tone="violet" /></Grid>
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', mt: 0.5, display: 'block' }}>
            Sanction & tendering
          </Typography>
        </Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="Govt Concurrence" value={dashboard.govtConcurrencePending ?? 0} tone="teal" /></Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="Sanctioned" value={dashboard.sanctioned ?? 0} tone="teal" /></Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="Tender Prep" value={dashboard.tenderPrepPending ?? 0} tone="amber" /></Grid>
        <Grid item xs={6} sm={4} md={3}><KpiStatCard label="Tender In Progress" value={dashboard.tenderInProgress ?? 0} tone="rose" /></Grid>
      </Grid>

      <SurfaceCard
        header={(
          <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" gap={2} flexWrap="wrap">
            <Typography sx={{ fontWeight: 700 }}>DPR Proposals</Typography>
            <Typography variant="caption" color="text.secondary">{rows.length} active record{rows.length === 1 ? '' : 's'}</Typography>
          </Box>
        )}
      >
        <TableContainer>
          <Table size="small" sx={dataTableSx()}>
            <TableHead>
              <TableRow>
                <TableCell>Proposal ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Division</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onMouseEnter={() => setTrackerStage(row.currentStage)}
                  onMouseLeave={() => setTrackerStage(undefined)}
                  sx={{ '&:hover': { bgcolor: '#f8fafc' } }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} color="primary.main">{row.proposalNo}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{row.title}</Typography>
                  </TableCell>
                  <TableCell>{row.divisionName ?? '—'}</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>
                    <Typography variant="caption" display="block" color="text.secondary" fontWeight={600} mb={0.5}>
                      {row.stageLabel ?? `Stage ${row.currentStage}`}
                    </Typography>
                    <DprStageProgress currentStage={row.currentStage} />
                  </TableCell>
                  <TableCell><DprStatusChip status={row.statusLabel ?? row.status} /></TableCell>
                  <TableCell align="right">
                    <Box display="flex" flexWrap="wrap" gap={0.5} justifyContent="flex-end">
                    {['tac_corrections_required', 'dpr_revision'].includes(row.status) && (
                      <Button size="small" startIcon={<EditNoteOutlinedIcon />} onClick={() => setRevisionOpen(row.id)}>
                        Stage 5 — Revise DPR
                      </Button>
                    )}
                    {['tac_round1_cleared', 'tac_round1_final'].includes(row.status) && canSecretariatForward && (
                      <Button size="small" startIcon={<ForwardToInboxOutlinedIcon />} onClick={() => setSecretariatOpen(row.id)}>
                        Stage 6 — Forward to Secretariat
                      </Button>
                    )}
                    {row.status === 'secretariat_submitted' && (
                      <Button size="small" startIcon={<ForwardToInboxOutlinedIcon />} onClick={() => setSecretariatOpen(row.id)}>
                        Secretariat Status
                      </Button>
                    )}
                    {row.status === 'secretariat_submitted' && canTacRound2Review && (
                      <Button size="small" startIcon={<GavelOutlinedIcon />} onClick={() => setTacRound2Open(row.id)}>
                        Stage 7 — Begin Round 2 TAC
                      </Button>
                    )}
                    {row.status === 'tac_round2_review' && canTacRound2Review && (
                      <Button size="small" startIcon={<GavelOutlinedIcon />} onClick={() => setTacRound2Open(row.id)}>
                        Stage 7 — Round 2 Review
                      </Button>
                    )}
                    {row.status === 'govt_technical_concurrence' && (
                      <Button size="small" startIcon={<GavelOutlinedIcon />} onClick={() => setTacRound2Open(row.id)}>
                        Govt Concurrence Status
                      </Button>
                    )}
                    {['tac_round2_corrections_required', 'tac_round2_compliance'].includes(row.status) && (
                      <Button size="small" startIcon={<EditNoteOutlinedIcon />} onClick={() => setRound2ComplianceOpen(row.id)}>
                        Stage 7 — Submit Compliance
                      </Button>
                    )}
                    {['govt_technical_concurrence', 'sanctioned'].includes(row.status) && (
                      <Button size="small" startIcon={<AccountBalanceOutlinedIcon />} onClick={() => setSanctionOpen(row.id)}>
                        {row.status === 'govt_technical_concurrence' && canRecordSanction
                          ? 'Stage 8 — Record Sanction'
                          : 'Sanction Status'}
                      </Button>
                    )}
                    {['sanctioned', 'tender_prep_initiated'].includes(row.status) && (
                      <Button size="small" startIcon={<AssignmentOutlinedIcon />} onClick={() => setTenderInitOpen(row.id)}>
                        {row.status === 'sanctioned' && canInitiateTender
                          ? 'Stage 9 — Initiate Tender'
                          : 'Tender Prep Status'}
                      </Button>
                    )}
                    {['tender_prep_initiated', 'tender_processing', 'tender_published'].includes(row.status) && (
                      <Button size="small" startIcon={<GavelOutlinedIcon />} onClick={() => setTenderProcessingOpen(row.id)}>
                        {row.status === 'tender_prep_initiated'
                          ? 'Stage 10 — Tender Processing'
                          : row.status === 'tender_processing'
                            ? 'Tender Processing'
                            : 'Tender Published'}
                      </Button>
                    )}
                    {row.status === 'dpr_submitted' && canForwardToTac && (
                      <Button size="small" startIcon={<FactCheckOutlinedIcon />} onClick={() => setTacReviewOpen(row.id)}>
                        Forward to TAC
                      </Button>
                    )}
                    {row.status === 'tac_round1_review' && canTacReview && (
                      <Button size="small" startIcon={<FactCheckOutlinedIcon />} onClick={() => setTacReviewOpen(row.id)}>
                        TAC Review — Round 1
                      </Button>
                    )}
                    {['tac_corrections_required', 'dpr_revision', 'tac_round1_cleared'].includes(row.status) && canTacReview && (
                      <Button size="small" startIcon={<FactCheckOutlinedIcon />} onClick={() => setTacReviewOpen(row.id)}>
                        TAC Status
                      </Button>
                    )}
                    {['dpr_prep_approved', 'dpr_preparation'].includes(row.status) && (
                      <Button size="small" startIcon={<BuildOutlinedIcon />} onClick={() => setStage3Open(row.id)}>
                        {canInitiateAsEe ? 'Stage 3 — Prepare' : 'Stage 3 — Review'}
                      </Button>
                    )}
                    {['hq_review', 'proposal_submitted'].includes(row.status) && canHqReview && (
                      <Button size="small" startIcon={<GavelOutlinedIcon />} onClick={() => setHqReviewOpen(row.id)}>
                        HQ Review
                      </Button>
                    )}
                    {['proposal_draft', 'proposal_returned'].includes(row.status) && (
                      <Button size="small" startIcon={<EditNoteOutlinedIcon />} onClick={() => setStage1Open(row.id)}>
                        Stage 1
                      </Button>
                    )}
                    <Button size="small" variant="outlined" onClick={() => setDocOpen(row)}>Documents</Button>
                    <Button size="small" variant="contained" startIcon={<PlayArrowOutlinedIcon />} onClick={() => openWorkflow(row)}>Workflow</Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      {canInitiateAsEe
                        ? 'No DPR proposals yet — click Initiate Proposal above to start Stage 1 for your division.'
                        : 'No DPR proposals yet. Division EE initiates proposals from their division login.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfaceCard>

      <Box mt={2.5}>
        <SurfaceCard title="Workflow stages (1–10)">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Governance dashboard (stages 11–12) is covered by audit logs and platform monitoring.
          </Typography>
          <DprPipelineTracker activeStage={trackerStage} />
        </SurfaceCard>
      </Box>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
        <DprDialogHeader stage={1} title="Initiate DPR Proposal (Division EE)" busy={busy} />
        <DialogContent sx={dprDialogContentSx}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The system will generate a unique Project Proposal ID (e.g. DPRP-2025-26-KPG-0001).
            After creation, upload concept note, estimate, justification, survey data, and GIS boundaries before forwarding to HQ.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" required label="Scheme / Project Title" value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <BilingualRemarkField
                label="Scheme Justification"
                pdfTitle="Scheme Justification"
                pdfSubtitle={createForm.title.trim() || 'New DPR Proposal'}
                value={createSchemeJustification}
                onChange={setCreateSchemeJustification}
                minRows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" type="number" label="Preliminary Estimate (₹)"
                value={createForm.preliminaryEstimate} onChange={(e) => setCreateForm({ ...createForm, preliminaryEstimate: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Funding Source"
                value={createForm.fundingSource} onChange={(e) => setCreateForm({ ...createForm, fundingSource: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={dprDialogActionsSx}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={busy} startIcon={<AddOutlinedIcon />}>Create Proposal</Button>
        </DialogActions>
      </Dialog>

      <DprStage1InitiationPanel
        open={!!stage1Open}
        proposalId={stage1Open}
        onClose={() => setStage1Open(null)}
        onUpdated={load}
      />

      <DprHqReviewPanel
        open={!!hqReviewOpen}
        proposalId={hqReviewOpen}
        onClose={() => setHqReviewOpen(null)}
        onUpdated={load}
      />

      <DprStage3PreparationPanel
        open={!!stage3Open}
        proposalId={stage3Open}
        onClose={() => setStage3Open(null)}
        onUpdated={load}
        onSubmittedToTac={(id) => {
          setSuccess('DPR submitted to TAC for PDF manual review.');
          setTacReviewOpen(id);
        }}
      />

      <DprRevisionPanel
        open={!!revisionOpen}
        proposalId={revisionOpen}
        onClose={() => setRevisionOpen(null)}
        onUpdated={load}
        onResubmitted={(id) => {
          setSuccess('Revised DPR resubmitted to TAC for re-review.');
          setTacReviewOpen(id);
        }}
      />

      <DprTacReviewPanel
        open={!!tacReviewOpen}
        proposalId={tacReviewOpen}
        onClose={() => setTacReviewOpen(null)}
        onUpdated={load}
      />

      <DprSecretariatPanel
        open={!!secretariatOpen}
        proposalId={secretariatOpen}
        onClose={() => setSecretariatOpen(null)}
        onUpdated={() => {
          setSuccess('DPR forwarded to Secretariat / Sachiwalaya.');
          load();
        }}
      />

      <DprTacRound2Panel
        open={!!tacRound2Open}
        proposalId={tacRound2Open}
        onClose={() => setTacRound2Open(null)}
        onUpdated={load}
        onComplianceRequired={(id) => {
          setSuccess('Round 2 compliance required — DPR team must submit revised documents.');
          setRound2ComplianceOpen(id);
        }}
      />

      <DprRound2CompliancePanel
        open={!!round2ComplianceOpen}
        proposalId={round2ComplianceOpen}
        onClose={() => setRound2ComplianceOpen(null)}
        onUpdated={load}
        onResubmitted={(id) => {
          setSuccess('Round 2 compliance resubmitted to committee.');
          setTacRound2Open(id);
        }}
      />

      <DprSanctionPanel
        open={!!sanctionOpen}
        proposalId={sanctionOpen}
        onClose={() => setSanctionOpen(null)}
        onUpdated={() => {
          setSuccess('Administrative sanction recorded — Sanctioned & Budget Approved.');
          load();
        }}
      />

      <DprTenderInitiationPanel
        open={!!tenderInitOpen}
        proposalId={tenderInitOpen}
        onClose={() => setTenderInitOpen(null)}
        onUpdated={() => {
          setSuccess('Tender Preparation Task Order issued — tender prep initiated.');
          load();
        }}
      />

      <DprTenderProcessingPanel
        open={!!tenderProcessingOpen}
        proposalId={tenderProcessingOpen}
        onClose={() => setTenderProcessingOpen(null)}
        onUpdated={() => {
          setSuccess('Tender processing updated.');
          load();
        }}
      />

      <Dialog open={!!workflowOpen} onClose={() => setWorkflowOpen(null)} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
        <DprDialogHeader
          stage={workflowOpen?.currentStage ?? 1}
          title="Workflow action"
          proposalNo={workflowOpen?.proposalNo}
          statusLabel={workflowOpen?.statusLabel ?? workflowOpen?.status}
          busy={busy}
        />
        <DialogContent sx={dprDialogContentSx}>
          {workflowOpen && (
            <>
              <Box sx={{ mb: 2.5, p: 1.75, borderRadius: 2, bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>{workflowOpen.title}</Typography>
                <DprStageProgress currentStage={workflowOpen.currentStage} />
                <Box mt={1.5}>
                  <DprPipelineTracker activeStage={workflowOpen.currentStage} compact />
                </Box>
              </Box>
              <TextField
                select fullWidth size="small" label="Action" sx={{ mb: 2 }}
                value={advanceForm.action}
                onChange={(e) => setAdvanceForm({ ...advanceForm, action: e.target.value })}
                SelectProps={{ native: true }}
              >
                {(workflowOpen.allowedActions ?? ['submit']).map((a) => (
                  <option key={a} value={a}>{DPR_ACTION_LABELS[a] ?? a}</option>
                ))}
              </TextField>
              <Box sx={{ mb: 2 }}>
                <BilingualRemarkField
                  label="Comments / Observations"
                  pdfTitle="DPR Workflow Comments"
                  pdfSubtitle={workflowOpen.title}
                  pdfMeta={[
                    { label: 'Proposal No.', value: workflowOpen.proposalNo ?? '' },
                    { label: 'Action', value: advanceForm.action },
                  ]}
                  value={advanceComments}
                  onChange={setAdvanceComments}
                  minRows={2}
                />
              </Box>
              {advanceForm.action === 'forward_secretariat' && (
                <TextField fullWidth size="small" label="Secretariat Reference No." sx={{ mb: 2 }}
                  value={advanceForm.secretariatRef} onChange={(e) => setAdvanceForm({ ...advanceForm, secretariatRef: e.target.value })} />
              )}
              {advanceForm.action === 'record_sanction' && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Administrative Approval (AA) No."
                      value={advanceForm.administrativeApprovalNo} onChange={(e) => setAdvanceForm({ ...advanceForm, administrativeApprovalNo: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Expenditure Sanction (ES) No."
                      value={advanceForm.expenditureSanctionNo} onChange={(e) => setAdvanceForm({ ...advanceForm, expenditureSanctionNo: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" type="number" label="Sanctioned Amount (₹)"
                      value={advanceForm.sanctionedAmount} onChange={(e) => setAdvanceForm({ ...advanceForm, sanctionedAmount: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" type="date" label="Sanction Date" InputLabelProps={{ shrink: true }}
                      value={advanceForm.sanctionDate} onChange={(e) => setAdvanceForm({ ...advanceForm, sanctionDate: e.target.value })} />
                  </Grid>
                </Grid>
              )}
              {(advanceForm.action === 'initiate_tender' || advanceForm.action === 'publish_tender') && (
                <TextField fullWidth size="small" label={advanceForm.action === 'publish_tender' ? 'NIT Reference' : 'Task Order Reference'} sx={{ mt: 1 }}
                  value={advanceForm.action === 'publish_tender' ? advanceForm.nitRef : advanceForm.taskOrderRef}
                  onChange={(e) => setAdvanceForm({
                    ...advanceForm,
                    ...(advanceForm.action === 'publish_tender' ? { nitRef: e.target.value } : { taskOrderRef: e.target.value }),
                  })} />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={dprDialogActionsSx}>
          <Button onClick={() => setWorkflowOpen(null)}>Close</Button>
          <Button variant="contained" onClick={handleAdvance} disabled={busy} startIcon={<PlayArrowOutlinedIcon />}>Execute Action</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!docOpen} onClose={() => setDocOpen(null)} maxWidth="sm" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
        <DprDialogHeader
          stage={docOpen?.currentStage ?? 1}
          title="Upload versioned document"
          proposalNo={docOpen?.proposalNo}
          statusLabel={docOpen?.statusLabel ?? docOpen?.status}
          busy={busy}
        />
        <DialogContent sx={dprDialogContentSx}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField select fullWidth size="small" label="Document Type" value={docForm.documentType}
                onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value as typeof docForm.documentType })}
                SelectProps={{ native: true }}>
                {DPR_DOCUMENT_TYPES.map((d) => (
                  <option key={d.type} value={d.type}>{d.label}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="File Name" value={docForm.fileName}
                onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" required label="File URL / Path" value={docForm.fileUrl}
                onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <BilingualRemarkField
                label="Remarks"
                pdfTitle="DPR Document Upload Remarks"
                pdfSubtitle={docOpen?.proposalNo ? `Proposal ${docOpen.proposalNo}` : undefined}
                pdfMeta={[
                  { label: 'Document Type', value: docForm.documentType },
                  { label: 'File', value: docForm.fileName || docForm.fileUrl },
                ]}
                value={docRemarks}
                onChange={setDocRemarks}
                minRows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={dprDialogActionsSx}>
          <Button onClick={() => setDocOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleUploadDoc} disabled={busy}>Upload (versioned)</Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
