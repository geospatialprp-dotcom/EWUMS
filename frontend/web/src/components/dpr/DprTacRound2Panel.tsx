import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  Divider, FormControlLabel, FormGroup, LinearProgress, List, ListItem, ListItemText,
  TextField, Typography,
} from '@mui/material';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_TAC_ROUND2_ACTION_LABELS, DPR_TAC_ROUND2_CHECKLIST } from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import DprPdfReviewViewer from './DprPdfReviewViewer';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { hasBilingualContent, parseBilingualText, serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type TacRound2State = {
  pending?: boolean;
  inRound2Stage?: boolean;
  canBeginExamination?: boolean;
  canReview?: boolean;
  concurrenceGranted?: boolean;
  concurrenceGrantedAt?: string | null;
  examination?: {
    committeeRef?: string | null;
    examiningAuthority?: string | null;
    startedAt?: string | null;
    comments?: string | null;
  } | null;
  viewMode?: 'initiate' | 'review' | 'track' | 'read';
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
  complianceResponses?: Array<{
    at?: string;
    observationResponse?: string | null;
    comments?: string | null;
  }>;
  officialTac1Dpr?: {
    documentId: string;
    versionNo?: number | null;
    fileName?: string | null;
    label?: string;
    isOfficial?: boolean;
    frozenAt?: string | null;
  } | null;
  officialTac1Missing?: boolean;
  examinationDocumentMode?: 'tac1_official' | 'ee_compliance_resubmit';
  eeComplianceDpr?: {
    documentId: string;
    fileName?: string | null;
    label?: string;
  } | null;
  eeComplianceDoc?: {
    documentId: string;
    fileName?: string | null;
    label?: string;
  } | null;
  eeCompliancePackageMissing?: boolean;
  canViewRound2Details?: boolean;
  resultsPublished?: boolean;
  awaitingAdminLiaison?: boolean;
  trackingStatusLabel?: string | null;
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  tacRound2Remarks?: string | null;
  tacRound2Review?: TacRound2State;
  preliminaryEstimate?: number | null;
  fundingSource?: string | null;
  documentSlots?: Array<{
    documentType: string;
    label: string;
    document: { id: string; fileName?: string | null } | null;
  }>;
};

type Round2Action = 'approve' | 'suggest_corrections' | 'request_info' | 'return_revision';

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function formatInr(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

interface Props {
  open: boolean;
  proposalId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  onComplianceRequired?: (proposalId: string) => void;
  onOpenCompliance?: (proposalId: string) => void;
}

export default function DprTacRound2Panel({ open, proposalId, onClose, onUpdated, onComplianceRequired, onOpenCompliance }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Round2Action>('approve');
  const [remarks, setRemarks] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [complianceNotes, setComplianceNotes] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [committeeRef, setCommitteeRef] = useState('');
  const [examiningAuthority, setExaminingAuthority] = useState('Secretariat / Govt TAC Committee');
  const [initComments, setInitComments] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [checklist, setChecklist] = useState({
    technicalExamination: false,
    financialExamination: false,
    costEstimateScrutiny: false,
    budgetFundProvisioning: false,
    boqFinancialCompliance: false,
    designStandardsCompliance: false,
    envSocialClearances: false,
    fundingRequirements: false,
  });
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [compliancePdfViewerOpen, setCompliancePdfViewerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      const res = await dprPlanningApi.getProposal(proposalId);
      const data = res.data as ProposalDetail;
      setDetail(data);
      const tac2 = data.tacRound2Review;
      const existing = tac2?.checklist ?? [];
      setChecklist({
        technicalExamination: existing.find((c) => c.key === 'technicalExamination')?.reviewed ?? false,
        financialExamination: existing.find((c) => c.key === 'financialExamination')?.reviewed ?? false,
        costEstimateScrutiny: existing.find((c) => c.key === 'costEstimateScrutiny')?.reviewed ?? false,
        budgetFundProvisioning: existing.find((c) => c.key === 'budgetFundProvisioning')?.reviewed ?? false,
        boqFinancialCompliance: existing.find((c) => c.key === 'boqFinancialCompliance')?.reviewed ?? false,
        designStandardsCompliance: existing.find((c) => c.key === 'designStandardsCompliance')?.reviewed ?? false,
        envSocialClearances: existing.find((c) => c.key === 'envSocialClearances')?.reviewed ?? false,
        fundingRequirements: existing.find((c) => c.key === 'fundingRequirements')?.reviewed ?? false,
      });
      setComplianceNotes(parseBilingualText(tac2?.complianceNotes ?? ''));
      setRemarks(EMPTY_BILINGUAL);
      setAction('approve');
    } catch (err) {
      setError(getApiError(err, 'Failed to load proposal'));
    } finally {
      setBusy(false);
    }
  }, [proposalId]);

  useEffect(() => {
    if (open && proposalId) load();
    if (!open) {
      setDetail(null);
      setError('');
      setCommitteeRef('');
      setExaminingAuthority('Secretariat / Govt TAC Committee');
      setInitComments(EMPTY_BILINGUAL);
    }
  }, [open, proposalId, load]);

  const tac2 = detail?.tacRound2Review;
  const canBegin = tac2?.canBeginExamination === true;
  const canReview = tac2?.canReview === true;
  const canViewDetails = tac2?.canViewRound2Details !== false;
  const isTracking = tac2?.viewMode === 'track';
  const needsRound2Compliance = ['tac_round2_corrections_required', 'tac_round2_compliance'].includes(detail?.status ?? '');
  const eeCompliancePending = detail?.status === 'tac_round2_compliance_submitted';
  const useEeComplianceDocs = tac2?.examinationDocumentMode === 'ee_compliance_resubmit';
  const concurrenceGranted = tac2?.concurrenceGranted === true || detail?.status === 'govt_technical_concurrence';
  const allReviewed = DPR_TAC_ROUND2_CHECKLIST.every((item) => checklist[item.key as keyof typeof checklist]);

  const officialPdf = tac2?.officialTac1Dpr ?? null;
  const officialTac1Missing = tac2?.officialTac1Missing === true || !officialPdf?.isOfficial;
  const eeDpr = tac2?.eeComplianceDpr ?? null;
  const eeComplianceDoc = tac2?.eeComplianceDoc ?? null;
  const eePackageMissing = tac2?.eeCompliancePackageMissing === true;
  const pdfDoc = useEeComplianceDocs && eeDpr?.documentId
    ? { id: eeDpr.documentId, fileName: eeDpr.fileName ?? 'dpr-revised.pdf' }
    : officialPdf?.documentId && officialPdf.isOfficial !== false
      ? { id: officialPdf.documentId, fileName: officialPdf.fileName ?? 'dpr-complete.pdf' }
      : null;
  const showTac1Actions = !useEeComplianceDocs && !needsRound2Compliance && !eeCompliancePending;

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

  const downloadReport = async () => {
    if (!proposalId || !detail) return;
    try {
      const blob = await dprPlanningApi.downloadTacRound2Report(proposalId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TAC-Round2-${detail.proposalNo.replace(/[^a-zA-Z0-9-_]/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download examination report');
    }
  };

  const submitBeginExamination = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.beginTacRound2Examination(proposalId, {
        committeeRef: committeeRef.trim() || undefined,
        examiningAuthority: examiningAuthority.trim() || undefined,
        comments: serializeBilingualText(initComments).trim() || undefined,
      });
      onUpdated();
      await load();
    } catch (err) {
      setError(getApiError(err, 'Failed to begin Round 2 examination'));
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
      setError('All examination checklist items must be confirmed before granting concurrence');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.reviewByTacRound2(proposalId, {
        action,
        remarks: serializeBilingualText(remarks).trim() || undefined,
        complianceNotes: serializeBilingualText(complianceNotes).trim() || undefined,
        ...checklist,
      });
      onUpdated();
      if (['suggest_corrections', 'return_revision'].includes(action)) {
        onComplianceRequired?.(proposalId);
      }
      onClose();
    } catch (err) {
      setError(getApiError(err, 'Round 2 review action failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={7}
        title="Second Round TAC / Govt Technical Examination"
        proposalNo={detail?.proposalNo}
        statusLabel={detail?.statusLabel ?? detail?.status}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detail && (
          <>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{detail.title}</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip size="small" label={detail.statusLabel ?? detail.status} />
              {tac2?.lastAction && (
                <Chip size="small" variant="outlined"
                  label={`Last: ${DPR_TAC_ROUND2_ACTION_LABELS[tac2.lastAction] ?? tac2.lastAction}`} />
              )}
            </Box>

            {concurrenceGranted && (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Government Technical Concurrence Obtained</Typography>
                <Typography variant="body2">
                  Round 2 examination complete. Results are visible to Super Admin and Division EE.
                  Proceed to Administrative Sanction (Stage 8).
                </Typography>
                {tac2?.concurrenceGrantedAt && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Concurrence: {new Date(tac2.concurrenceGrantedAt).toLocaleString('en-IN')}
                  </Typography>
                )}
              </Alert>
            )}

            {canReview && useEeComplianceDocs && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Re-examining <strong>Division EE compliance submission</strong> — use the revised Complete DPR PDF
                  and compliance document below. The frozen TAC Round 1 PDF is not used for this step.
                </Typography>
              </Alert>
            )}

            {canReview && !useEeComplianceDocs && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  You may review only the <strong>TAC Round 1 official DPR</strong> — the same PDF Super Admin
                  checked and cleared at Stage 4. Later division uploads are not used for Secretariat examination.
                  For queries, contact <strong>Super Admin</strong> only.
                </Typography>
              </Alert>
            )}

            {isTracking && tac2?.awaitingAdminLiaison && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Secretariat examination in progress</Typography>
                <Typography variant="body2">
                  Secretariat communicates with Super Admin only during Round 2. Division will see the outcome after Govt Technical Concurrence.
                </Typography>
              </Alert>
            )}

            {isTracking && needsRound2Compliance && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700}>Action required — Round 2 compliance</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Secretariat returned the DPR for compliance (see &quot;Last&quot; chip above). Close this tracker and use{' '}
                  <strong>Stage 7 — Submit Round 2 Compliance</strong> on the proposal row to upload revised documents.
                </Typography>
                {proposalId && onOpenCompliance && (
                  <Button size="small" variant="contained" color="warning" onClick={() => {
                    onClose();
                    onOpenCompliance(proposalId);
                  }}>
                    Open compliance submission
                  </Button>
                )}
              </Alert>
            )}

            {isTracking && !needsRound2Compliance && !canViewDetails && !concurrenceGranted && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  DPR is under Secretariat / Govt examination. Detailed observations will appear here after concurrence is granted.
                </Typography>
              </Alert>
            )}

            {tac2?.examination?.startedAt && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Examination commenced
                {tac2.examination.examiningAuthority ? ` — ${tac2.examination.examiningAuthority}` : ''}
                {tac2.examination.committeeRef ? ` (Ref: ${tac2.examination.committeeRef})` : ''}
                <Typography variant="caption" display="block">
                  {new Date(tac2.examination.startedAt).toLocaleString('en-IN')}
                </Typography>
              </Alert>
            )}

            <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
              <Chip label={`Estimate: ${formatInr(detail.preliminaryEstimate)}`} variant="outlined" />
              <Chip label={`Funding: ${detail.fundingSource ?? 'Not specified'}`} variant="outlined" />
            </Box>

            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              {showTac1Actions && pdfDoc && proposalId && (
                <>
                  <Button size="small" variant="contained" color="error" startIcon={<RateReviewOutlinedIcon />}
                    onClick={() => setPdfViewerOpen(true)}>
                    Review TAC1 Official DPR Online
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
                    onClick={() => download(pdfDoc.id, pdfDoc.fileName ?? 'dpr-complete.pdf')}>
                    {officialPdf?.label ?? 'TAC1 Official DPR PDF'}
                  </Button>
                </>
              )}
              {useEeComplianceDocs && eeDpr && proposalId && (
                <>
                  <Button size="small" variant="contained" color="warning" startIcon={<RateReviewOutlinedIcon />}
                    onClick={() => setPdfViewerOpen(true)}>
                    Review EE Revised DPR Online
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
                    onClick={() => download(eeDpr.documentId, eeDpr.fileName ?? 'dpr-revised.pdf')}>
                    {eeDpr.label ?? 'EE Revised DPR PDF'}
                  </Button>
                </>
              )}
              {useEeComplianceDocs && eeComplianceDoc && proposalId && (
                <>
                  <Button size="small" variant="contained" color="primary" startIcon={<RateReviewOutlinedIcon />}
                    onClick={() => setCompliancePdfViewerOpen(true)}>
                    Review EE Compliance Doc Online
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
                    onClick={() => download(eeComplianceDoc.documentId, eeComplianceDoc.fileName ?? 'round2-compliance.pdf')}>
                    {eeComplianceDoc.label ?? 'Compliance Document'}
                  </Button>
                </>
              )}
              {showTac1Actions && !pdfDoc && (canReview || canBegin) && officialTac1Missing && (
                <Alert severity="error" sx={{ width: '100%' }}>
                  <strong>TAC Round 1 official DPR is not frozen.</strong> Secretariat cannot examine until Super Admin
                  completes TAC Round 1 approval on the current system (or the VPS freeze script is run for this proposal).
                  Only the TAC1-checked PDF may be used — not the latest Complete DPR upload.
                </Alert>
              )}
              {useEeComplianceDocs && eePackageMissing && (canReview || isTracking) && (
                <Alert severity="error" sx={{ width: '100%' }}>
                  Division EE compliance package is incomplete. Super Admin must forward the revised DPR and compliance document before Secretariat re-examination.
                </Alert>
              )}
              <Button size="small" variant="outlined" startIcon={<DescriptionOutlinedIcon />} onClick={downloadReport}>
                Download Examination Report
              </Button>
            </Box>

            {(tac2?.observations?.length ?? 0) > 0 && canViewDetails && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Observations &amp; Recommendations
                </Typography>
                <List dense disablePadding sx={{ mb: 2 }}>
                  {tac2!.observations!.map((obs, idx) => (
                    <ListItem key={idx} disableGutters>
                      <ListItemText
                        primary={DPR_TAC_ROUND2_ACTION_LABELS[obs.action] ?? obs.action}
                        secondary={`${obs.at ? new Date(obs.at).toLocaleString('en-IN') : ''}${obs.remarks ? ` — ${obs.remarks}` : ''}${obs.complianceNotes ? ` | Requirements: ${obs.complianceNotes}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {(tac2?.complianceResponses?.length ?? 0) > 0 && canViewDetails && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  DPR Team Compliance Submissions
                </Typography>
                <List dense disablePadding sx={{ mb: 2 }}>
                  {tac2!.complianceResponses!.map((r, idx) => (
                    <ListItem key={idx} disableGutters>
                      <ListItemText
                        primary={r.observationResponse ?? 'Compliance response'}
                        secondary={`${r.at ? new Date(r.at).toLocaleString('en-IN') : ''}${r.comments ? ` — ${r.comments}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {canBegin && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Begin Round 2 Examination</Typography>
                <TextField fullWidth size="small" label="Committee / File Reference" sx={{ mb: 2 }}
                  value={committeeRef} onChange={(e) => setCommitteeRef(e.target.value)} />
                <TextField fullWidth size="small" label="Examining Authority" sx={{ mb: 2 }}
                  value={examiningAuthority} onChange={(e) => setExaminingAuthority(e.target.value)} />
                <BilingualRemarkField
                  label="Examination notes"
                  pdfTitle="TAC Round 2 Examination Notes"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={initComments}
                  onChange={setInitComments}
                  minRows={2}
                />
              </>
            )}

            {canReview && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Technical &amp; Financial Examination Checklist
                </Typography>
                <FormGroup sx={{ mb: 2 }}>
                  {DPR_TAC_ROUND2_CHECKLIST.map((item) => (
                    <FormControlLabel
                      key={item.key}
                      control={
                        <Checkbox
                          checked={checklist[item.key as keyof typeof checklist]}
                          onChange={(e) => setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                        />
                      }
                      label={item.label}
                    />
                  ))}
                </FormGroup>

                <TextField select fullWidth size="small" label="Committee Action" sx={{ mb: 2 }}
                  value={action} onChange={(e) => setAction(e.target.value as Round2Action)}
                  SelectProps={{ native: true }}>
                  {Object.entries(DPR_TAC_ROUND2_ACTION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </TextField>
                <BilingualRemarkField
                  label={action === 'approve' ? 'Concurrence remarks' : 'Observations / remarks'}
                  pdfTitle="TAC Round 2 Committee Remarks"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={remarks}
                  onChange={setRemarks}
                  minRows={2}
                  required={action !== 'approve'}
                />
                <BilingualRemarkField
                  label="Compliance requirements (liaison to Super Admin)"
                  pdfTitle="TAC Round 2 Compliance Requirements"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={complianceNotes}
                  onChange={setComplianceNotes}
                  minRows={2}
                  helperText="Super Admin coordinates with Division; Division sees results after concurrence"
                />
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canBegin && (
          <Button variant="contained" startIcon={<GavelOutlinedIcon />}
            disabled={busy || officialTac1Missing} onClick={submitBeginExamination}>
            Begin Round 2 Examination
          </Button>
        )}
        {canReview && (
          <Button variant="contained" startIcon={<GavelOutlinedIcon />}
            disabled={busy || (useEeComplianceDocs ? eePackageMissing : officialTac1Missing) || (action === 'approve' && !allReviewed)} onClick={submitReview}>
            {action === 'approve' ? 'Grant Govt Technical Concurrence' : 'Submit Committee Action'}
          </Button>
        )}
      </DialogActions>
      {proposalId && pdfDoc && (
        <DprPdfReviewViewer
          open={pdfViewerOpen}
          proposalId={proposalId}
          documentId={pdfDoc.id}
          fileName={useEeComplianceDocs ? (eeDpr?.label ?? pdfDoc.fileName) : (officialPdf?.label ?? pdfDoc.fileName)}
          readOnly={!canReview}
          onClose={() => setPdfViewerOpen(false)}
        />
      )}
      {proposalId && eeComplianceDoc && (
        <DprPdfReviewViewer
          open={compliancePdfViewerOpen}
          proposalId={proposalId}
          documentId={eeComplianceDoc.documentId}
          fileName={eeComplianceDoc.label ?? eeComplianceDoc.fileName ?? 'round2-compliance.pdf'}
          readOnly={!canReview}
          onClose={() => setCompliancePdfViewerOpen(false)}
        />
      )}
    </Dialog>
  );
}
