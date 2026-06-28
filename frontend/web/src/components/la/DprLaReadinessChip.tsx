import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import LandscapeOutlinedIcon from '@mui/icons-material/LandscapeOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Link as RouterLink } from 'react-router-dom';
import type { LaReadiness } from '../../constants/laAcquisition';
import { laStatusColor, laStatusLabel } from '../../constants/laAcquisition';

type Props = {
  proposalId: string;
  proposalTitle?: string;
  readiness?: LaReadiness | null;
  variant?: 'compact' | 'full';
};

export default function DprLaReadinessChip({ proposalId, proposalTitle, readiness, variant = 'full' }: Props) {
  const la = readiness;
  if (!la) return null;

  if (variant === 'compact') {
    return (
      <Chip
        size="small"
        icon={<LandscapeOutlinedIcon />}
        label={la.hasCase ? `LA: ${la.statusLabel ?? laStatusLabel(la.status)}` : 'LA: Not started'}
        color={la.hasCase ? laStatusColor(la.status) : 'warning'}
        variant={la.canSubmitDprStage3 || la.canRecordSanction ? 'filled' : 'outlined'}
        component={la.caseId ? RouterLink : 'div'}
        to={la.caseId ? `/land-acquisition/${la.caseId}` : undefined}
        clickable={Boolean(la.caseId)}
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
        <Typography variant="body2" color="text.secondary" gutterBottom>
          No land acquisition case linked to this DPR proposal. Create one to trace pipeline alignment and identify affected parcels.
        </Typography>
      )}
      <Box mt={1} display="flex" gap={1} flexWrap="wrap">
        {la.caseId ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewOutlinedIcon />}
            component={RouterLink}
            to={`/land-acquisition/${la.caseId}`}
          >
            Open LA Workspace
          </Button>
        ) : (
          <Button
            size="small"
            variant="contained"
            component={RouterLink}
            to={`/land-acquisition?createFor=${proposalId}&title=${encodeURIComponent(proposalTitle ?? '')}`}
          >
            Create LA Case
          </Button>
        )}
      </Box>
    </Alert>
  );
}
