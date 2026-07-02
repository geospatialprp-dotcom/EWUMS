import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, List, ListItem, ListItemText, Typography,
} from '@mui/material';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import {
  DprWorkflowStageAction,
  getDprDisplayStatusLabel,
  getDprWorkflowGuidance,
} from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, DprPipelineTracker, DprStageProgress, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  currentStage: number;
  stageLabel?: string;
  tenderPrepAuthorized?: boolean;
  eeComplianceAssignmentPending?: boolean;
  events?: Array<{ action?: string; comments?: string | null; createdAt?: string; stage?: number }>;
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
  roles: string[];
  onClose: () => void;
  onOpenStage: (action: DprWorkflowStageAction, proposalId: string) => void;
}

export default function DprWorkflowTrackPanel({
  open,
  proposalId,
  roles,
  onClose,
  onOpenStage,
}: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      const res = await dprPlanningApi.getProposal(proposalId);
      setDetail(res.data as ProposalDetail);
    } catch (err) {
      setError(getApiError(err, 'Failed to load workflow status'));
    } finally {
      setBusy(false);
    }
  }, [proposalId]);

  useEffect(() => {
    if (open && proposalId) load();
    if (!open) {
      setDetail(null);
      setError('');
    }
  }, [open, proposalId, load]);

  const guidance = detail
    ? getDprWorkflowGuidance(detail.status, roles, {
      tenderPrepAuthorized: detail.tenderPrepAuthorized,
      eeComplianceAssignmentPending: detail.eeComplianceAssignmentPending,
    })
    : null;

  const handleAction = (action: DprWorkflowStageAction) => {
    if (!proposalId) return;
    onClose();
    onOpenStage(action, proposalId);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={detail?.currentStage ?? 1}
        title="Workflow — Track & Next Step"
        proposalNo={detail?.proposalNo}
        statusLabel={detail ? getDprDisplayStatusLabel(detail.status, roles, detail.statusLabel) : undefined}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detail && (
          <>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>{detail.title}</Typography>
            <Chip
              size="small"
              label={detail.stageLabel ?? `Stage ${detail.currentStage}`}
              sx={{ mb: 2 }}
            />

            <Box sx={{ mb: 2, p: 1.75, borderRadius: 2, bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
              <DprStageProgress currentStage={detail.currentStage} />
              <Box mt={1.5}>
                <DprPipelineTracker activeStage={detail.currentStage} compact />
              </Box>
            </Box>

            {guidance && (
              <Alert severity="info" icon={<TimelineOutlinedIcon />} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>{guidance.headline}</Typography>
                <List dense disablePadding>
                  {guidance.steps.map((step, idx) => (
                    <ListItem key={idx} disableGutters sx={{ py: 0.25 }}>
                      <ListItemText
                        primary={`${idx + 1}. ${step}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}

            {guidance && guidance.actions.length > 0 && (
              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                {guidance.actions.map((a) => (
                  <Button
                    key={a.key}
                    size="small"
                    variant={a.variant ?? 'contained'}
                    onClick={() => handleAction(a.key)}
                  >
                    {a.label}
                  </Button>
                ))}
              </Box>
            )}

            {(detail.events?.length ?? 0) > 0 && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Recent activity
                </Typography>
                <List dense disablePadding>
                  {detail.events!.slice(0, 5).map((ev, idx) => (
                    <ListItem key={idx} disableGutters>
                      <ListItemText
                        primary={ev.action?.replace(/_/g, ' ') ?? 'Event'}
                        secondary={`${ev.createdAt ? new Date(ev.createdAt).toLocaleString('en-IN') : ''}${ev.comments ? ` — ${ev.comments}` : ''}`}
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
      </DialogActions>
    </Dialog>
  );
}
