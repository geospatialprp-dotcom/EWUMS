import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  Divider, FormControlLabel, FormGroup, LinearProgress, List, ListItem, ListItemText,
  TextField, Typography,
} from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import DprPdfReviewViewer from './DprPdfReviewViewer';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { hasBilingualContent, parseBilingualText, serializeBilingualText, type BilingualText } from '../../utils/bilingualText';
import { useAuth } from '../../context/AuthContext';
import { DPR_STAGE_3_DOCUMENT_TYPES, DPR_TAC_ACTION_LABELS, DPR_TAC_ROUND1_CHECKLIST, getDprDisplayStatusLabel } from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';

type TacReviewState = {
  pending?: boolean;
  inTacStage?: boolean;
  canReview?: boolean;
  canForward?: boolean;
  viewMode?: 'forward' | 'review' | 'track' | 'read';
  trackingStatusLabel?: string | null;
  awaitingDivisionAction?: boolean;
  hasFeedback?: boolean;
  checklist?: Array<{ key: string; label: string; reviewed: boolean }>;
  allReviewed?: boolean;
  complianceNotes?: string | null;
  lastAction?: string | null;
  reviewedAt?: string | null;
  observations?: Array<{
    at: string;
    action: string;
    remarks?: string | null;
    complianceNotes?: string | null;
  }>;
};

type WorkflowEvent = {
  id: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  comments?: string | null;
  createdAt: string;
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  tacRound1Remarks?: string | null;
  tacReview?: TacReviewState;
  boqValidation?: { status?: string; summary?: { readyForTac?: boolean; message?: string } } | null;
  events?: WorkflowEvent[];
  documentSlots?: Array<{
    documentType: string;
    label: string;
    document: { id: string; fileName?: string | null } | null;
  }>;
};

type TacAction = 'approve' | 'suggest_corrections' | 'request_info' | 'return_revision';

