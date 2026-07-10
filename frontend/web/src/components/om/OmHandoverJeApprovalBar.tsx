import { useState } from 'react';
import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { omApi } from '../../services/api';
import { HANDOVER_STATUS_LABELS } from '../../constants/omHandover';
import { useAuth } from '../../context/AuthContext';
import { isContractorUser } from '../../utils/operationalAccess';

const REVIEW_STATUSES = new Set(['je_review', 'ae_review', 'ee_review']);
const REVIEWER: Record<string, string> = {
  je_review: 'je',
  ae_review: 'ae',
  ee_review: 'ee',
};
const REVIEWER_STEP_LABEL: Record<string, string> = {
  je_review: 'JE',
  ae_review: 'AE',
  ee_review: 'EE',
};
const JE_DEMO_EMAILS = new Set(['geospatialprp@gmail.com', 'je.kpg@egip.local']);

export function isKpgFieldDemoUser(roles?: string[], email?: string | null): boolean {
  if (email && JE_DEMO_EMAILS.has(email.toLowerCase())) return true;
  if (!roles?.length || roles.includes('super_admin')) return false;
  return roles.some((r) => ['je', 'ae', 'ee', 'accounts', 'contractor'].includes(r));
}

export function handoverStatusesForUser(roles?: string[], email?: string | null): string[] {
  const statuses: string[] = [];
  if (roles?.includes('je') || (email && JE_DEMO_EMAILS.has(email.toLowerCase()))) {
    statuses.push('je_review');
  }
  if (roles?.includes('ae')) statuses.push('ae_review');
  if (roles?.includes('ee')) statuses.push('ee_review');
  return statuses;
}

export function filterHandoversForReviewer<T extends { status?: unknown }>(
  handovers: T[],
  roles?: string[],
  email?: string | null,
): T[] {
  const allowed = new Set(handoverStatusesForUser(roles, email));
  if (!allowed.size) return [];
  return handovers.filter((h) => allowed.has(String(h.status ?? '')));
}

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

export function isHandoverAwaitingReview(status: string): boolean {
  return REVIEW_STATUSES.has(status);
}

type HandoverRow = {
  id: string;
  schemeName?: string;
  status?: string;
};

/** Always-visible JE/AE/EE approval panel above the handover register. */
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

  const reviewRows = filterHandoversForReviewer(handovers, user?.roles, user?.email)
    .filter((h) => canActOnHandoverReview(String(h.status ?? ''), user?.roles, user?.email));
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
      setError(typeof msg === 'string' ? msg : 'Approval failed. Rebuild API on VPS and login as JE.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
      {reviewRows.map((h) => {
        const status = String(h.status ?? '');
        const stepLabel = REVIEWER_STEP_LABEL[status] ?? 'Department';
        return (
          <Box
            key={String(h.id)}
            sx={{
              mb: 1.5,
              p: 2.5,
              borderRadius: 2,
              border: '3px solid #f59e0b',
              bgcolor: '#fffbeb',
              boxShadow: '0 0 0 4px rgba(245,158,11,0.2)',
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#b45309', mb: 0.5 }}>
              {stepLabel} — Approve Handover
            </Typography>
            <Typography fontWeight={700} component="span">
              {String(h.schemeName ?? 'Handover')}
            </Typography>
            <Chip
              size="small"
              label={HANDOVER_STATUS_LABELS[status] ?? status}
              color="warning"
              sx={{ ml: 1, fontWeight: 700 }}
            />
            <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
              Logged in: <strong>{user?.email ?? 'unknown'}</strong> — you can approve now.
            </Typography>
            <Box display="flex" gap={1.5} flexWrap="wrap">
              <Button
                variant="contained"
                color="success"
                size="large"
                disabled={Boolean(busyId)}
                startIcon={<CheckCircleIcon />}
                onClick={() => act(String(h.id), 'approve')}
                sx={{ fontWeight: 800, px: 4, py: 1.25, fontSize: '1rem' }}
              >
                Approve Handover
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="large"
                disabled={Boolean(busyId)}
                startIcon={<CancelIcon />}
                onClick={() => act(String(h.id), 'reject')}
              >
                Reject
              </Button>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
