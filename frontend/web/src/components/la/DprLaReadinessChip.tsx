import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import LandscapeOutlinedIcon from '@mui/icons-material/LandscapeOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { useNavigate } from 'react-router-dom';
import type { LaReadiness } from '../../constants/laAcquisition';
import { laStatusColor, laStatusLabel } from '../../constants/laAcquisition';
import { useAuth } from '../../context/AuthContext';
import { canPerformOperational, isSuperAdmin, SUPER_ADMIN_VIEW_ONLY_MESSAGE } from '../../utils/operationalAccess';

type Props = {
  proposalId: string;
  proposalTitle?: string;
  readiness?: LaReadiness | null;
  variant?: 'compact' | 'full';
  /** Close parent DPR dialog before navigating (RouterLink inside MUI Dialog is unreliable). */
  onNavigateAway?: () => void;
};

function buildLaCreateUrl(proposalId: string, proposalTitle?: string) {
  const params = new URLSearchParams({ createFor: proposalId });
  if (proposalTitle?.trim()) params.set('title', proposalTitle.trim());
  return `/land-acquisition?${params.toString()}`;
}

export default function DprLaReadinessChip({
  proposalId,
  proposalTitle,
  readiness,
  variant = 'full',
  onNavigateAway,
}: Props) {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const canCreateLaCase = canPerformOperational(user?.roles, hasPermission, 'la_case:create');

  const la = readiness;
  if (!la) return null;

  const openLaPath = (path: string) => {
    onNavigateAway?.();
    navigate(path);
  };

  if (variant === 'compact') {
    return (
      <Chip
        size="small"
        icon={<LandscapeOutlinedIcon />}
        label={la.hasCase ? `LA: ${la.statusLabel ?? laStatusLabel(la.status)}` : 'LA: Not started'}
        color={la.hasCase ? laStatusColor(la.status) : 'warning'}
        variant={la.canSubmitDprStage3 || la.canRecordSanction ? 'filled' : 'outlined'}
        clickable={Boolean(la.caseId)}
        onClick={la.caseId ? () => openLaPath(`/land-acquisition/${la.caseId}`) : undefined}
      />
    );
  }

  return (
    <Alert
      severity={la.canSubmitDprStage3 && la.canRecordSanction ? 'success' : la.hasCase ? 'info' : 'warning'}
      icon={<LandscapeOutlinedIcon />}
      sx={{ mb: 2 }}
    >
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Land Acquisition Integration
      </Typography>
      {la.hasCase ? (
        <>
          <Box display="flex" gap={1} flexWrap="wrap" alignItems="center" mb={1}>
            <Chip size="small" label={la.caseNo ?? 'LA Case'} />
            <Chip size="small" color={laStatusColor(la.status)} label={la.statusLabel ?? laStatusLabel(la.status)} />
            <Chip size="small" variant="outlined" label={`${la.parcelsTotal ?? 0} parcels`} />
            {(la.clearancesPending?.length ?? 0) > 0 && (
              <Chip size="small" color="warning" label={`${la.clearancesPending!.length} clearances pending`} />
            )}
          </Box>
          {(la.missingActions?.length ?? 0) > 0 && (
            <Typography variant="caption" component="div" color="text.secondary">
              {la.missingActions!.map((m) => `• ${m}`).join('\n')}
            </Typography>
          )}
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            No land acquisition case linked to this DPR proposal yet. At <strong>DPR Stage 3</strong>, create LA here
            to open a GIS workspace, trace pipeline alignment, and identify affected parcels before TAC submission.
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            After a construction project exists, you can also create LA from Land Acquisition and link the live project
            instead of the DPR GIS workspace.
          </Typography>
        </>
      )}
      <Box mt={1} display="flex" gap={1} flexWrap="wrap" alignItems="center">
        {la.caseId ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewOutlinedIcon />}
            onClick={() => openLaPath(`/land-acquisition/${la.caseId}`)}
          >
            Open LA Workspace
          </Button>
        ) : canCreateLaCase ? (
          <Button
            size="small"
            variant="contained"
            onClick={() => openLaPath(buildLaCreateUrl(proposalId, proposalTitle))}
          >
            Create LA Case (opens GIS workspace for pipeline trace)
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {isSuperAdmin(user?.roles)
              ? SUPER_ADMIN_VIEW_ONLY_MESSAGE
              : 'Your account cannot create LA cases. Ask an EE or division engineer to create one.'}
          </Typography>
        )}
      </Box>
    </Alert>
  );
}
