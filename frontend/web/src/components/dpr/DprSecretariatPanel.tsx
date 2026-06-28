import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  Divider, LinearProgress, List, ListItem, ListItemText, MenuItem, TextField, Typography,
} from '@mui/material';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_TAC_ACTION_LABELS } from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

const RECEIVING_AUTHORITIES = [
  'Government Secretariat (Sachiwalaya)',
  'Finance Department — Sachiwalaya',
  'Planning Department — Sachiwalaya',
  'Uttarakhand Jal Sansthan — HQ Secretariat',
  'Other (specify in comments)',
];

type Attachment = { key: string; label: string; required: boolean; attached: boolean };

type Stage6Readiness = {
  canForward?: boolean;
  canTrack?: boolean;
  forwarded?: boolean;
  secretariatRef?: string | null;
  secretariatForwardedAt?: string | null;
  receivingAuthority?: string | null;
  submissionComments?: string | null;
  fundingRequirementNotes?: string | null;
  preliminaryEstimate?: number | null;
  fundingSource?: string | null;
  attachments?: Attachment[];
  missingAttachments?: string[];
  tacRecommendations?: Array<{
    action?: string;
    remarks?: string | null;
    complianceNotes?: string | null;
    at?: string;
  }>;
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  stage6Readiness?: Stage6Readiness | null;
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

function formatInr(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

interface Props {
  open: boolean;
  proposalId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function DprSecretariatPanel({ open, proposalId, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [secretariatRef, setSecretariatRef] = useState('');
  const [receivingAuthority, setReceivingAuthority] = useState(RECEIVING_AUTHORITIES[0]);
  const [comments, setComments] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [fundingNotes, setFundingNotes] = useState<BilingualText>(EMPTY_BILINGUAL);

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
      setSecretariatRef('');
      setReceivingAuthority(RECEIVING_AUTHORITIES[0]);
      setComments(EMPTY_BILINGUAL);
      setFundingNotes(EMPTY_BILINGUAL);
    }
  }, [open, proposalId, load]);

  const readiness = detail?.stage6Readiness;
  const canForward = readiness?.canForward === true;
  const forwarded = readiness?.forwarded === true;

  const slotMap = new Map((detail?.documentSlots ?? []).map((s) => [s.documentType, s]));

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

  const submitForward = async () => {
    if (!proposalId) return;
    if (!secretariatRef.trim()) {
      setError('Secretariat reference number is required');
      return;
    }
    if (!receivingAuthority.trim()) {
      setError('Receiving authority is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.forwardToSecretariat(proposalId, {
        secretariatRef: secretariatRef.trim(),
        receivingAuthority: receivingAuthority.trim(),
        comments: serializeBilingualText(comments).trim() || undefined,
        fundingRequirementNotes: serializeBilingualText(fundingNotes).trim() || undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(getApiError(err, 'Forward to Secretariat failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={6}
        title="Secretariat / Sachiwalaya Submission"
        proposalNo={detail?.proposalNo}
        statusLabel={detail?.statusLabel ?? detail?.status}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detail && (
          <>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{detail.title}</Typography>
            <Chip size="small" label={detail.statusLabel ?? detail.status} sx={{ mb: 2 }} />

            {forwarded && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Forwarded to Secretariat</Typography>
                <Typography variant="body2">
                  Ref: {readiness?.secretariatRef ?? '—'} · Receiving authority: {readiness?.receivingAuthority ?? '—'}
                </Typography>
                {readiness?.secretariatForwardedAt && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Forwarded: {new Date(readiness.secretariatForwardedAt).toLocaleString('en-IN')}
                  </Typography>
                )}
              </Alert>
            )}

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Funding &amp; Estimates
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
              <Chip label={`Preliminary estimate: ${formatInr(readiness?.preliminaryEstimate)}`} variant="outlined" />
              <Chip label={`Funding: ${readiness?.fundingSource ?? 'Not specified'}`} variant="outlined" />
            </Box>

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Submission Package
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              {(readiness?.attachments ?? []).map((att) => (
                <Chip
                  key={att.key}
                  size="small"
                  color={att.attached ? 'success' : att.required ? 'error' : 'default'}
                  variant={att.attached ? 'filled' : 'outlined'}
                  icon={att.attached ? <CheckCircleOutlineIcon /> : undefined}
                  label={`${att.label}${att.required ? ' *' : ''}`}
                  onClick={att.attached && slotMap.get(att.key)?.document
                    ? () => download(slotMap.get(att.key)!.document!.id, slotMap.get(att.key)!.document!.fileName ?? att.key)
                    : undefined}
                  sx={att.attached ? { cursor: 'pointer' } : undefined}
                />
              ))}
            </Box>

            {(readiness?.tacRecommendations?.length ?? 0) > 0 && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  TAC Recommendations &amp; Observations
                </Typography>
                <List dense disablePadding sx={{ mb: 2 }}>
                  {readiness!.tacRecommendations!.map((obs, idx) => (
                    <ListItem key={idx} disableGutters>
                      <ListItemText
                        primary={DPR_TAC_ACTION_LABELS[obs.action ?? ''] ?? obs.action ?? 'TAC note'}
                        secondary={`${obs.at ? new Date(obs.at).toLocaleString('en-IN') : ''}${obs.remarks ? ` — ${obs.remarks}` : ''}${obs.complianceNotes ? ` | ${obs.complianceNotes}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {canForward && (
              <>
                <Divider sx={{ my: 2 }} />
                <TextField
                  select fullWidth size="small" label="Receiving Authority *" sx={{ mb: 2 }}
                  value={receivingAuthority}
                  onChange={(e) => setReceivingAuthority(e.target.value)}
                >
                  {RECEIVING_AUTHORITIES.map((a) => (
                    <MenuItem key={a} value={a}>{a}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth size="small" label="Secretariat Reference No. *" sx={{ mb: 2 }}
                  value={secretariatRef}
                  onChange={(e) => setSecretariatRef(e.target.value)}
                  helperText="Official Sachiwalaya / Secretariat file reference"
                />
                <BilingualRemarkField
                  label="Forwarding comments"
                  pdfTitle="Secretariat Forwarding Comments"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={comments}
                  onChange={setComments}
                  minRows={2}
                />
                <BilingualRemarkField
                  label="Funding requirements summary"
                  pdfTitle="Funding Requirements Summary"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={fundingNotes}
                  onChange={setFundingNotes}
                  minRows={2}
                  helperText={`Default estimate: ${formatInr(readiness?.preliminaryEstimate)} — add budget head / scheme funding notes if needed`}
                />
              </>
            )}

            {canForward && (readiness?.missingAttachments?.length ?? 0) > 0 && (
              <Alert severity="warning">
                Before forwarding, attach: {(readiness?.missingAttachments ?? []).join(', ')}
              </Alert>
            )}

            {forwarded && readiness?.fundingRequirementNotes && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Funding requirements submitted</Typography>
                <Typography variant="body2">{readiness.fundingRequirementNotes}</Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canForward && (
          <Button variant="contained" startIcon={<ForwardToInboxOutlinedIcon />}
            disabled={busy || !secretariatRef.trim()} onClick={submitForward}>
            Forward to Secretariat / Sachiwalaya
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
