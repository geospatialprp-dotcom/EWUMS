import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  FormControlLabel, FormGroup, Grid, LinearProgress, TextField, Typography,
} from '@mui/material';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import BilingualTextDisplay from '../forms/BilingualTextDisplay';
import { useBilingualRemark } from '../../hooks/useBilingualRemark';
import { hasBilingualContent } from '../../utils/bilingualText';
import { canPerformHqReview, DPR_HQ_ACTION_LABELS, DPR_HQ_VERIFICATION_ITEMS } from '../../constants/dprPlanningWorkflow';
import { useAuth } from '../../context/AuthContext';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';

type HqReviewState = {
  pending?: boolean;
  canReview?: boolean;
  checklist?: Array<{ key: string; label: string; verified: boolean }>;
  allVerified?: boolean;
  proposalSummary?: {
    preliminaryEstimate?: number | null;
    fundingSource?: string | null;
    priority?: string | null;
    schemeJustification?: string | null;
  };
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  divisionName?: string | null;
  preliminaryEstimate?: number | null;
  fundingSource?: string | null;
  priority?: string | null;
  schemeJustification?: string | null;
  hqRemarks?: string | null;
  hqVerification?: Record<string, boolean>;
  dprPrepOrderNo?: string | null;
  dprPrepOrderIssuedAt?: string | null;
  hqReview?: HqReviewState;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

interface Props {
  open: boolean;
  proposalId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function DprHqReviewPanel({ open, proposalId, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];

  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<'approve' | 'return' | 'reject'>('approve');
  const { value: remarks, setValue: setRemarks, serialized: serializedRemarks, reset: resetRemarks } = useBilingualRemark('');
  const [verification, setVerification] = useState({
    needAssessment: false,
    budgetAvailability: false,
    schemePriority: false,
    fundingSource: false,
  });

  const load = useCallback(() => {
    if (!proposalId) return;
    setBusy(true);
    dprPlanningApi.getProposal(proposalId)
      .then((res) => {
        const data = res.data as ProposalDetail;
        setDetail(data);
        const v = data.hqVerification ?? {};
        setVerification({
          needAssessment: !!v.needAssessment,
          budgetAvailability: !!v.budgetAvailability,
          schemePriority: !!v.schemePriority,
          fundingSource: !!v.fundingSource,
        });
        resetRemarks('');
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

  const pending = ['hq_review', 'proposal_submitted'].includes(detail?.status ?? '');
  const canReview = detail?.hqReview?.canReview ?? canPerformHqReview(roles);
  const allVerified = DPR_HQ_VERIFICATION_ITEMS.every((item) => verification[item.key as keyof typeof verification]);

  const submitReview = async () => {
    if (!proposalId) return;
    if ((action === 'return' || action === 'reject') && !hasBilingualContent(remarks)) {
      setError('Remarks are required for return or rejection');
      return;
    }
    if (action === 'approve' && !allVerified) {
      setError('All HQ verification items must be confirmed before approval');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.reviewByHq(proposalId, {
        action,
        remarks: serializedRemarks.trim() || undefined,
        ...verification,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(getApiError(err, 'HQ review action failed'));
    } finally {
      setBusy(false);
    }
  };

  const summary = detail?.hqReview?.proposalSummary ?? detail;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={2}
        title="HQ DPR Preparation Approval"
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
              {detail.divisionName && <Chip size="small" variant="outlined" label={detail.divisionName} />}
              {detail.dprPrepOrderNo && (
                <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />}
                  label={`DPO: ${detail.dprPrepOrderNo}`} />
              )}
            </Box>

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Proposal Summary for HQ Review
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Preliminary Estimate</Typography>
                <Typography variant="body2">
                  {summary?.preliminaryEstimate != null
                    ? `₹ ${Number(summary.preliminaryEstimate).toLocaleString('en-IN')}`
                    : '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Funding Source</Typography>
                <Typography variant="body2">{summary?.fundingSource ?? '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Scheme Priority</Typography>
                <Typography variant="body2">
                  {PRIORITY_LABELS[summary?.priority ?? ''] ?? summary?.priority ?? '—'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Scheme Justification</Typography>
                <BilingualTextDisplay text={summary?.schemeJustification} />
              </Grid>
            </Grid>

            {pending && canReview && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Administrative HQ Verification
                </Typography>
                <FormGroup sx={{ mb: 2 }}>
                  {DPR_HQ_VERIFICATION_ITEMS.map((item) => (
                    <FormControlLabel
                      key={item.key}
                      control={(
                        <Checkbox
                          checked={verification[item.key as keyof typeof verification]}
                          onChange={(e) => setVerification({ ...verification, [item.key]: e.target.checked })}
                        />
                      )}
                      label={item.label}
                    />
                  ))}
                </FormGroup>

                <TextField
                  select fullWidth size="small" label="HQ Decision" sx={{ mb: 2 }}
                  value={action}
                  onChange={(e) => setAction(e.target.value as 'approve' | 'return' | 'reject')}
                  SelectProps={{ native: true }}
                >
                  <option value="approve">{DPR_HQ_ACTION_LABELS.approve}</option>
                  <option value="return">{DPR_HQ_ACTION_LABELS.return}</option>
                  <option value="reject">{DPR_HQ_ACTION_LABELS.reject}</option>
                </TextField>

                <BilingualRemarkField
                  label={action === 'approve' ? 'Approval Remarks (optional)' : 'Remarks (required)'}
                  pdfTitle="DPR HQ Review Remarks"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={remarks}
                  onChange={setRemarks}
                  required={action !== 'approve'}
                  minRows={3}
                  helperText={
                    action === 'approve'
                      ? 'Upon approval, a DPR Preparation Order will be issued and status changes to DPR Preparation Approved.'
                      : 'Division EE will be notified to revise and resubmit.'
                  }
                />
              </>
            )}

            {!pending && detail.dprPrepOrderNo && (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                DPR Preparation Order <strong>{detail.dprPrepOrderNo}</strong> issued
                {detail.dprPrepOrderIssuedAt && (
                  <> on {new Date(detail.dprPrepOrderIssuedAt).toLocaleDateString('en-IN')}</>
                )}
                . Status: <strong>{detail.statusLabel}</strong>
              </Alert>
            )}

            {!pending && !detail.dprPrepOrderNo && detail.hqRemarks && (
              <Alert severity="info">HQ Remarks: {detail.hqRemarks}</Alert>
            )}

            {!canReview && pending && (
              <Alert severity="info">This proposal is awaiting HQ review. Division EE can track status here; only HQ officials (SE, CE, CGM, MD) can approve or return.</Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {pending && canReview && (
          <Button
            variant="contained"
            color={action === 'reject' ? 'error' : action === 'return' ? 'warning' : 'primary'}
            startIcon={<GavelOutlinedIcon />}
            disabled={busy || (action === 'approve' && !allVerified)}
            onClick={submitReview}
          >
            {DPR_HQ_ACTION_LABELS[action]}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
