import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, List, ListItem, ListItemText, Typography,
} from '@mui/material';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_TAC_ROUND2_ACTION_LABELS } from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import DprPdfReviewViewer from './DprPdfReviewViewer';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { hasBilingualContent, serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type Stage7Readiness = {
  canReviewComplianceAdmin?: boolean;
  canForwardComplianceToSecretariat?: boolean;
  hasCompletePdf?: boolean;
  hasRound2ComplianceDoc?: boolean;
  pendingObservations?: Array<{
    action?: string;
    remarks?: string | null;
    complianceNotes?: string | null;
    at?: string;
  }>;
  complianceResponses?: Array<{
    at?: string;
    observationResponse?: string | null;
    comments?: string | null;
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
  documentSlots?: Array<{
    documentType: string;
    label: string;
    document: { id: string; fileName?: string | null } | null;
  }>;
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
  onForwarded?: (proposalId: string) => void;
}

export default function DprRound2ComplianceAdminPanel({ open, proposalId, onClose, onUpdated, onForwarded }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remarks, setRemarks] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [dprPdfOpen, setDprPdfOpen] = useState(false);
  const [compliancePdfOpen, setCompliancePdfOpen] = useState(false);

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
      setRemarks(EMPTY_BILINGUAL);
    }
  }, [open, proposalId, load]);

  const readiness = detail?.stage7Readiness;
  const canReview = readiness?.canReviewComplianceAdmin === true;
  const observations = readiness?.pendingObservations ?? [];
  const responses = readiness?.complianceResponses ?? [];
  const latestResponse = responses.length ? responses[responses.length - 1] : null;

  const dprPdf = detail?.documentSlots?.find((s) => s.documentType === 'dpr_complete_pdf')?.document ?? null;
  const compliancePdf = detail?.documentSlots?.find((s) => s.documentType === 'tac_round2_compliance')?.document ?? null;

  const submitReview = async (action: 'forward_secretariat' | 'return_to_ee') => {
    if (!proposalId) return;
    if (action === 'return_to_ee' && !hasBilingualContent(remarks)) {
      setError('Remarks are required when returning compliance to division EE');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.reviewRound2ComplianceByAdmin(proposalId, {
        action,
        remarks: serializeBilingualText(remarks).trim() || undefined,
      });
      onUpdated();
      onClose();
      if (action === 'forward_secretariat') onForwarded?.(proposalId);
    } catch (err) {
      setError(getApiError(err, 'Admin compliance review failed'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={7}
        title="Stage 7 — Review EE Compliance (Super Admin)"
        proposalNo={detail?.proposalNo}
        statusLabel={detail?.statusLabel ?? detail?.status}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detail && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Review the revised DPR PDF and compliance document <strong>online</strong> before forwarding to Secretariat.
              Secretariat will re-examine only after you forward.
            </Alert>

            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{detail.title}</Typography>
            <Chip size="small" label={detail.statusLabel ?? detail.status} sx={{ mb: 2 }} />

            {latestResponse?.observationResponse && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700}>EE compliance response</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
                  {latestResponse.observationResponse}
                </Typography>
                {latestResponse.comments && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Comments: {latestResponse.comments}
                  </Typography>
                )}
              </Alert>
            )}

            {(observations.length > 0 || readiness?.latestTacRemarks) && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Original Secretariat requirements
                </Typography>
                {readiness?.latestTacRemarks && (
                  <Alert severity="info" sx={{ mb: 1 }}>{readiness.latestTacRemarks}</Alert>
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
              {dprPdf && proposalId && (
                <Button size="small" variant="contained" color="error" startIcon={<RateReviewOutlinedIcon />}
                  onClick={() => setDprPdfOpen(true)}>
                  Review Revised DPR PDF Online
                </Button>
              )}
              {compliancePdf && proposalId && (
                <Button size="small" variant="contained" color="primary" startIcon={<RateReviewOutlinedIcon />}
                  onClick={() => setCompliancePdfOpen(true)}>
                  Review Compliance Document Online
                </Button>
              )}
              {!dprPdf && <Chip size="small" color="error" label="Revised DPR PDF missing" />}
              {!compliancePdf && <Chip size="small" color="error" label="Compliance document missing" />}
            </Box>

            {canReview && (
              <BilingualRemarkField
                label="Liaison remarks (required if returning to EE)"
                pdfTitle="Round 2 Compliance — Super Admin Review"
                pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                value={remarks}
                onChange={setRemarks}
                minRows={2}
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canReview && (
          <>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<UndoOutlinedIcon />}
              disabled={busy || !dprPdf || !compliancePdf}
              onClick={() => submitReview('return_to_ee')}
            >
              Return to Division EE
            </Button>
            <Button
              variant="contained"
              startIcon={<ForwardToInboxOutlinedIcon />}
              disabled={busy || !dprPdf || !compliancePdf}
              onClick={() => submitReview('forward_secretariat')}
            >
              Forward to Secretariat
            </Button>
          </>
        )}
      </DialogActions>

      {proposalId && dprPdf && (
        <DprPdfReviewViewer
          open={dprPdfOpen}
          proposalId={proposalId}
          documentId={dprPdf.id}
          fileName={dprPdf.fileName ?? 'dpr-revised.pdf'}
          onClose={() => setDprPdfOpen(false)}
        />
      )}
      {proposalId && compliancePdf && (
        <DprPdfReviewViewer
          open={compliancePdfOpen}
          proposalId={proposalId}
          documentId={compliancePdf.id}
          fileName={compliancePdf.fileName ?? 'round2-compliance.pdf'}
          onClose={() => setCompliancePdfOpen(false)}
        />
      )}
    </Dialog>
  );
}