const TAC_EVENT_LABELS: Record<string, string> = {
  submit_dpr: 'DPR Submitted',
  forward_tac: 'Forwarded to TAC Section',
  begin_revision: 'DPR Revision Started',
  resubmit_revised_dpr: 'Revised DPR Resubmitted to TAC',
  tac_approve: 'TAC Cleared – First Stage',
  tac_suggest_corrections: 'TAC — Corrections Suggested',
  tac_request_info: 'TAC — Additional Info Requested',
  tac_return_revision: 'TAC — Returned for Revision',
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

interface Props {
  open: boolean;
  proposalId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function DprTacReviewPanel({ open, proposalId, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<TacAction>('approve');
  const [remarks, setRemarks] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [complianceNotes, setComplianceNotes] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [checklist, setChecklist] = useState({
    technicalFeasibility: false,
    designStandards: false,
    hydraulicCalculations: false,
    costEstimates: false,
    boqQuantities: false,
    drawingsLayouts: false,
  });
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  const load = useCallback(() => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    dprPlanningApi.getProposal(proposalId)
      .then((res) => {
        const data = res.data as ProposalDetail;
        setDetail(data);
        const tac = data.tacReview;
        const existing = tac?.checklist ?? [];
        setChecklist({
          technicalFeasibility: existing.find((c) => c.key === 'technicalFeasibility')?.reviewed ?? false,
          designStandards: existing.find((c) => c.key === 'designStandards')?.reviewed ?? false,
          hydraulicCalculations: existing.find((c) => c.key === 'hydraulicCalculations')?.reviewed ?? false,
          costEstimates: existing.find((c) => c.key === 'costEstimates')?.reviewed ?? false,
          boqQuantities: existing.find((c) => c.key === 'boqQuantities')?.reviewed ?? false,
          drawingsLayouts: existing.find((c) => c.key === 'drawingsLayouts')?.reviewed ?? false,
        });
        setComplianceNotes(parseBilingualText(tac?.complianceNotes ?? ''));
        setRemarks(EMPTY_BILINGUAL);
        setAction('approve');
      })
      .catch((err) => setError(getApiError(err, 'Failed to load proposal')))
      .finally(() => setBusy(false));
  }, [proposalId]);

  useEffect(() => {
    if (open && proposalId) load();
    if (!open) {
      setDetail(null);
      setError('');
      setAction('approve');
    }
  }, [open, proposalId, load]);

  const tac = detail?.tacReview;
  const isCleared = detail?.status === 'tac_round1_cleared';
  const canForward = tac?.canForward === true;
  const canReview = tac?.canReview === true;
  const isTracking = tac?.viewMode === 'track';
  const displayStatus = detail
    ? getDprDisplayStatusLabel(detail.status, roles, detail.statusLabel ?? detail.status)
    : '';
  const allReviewed = DPR_TAC_ROUND1_CHECKLIST.every((item) => checklist[item.key as keyof typeof checklist]);
  const hasObservations = (tac?.observations?.length ?? 0) > 0;

  const slotMap = new Map((detail?.documentSlots ?? []).map((s) => [s.documentType, s]));
  const pdfDoc = slotMap.get('dpr_complete_pdf')?.document;
  const boqDoc = slotMap.get('boq_tac_excel')?.document;

  const download = async (docId: string, fileName: string) => {
    if (!proposalId) return;
    try {
      const blob = await dprPlanningApi.fetchDocumentFile(proposalId, docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed');
    }
  };

  const downloadComplianceReport = async () => {
    if (!proposalId || !detail) return;
    try {
      const blob = await dprPlanningApi.downloadTacComplianceReport(proposalId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TAC-Compliance-${detail.proposalNo.replace(/[^a-zA-Z0-9-_]/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download compliance report');
    }
  };

  const submitForward = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.forwardToTac(proposalId, { comments: serializeBilingualText(remarks).trim() || undefined });
      onUpdated();
      onClose();
    } catch (err) {
      setError(getApiError(err, 'Forward to TAC failed'));
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!proposalId) return;
    if (action !== 'approve' && !hasBilingualContent(remarks)) {
      setError('Workflow comments are required for this action');
      return;
    }
    if (action === 'approve' && !allReviewed) {
      setError('All TAC review checklist items must be confirmed before approval');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.reviewByTac(proposalId, {
        action,
        remarks: serializeBilingualText(remarks).trim() || undefined,
        complianceNotes: serializeBilingualText(complianceNotes).trim() || undefined,
        ...checklist,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(getApiError(err, 'TAC review action failed'));
    } finally {
      setBusy(false);
    }
  };

  const tacEvents = (detail?.events ?? []).filter((e) =>
    e.action.startsWith('tac_') || e.action === 'forward_tac' || e.action === 'submit_dpr',
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={4}
        title={isTracking && !canReview
          ? (tac?.awaitingDivisionAction ? 'TAC Feedback — Division' : 'TAC Status — Under Review')
          : 'TAC Review — First Round'}
        proposalNo={detail?.proposalNo}
        statusLabel={displayStatus || undefined}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detail && (
          <>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{detail.title}</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip
                size="small"
                label={displayStatus}
                color={isTracking && detail.status === 'tac_round1_review' ? 'info' : undefined}
              />
              {tac?.lastAction && (
                <Chip size="small" variant="outlined"
                  label={`Last: ${DPR_TAC_ACTION_LABELS[tac.lastAction] ?? tac.lastAction}`} />
              )}
            </Box>

            {isTracking && !canReview && detail.status === 'tac_round1_review' && !hasObservations && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Under Review</Typography>
                <Typography variant="body2">
                  Your DPR is with TAC for Round 1 review. You will be notified here when feedback or corrections are returned.
                </Typography>
              </Alert>
            )}

            {isTracking && tac?.awaitingDivisionAction && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">TAC feedback received — action required</Typography>
                <Typography variant="body2">
                  TAC has completed review with comments below. Use <strong>Stage 5 — Revise DPR</strong> to address observations and resubmit.
                </Typography>
              </Alert>
            )}

            {isCleared && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">TAC Cleared – First Stage</Typography>
                <Typography variant="body2">
                  Final reviewed DPR has been approved by TAC Round 1. Ready for Secretariat forwarding.
                </Typography>
              </Alert>
            )}

            {canForward && (
              <Alert severity="warning" icon={<ForwardToInboxOutlinedIcon />} sx={{ mb: 2 }}>
                Super Admin: Confirm BOQ auto-validation passed, then forward the completed DPR to TAC Section.
                {detail.boqValidation?.status === 'failed' && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    BOQ validation failed — division must fix Excel errors before forwarding.
                  </Typography>
                )}
              </Alert>
            )}

            {canReview && (
              <Alert severity="info" icon={<RateReviewOutlinedIcon />} sx={{ mb: 2 }}>
                Super Admin: Review the DPR PDF online, complete the checklist, and record the TAC decision.
              </Alert>
            )}

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              TAC Submission Package
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              {pdfDoc && canReview && (
                <Button size="small" variant="contained" color="error" startIcon={<RateReviewOutlinedIcon />}
                  onClick={() => setPdfViewerOpen(true)}>
                  Review PDF Online
                </Button>
              )}
              {pdfDoc && isTracking && !canReview && (
                <Button size="small" variant="outlined" color="error" startIcon={<RateReviewOutlinedIcon />}
                  onClick={() => setPdfViewerOpen(true)}>
                  View PDF Markup &amp; Comments
                </Button>
              )}
              {pdfDoc && (
                <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
                  onClick={() => download(pdfDoc.id, pdfDoc.fileName ?? 'dpr-complete.pdf')}>
                  Download DPR PDF
                </Button>
              )}
              {boqDoc && (
                <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
                  onClick={() => download(boqDoc.id, boqDoc.fileName ?? 'boq-tac.xlsx')}>
                  BOQ Excel (reference)
                </Button>
              )}
              {detail.boqValidation && (
                <Chip size="small"
                  color={detail.boqValidation.status === 'passed' ? 'success' : detail.boqValidation.status === 'warning' ? 'warning' : 'error'}
                  label={`BOQ check: ${detail.boqValidation.status?.toUpperCase() ?? '—'}`} />
              )}
              <Button size="small" variant="outlined" startIcon={<DescriptionOutlinedIcon />}
                onClick={downloadComplianceReport}>
                Download Compliance Report
              </Button>
            </Box>

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Stage 3 Deliverables
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              {DPR_STAGE_3_DOCUMENT_TYPES.map((def) => {
                const doc = slotMap.get(def.type)?.document;
                if (!doc) return null;
                return (
                  <Button key={def.type} size="small" variant="text" startIcon={<DownloadOutlinedIcon />}
                    onClick={() => download(doc.id, doc.fileName ?? def.type)}>
                    {def.label}
                  </Button>
                );
              })}
            </Box>

            {canForward && (
              <Box sx={{ mb: 2 }}>
                <BilingualRemarkField
                  label="Forwarding comments (optional)"
                  pdfTitle="DPR TAC Forwarding Comments"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={remarks}
                  onChange={setRemarks}
                  minRows={2}
                />
              </Box>
            )}

            {(canReview || (isTracking && (tac?.checklist?.some((c) => c.reviewed) || tac?.observations?.length))) && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  TAC Technical Review Checklist
                </Typography>
                {canReview ? (
                  <FormGroup sx={{ mb: 2 }}>
                    {DPR_TAC_ROUND1_CHECKLIST.map((item) => (
                      <FormControlLabel
                        key={item.key}
                        control={(
                          <Checkbox
                            checked={checklist[item.key as keyof typeof checklist]}
                            onChange={(e) => setChecklist({ ...checklist, [item.key]: e.target.checked })}
                          />
                        )}
                        label={item.label}
                      />
                    ))}
                  </FormGroup>
                ) : (
                  <Box sx={{ mb: 2 }}>
                    {DPR_TAC_ROUND1_CHECKLIST.map((item) => {
                      const reviewed = tac?.checklist?.find((c) => c.key === item.key)?.reviewed;
                      return (
                        <Chip key={item.key} size="small" sx={{ mr: 0.5, mb: 0.5 }}
                          color={reviewed ? 'success' : 'default'}
                          variant={reviewed ? 'filled' : 'outlined'}
                          label={item.label} />
                      );
                    })}
                  </Box>
                )}
              </>
            )}

            {canReview && (
              <>
                <TextField
                  select fullWidth size="small" label="TAC Action" sx={{ mb: 2 }}
                  value={action}
                  onChange={(e) => setAction(e.target.value as TacAction)}
                  SelectProps={{ native: true }}
                >
                  <option value="approve">{DPR_TAC_ACTION_LABELS.approve}</option>
                  <option value="suggest_corrections">{DPR_TAC_ACTION_LABELS.suggest_corrections}</option>
                  <option value="request_info">{DPR_TAC_ACTION_LABELS.request_info}</option>
                  <option value="return_revision">{DPR_TAC_ACTION_LABELS.return_revision}</option>
                </TextField>

                <Box sx={{ mb: 2 }}>
                  <BilingualRemarkField
                    label="Workflow Comments / Observations"
                    pdfTitle="DPR TAC Workflow Comments"
                    pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                    pdfMeta={[{ label: 'TAC Action', value: action }]}
                    value={remarks}
                    onChange={setRemarks}
                    minRows={3}
                    helperText={action === 'approve' ? 'Optional for approval' : 'Required — tracked in workflow history'}
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <BilingualRemarkField
                    label="Compliance Report Notes"
                    pdfTitle="DPR TAC Compliance Notes"
                    pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                    value={complianceNotes}
                    onChange={setComplianceNotes}
                    minRows={2}
                    helperText="Recorded in compliance report and observation log"
                  />
                </Box>
              </>
            )}

            {!canReview && detail.tacRound1Remarks && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">TAC Remarks</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{detail.tacRound1Remarks}</Typography>
              </Alert>
            )}

            {tac?.complianceNotes && !canReview && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Compliance Notes</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{tac.complianceNotes}</Typography>
              </Alert>
            )}

            {(tacEvents.length > 0 || hasObservations) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  <HistoryOutlinedIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                  {isTracking && !canReview ? 'TAC Comments & Observations' : 'Workflow Comments & Observations'}
                </Typography>
                <List dense disablePadding>
                  {tacEvents.map((ev) => (
                    <ListItem key={ev.id} disableGutters>
                      <ListItemText
                        primary={TAC_EVENT_LABELS[ev.action] ?? ev.action}
                        secondary={`${new Date(ev.createdAt).toLocaleString('en-IN')} — ${ev.comments ?? '—'}`}
                      />
                    </ListItem>
                  ))}
                  {(tac?.observations ?? []).map((obs, idx) => (
                    <ListItem key={`obs-${idx}`} disableGutters>
                      <ListItemText
                        primary={DPR_TAC_ACTION_LABELS[obs.action] ?? obs.action}
                        secondary={`${new Date(obs.at).toLocaleString('en-IN')} — ${obs.remarks ?? '—'}${obs.complianceNotes ? ` | Compliance: ${obs.complianceNotes}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canForward && (
          <Button variant="contained" startIcon={<ForwardToInboxOutlinedIcon />}
            disabled={busy || detail?.boqValidation?.status === 'failed'} onClick={submitForward}>
            Forward to TAC Section
          </Button>
        )}
        {canReview && (
          <Button variant="contained" color={action === 'approve' ? 'success' : 'primary'}
            disabled={busy} onClick={submitReview}>
            {DPR_TAC_ACTION_LABELS[action]}
          </Button>
        )}
      </DialogActions>
      {proposalId && pdfDoc && (
        <DprPdfReviewViewer
          open={pdfViewerOpen}
          proposalId={proposalId}
          documentId={pdfDoc.id}
          fileName={pdfDoc.fileName ?? 'dpr-complete.pdf'}
          readOnly={!canReview}
          onClose={() => setPdfViewerOpen(false)}
        />
      )}
    </Dialog>
  );
}
