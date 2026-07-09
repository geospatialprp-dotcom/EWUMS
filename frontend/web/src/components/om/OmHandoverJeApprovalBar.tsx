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

const JE_DEMO_EMAILS = new Set(['geospatialprp@gmail.com', 'je.kpg@egip.local']);

export function canActOnHandoverReview(
  status: string,
  roles: string[] | undefined,
  email?: string | null,
): boolean {
  const needed = REVIEWER[status];
  if (!needed) return false;
  if (roles?.includes(needed)) return true;
  if (needed === 'je' && email && JE_DEMO_EMAILS.has(email.toLowerCase())) return true;
  return false;
}

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
        const canAct = canActOnHandoverReview(status, roles, user?.email);
        return (
          <Box
            key={String(h.id)}
            sx={{
              mb: 1.5,
              p: 2,
              borderRadius: 2,
              border: canAct ? '3px solid #f59e0b' : '1px solid #cbd5e1',
              bgcolor: canAct ? '#fffbeb' : '#f8fafc',
              boxShadow: canAct ? '0 0 0 4px rgba(245,158,11,0.15)' : 'none',
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mb: 0.5, color: canAct ? '#b45309' : 'text.primary' }}>
              {canAct ? '⚠ Action required — Approve Handover' : 'Pending department review'}
            </Typography>
            <Typography component="span" fontWeight={700}>
              {String(h.schemeName ?? 'Handover')}
            </Typography>
            {' '}
            <Chip
              size="small"
              label={HANDOVER_STATUS_LABELS[status] ?? status}
              color={canAct ? 'warning' : 'default'}
              sx={{ ml: 0.5, verticalAlign: 'middle', fontWeight: 700 }}
            />
            <Typography variant="body2" sx={{ mt: 1, mb: canAct ? 1.5 : 0 }}>
              {canAct
                ? `You are logged in as ${user?.email}. Review documents (Open), then click Approve Handover.`
                : `This step needs ${needed?.toUpperCase() ?? 'department'} login. For JE use geospatialprp@gmail.com`}
            </Typography>
            {canAct && (
              <Box display="flex" gap={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<CheckCircleIcon />}
                  disabled={Boolean(busyId)}
                  onClick={() => act(String(h.id), 'approve')}
                  sx={{ fontWeight: 800, px: 3 }}
                >
                  Approve Handover
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="large"
                  startIcon={<CancelIcon />}
                  disabled={Boolean(busyId)}
                  onClick={() => act(String(h.id), 'reject')}
                >
                  Reject
                </Button>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
