import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  LinearProgress, List, ListItem, ListItemText, TextField, Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_TAC_ROUND2_ACTION_LABELS } from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { hasBilingualContent, serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type EeComplianceAssignment = {
  assignedBy?: string | null;
  assignedAt?: string | null;
  message?: string | null;
  acknowledgedAt?: string | null;
  isPending?: boolean;
  canAssign?: boolean;
};

type Stage7Readiness = {
  canBeginCompliance?: boolean;
  canUploadCompliance?: boolean;
  canSubmitCompliance?: boolean;
  canAssignToEe?: boolean;
  hasCompletePdf?: boolean;
  hasRound2ComplianceDoc?: boolean;
  eeComplianceAssignment?: EeComplianceAssignment | null;
  pendingObservations?: Array<{
    action?: string;
    remarks?: string | null;
    complianceNotes?: string | null;
    at?: string;
  }>;
  latestTacRemarks?: string | null;
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  stage7Readiness?: Stage7Readiness | null;
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
  liaisonMode?: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onResubmitted?: (proposalId: string) => void;
}

export default function DprRound2CompliancePanel({ open, proposalId, liaisonMode = false, onClose, onUpdated, onResubmitted }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingCompliance, setUploadingCompliance] = useState(false);
  const [observationResponse, setObservationResponse] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [submitComments, setSubmitComments] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [assignMessage, setAssignMessage] = useState<BilingualText>(EMPTY_BILINGUAL);
  const pdfRef = useRef<HTMLInputElement>(null);
  const complianceRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      const res = await dprPlanningApi.getProposal(proposalId);
      setDetail(res.data as ProposalDetail);
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
      setObservationResponse(EMPTY_BILINGUAL);
      setSubmitComments(EMPTY_BILINGUAL);
      setAssignMessage(EMPTY_BILINGUAL);
    }
  }, [open, proposalId, load]);

  const readiness = detail?.stage7Readiness;
  const eeAssignment = readiness?.eeComplianceAssignment;
  const canAssignToEe = readiness?.canAssignToEe === true;
  const canBegin = readiness?.canBeginCompliance === true;
  const canUpload = readiness?.canUploadCompliance === true;
  const canSubmit = readiness?.canSubmitCompliance === true;
  const observations = readiness?.pendingObservations ?? [];

  const beginCompliance = async () => {
    if (!proposalId) return;
    setBusy(true);
    try {
      await dprPlanningApi.beginRound2Compliance(proposalId);
      await load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Failed to begin compliance submission'));
    } finally {
      setBusy(false);
    }
  };

  const assignToEe = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      const message = serializeBilingualText(assignMessage).trim() || undefined;
      await dprPlanningApi.assignRound2ComplianceToEe(proposalId, { message });
      await load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Failed to notify division EE'));
    } finally {
      setBusy(false);
    }
  };

  const uploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (pdfRef.current) pdfRef.current.value = '';
    if (!file || !proposalId) return;
    setUploadingPdf(true);
    try {
      await dprPlanningApi.uploadCompleteDprPdf(proposalId, file);
      await load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'PDF upload failed'));
    } finally {
      setUploadingPdf(false);
    }
  };

  const uploadComplianceDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (complianceRef.current) complianceRef.current.value = '';
    if (!file || !proposalId) return;
    setUploadingCompliance(true);
    try {
      await dprPlanningApi.uploadDocumentFile(proposalId, 'tac_round2_compliance', file);
      await load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Compliance document upload failed'));
    } finally {
      setUploadingCompliance(false);
    }
  };

  const submitCompliance = async () => {
    if (!proposalId) return;
    if (!hasBilingualContent(observationResponse)) {
      setError('Describe how committee observations and compliance requirements were addressed');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.submitRound2Compliance(proposalId, {
        observationResponse: serializeBilingualText(observationResponse).trim(),
        comments: serializeBilingualText(submitComments).trim() || undefined,
      });
      onUpdated();
      onClose();
      onResubmitted?.(proposalId);
    } catch (err) {
      setError(getApiError(err, 'Failed to submit Round 2 compliance'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={7}
        title={liaisonMode ? 'Stage 7 — Secretariat Liaison (read-only)' : 'Round 2 Compliance Submission'}
        proposalNo={detail?.proposalNo}
        statusLabel={detail?.statusLabel ?? detail?.status}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {liaisonMode && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Super Admin cannot upload compliance on behalf of the division. Review Secretariat requirements below,
            then use <strong>Assign to Division EE</strong> to send an in-app task with your liaison notes.
            The division EE will see a notification on DPR Planning and can open{' '}
            <strong>Stage 7 — Submit Round 2 Compliance</strong>.
          </Alert>
        )}
        {liaisonMode && eeAssignment?.assignedAt && (
          <Alert severity={eeAssignment.acknowledgedAt ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {eeAssignment.acknowledgedAt
              ? `Division EE acknowledged this task on ${new Date(eeAssignment.acknowledgedAt).toLocaleString('en-IN')}.`
              : `Assigned to division EE on ${new Date(eeAssignment.assignedAt).toLocaleString('en-IN')} — awaiting EE action.`}
            {eeAssignment.message && (
              <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{eeAssignment.message}</Typography>
            )}
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detail && (
          <>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{detail.title}</Typography>
            <Chip size="small" label={detail.statusLabel ?? detail.status} sx={{ mb: 2 }} />

            {(observations.length > 0 || readiness?.latestTacRemarks) && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Committee Observations &amp; Compliance Requirements
                </Typography>
                {readiness?.latestTacRemarks && (
                  <Alert severity="warning" sx={{ mb: 1 }}>{readiness.latestTacRemarks}</Alert>
                )}
                <List dense disablePadding sx={{ mb: 2 }}>
                  {observations.map((obs, idx) => (
                    <ListItem key={idx} disableGutters>
                      <ListItemText
                        primary={DPR_TAC_ROUND2_ACTION_LABELS[obs.action ?? ''] ?? obs.action ?? 'Committee note'}
                        secondary={`${obs.at ? new Date(obs.at).toLocaleString('en-IN') : ''}${obs.remarks ? ` — ${obs.remarks}` : ''}${obs.complianceNotes ? ` | Required: ${obs.complianceNotes}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip size="small" color={readiness?.hasCompletePdf ? 'success' : 'default'}
                icon={readiness?.hasCompletePdf ? <CheckCircleOutlineIcon /> : undefined}
                label="Complete DPR PDF" variant={readiness?.hasCompletePdf ? 'filled' : 'outlined'} />
              <Chip size="small" color={readiness?.hasRound2ComplianceDoc ? 'success' : 'default'}
                icon={readiness?.hasRound2ComplianceDoc ? <CheckCircleOutlineIcon /> : undefined}
                label="Round 2 Compliance Doc" variant={readiness?.hasRound2ComplianceDoc ? 'filled' : 'outlined'} />
            </Box>

            {!liaisonMode && eeAssignment?.isPending && (
              <Alert severity="warning" icon={<NotificationsActiveOutlinedIcon />} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700}>Super Admin assigned Round 2 compliance</Typography>
                {eeAssignment.message && (
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{eeAssignment.message}</Typography>
                )}
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Assigned {eeAssignment.assignedAt ? new Date(eeAssignment.assignedAt).toLocaleString('en-IN') : ''}.
                  Begin submission below when ready.
                </Typography>
              </Alert>
            )}

            {!liaisonMode && canBegin && (
              <Button variant="contained" startIcon={<PlayArrowOutlinedIcon />} sx={{ mb: 2 }}
                disabled={busy} onClick={beginCompliance}>
                Begin Compliance Submission
              </Button>
            )}

            {!liaisonMode && canUpload && (
              <>
                <input ref={pdfRef} type="file" accept=".pdf" hidden onChange={uploadPdf} />
                <input ref={complianceRef} type="file" hidden onChange={uploadComplianceDoc} />
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  <Button size="small" variant="outlined" startIcon={<CloudUploadOutlinedIcon />}
                    disabled={uploadingPdf} onClick={() => pdfRef.current?.click()}>
                    {uploadingPdf ? 'Uploading…' : 'Upload Revised DPR PDF'}
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<CloudUploadOutlinedIcon />}
                    disabled={uploadingCompliance} onClick={() => complianceRef.current?.click()}>
                    {uploadingCompliance ? 'Uploading…' : 'Upload Compliance Document'}
                  </Button>
                </Box>
              </>
            )}

            {!liaisonMode && canUpload && (
              <>
                <BilingualRemarkField
                  label="Compliance response — how observations were addressed"
                  pdfTitle="Round 2 Compliance Response"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={observationResponse}
                  onChange={setObservationResponse}
                  minRows={3}
                  required
                />
                <BilingualRemarkField
                  label="Additional comments"
                  pdfTitle="Round 2 Compliance Comments"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={submitComments}
                  onChange={setSubmitComments}
                  minRows={2}
                />
              </>
            )}
            {liaisonMode && canAssignToEe && (
              <>
                <BilingualRemarkField
                  label="Liaison message to division EE (optional)"
                  pdfTitle="Round 2 Compliance — EE Assignment"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={assignMessage}
                  onChange={setAssignMessage}
                  minRows={2}
                />
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<NotificationsActiveOutlinedIcon />}
                  sx={{ mb: 2 }}
                  disabled={busy}
                  onClick={assignToEe}
                >
                  {eeAssignment?.assignedAt && !eeAssignment.acknowledgedAt ? 'Re-notify Division EE' : 'Assign to Division EE'}
                </Button>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {!liaisonMode && canSubmit && (
          <Button variant="contained" startIcon={<SendOutlinedIcon />}
            disabled={busy || !hasBilingualContent(observationResponse) || !readiness?.hasCompletePdf}
            onClick={submitCompliance}>
            Resubmit to Round 2 Committee
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
