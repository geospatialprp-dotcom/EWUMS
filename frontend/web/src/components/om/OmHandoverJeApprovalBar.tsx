import { useState } from 'react';
import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { omApi } from '../../services/api';
import { HANDOVER_STATUS_LABELS } from '../../constants/omHandover';
import { useAuth } from '../../context/AuthContext';
import { isContractorUser } from '../../utils/operationalAccess';

const REVIEWER: Record<string, string> = {
  je_review: 'je',
  ae_review: 'ae',
  ee_review: 'ee',
};

type HandoverRow = {
  id: string;
  schemeName?: string;
  status?: string;
};

export default function OmHandoverJeApprovalBar({
  handovers,
  onDone,
}: {
  handovers: HandoverRow[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  if (isContractorUser(user?.roles)) return null;

  const roles = user?.roles ?? [];
  const reviewRows = handovers.filter((h) => {
    const status = String(h.status ?? '');
    return ['je_review', 'ae_review', 'ee_review'].includes(status);
  });

  if (!reviewRows.length) return null;

  const act = async (id: string, action: 'approve' | 'reject') => {
    if (!window.confirm(`${action === 'approve' ? 'Approve' : 'Reject'} this handover?`)) return;
    setBusyId(id);
    setError('');
    try {
      await omApi.actOnHandover(id, { action, comments: '' });
      onDone();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Approval failed — rebuild API on VPS and login again as JE.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
      {reviewRows.map((h) => {
        const status = String(h.status ?? '');
        const needed = REVIEWER[status];
        const canAct = Boolean(needed && roles.includes(needed));
        return (
        <Alert
          key={String(h.id)}
          severity={canAct ? 'warning' : 'info'}
          sx={{ mb: 1, alignItems: 'center' }}
          action={canAct ? (
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<CheckCircleIcon />}
                disabled={Boolean(busyId)}
                onClick={() => act(String(h.id), 'approve')}
              >
                Approve Handover
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<CancelIcon />}
                disabled={Boolean(busyId)}
                onClick={() => act(String(h.id), 'reject')}
              >
                Reject
              </Button>
            </Box>
          ) : undefined}
        >
          <Typography component="span" fontWeight={700}>
            {String(h.schemeName ?? 'Handover')}
          </Typography>
          {' — '}
          <Chip
            size="small"
            label={HANDOVER_STATUS_LABELS[status] ?? status}
            sx={{ ml: 0.5, verticalAlign: 'middle' }}
          />
          {' '}
          <Typography component="span" variant="body2">
            {canAct
              ? `awaiting your approval (${user?.email})`
              : `needs ${needed?.toUpperCase() ?? 'department'} login — use geospatialprp@gmail.com for JE step`}
          </Typography>
        </Alert>
        );
      })}
    </Box>
  );
}
