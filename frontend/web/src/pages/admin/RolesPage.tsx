import { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import axios from 'axios';
import { rolesApi, RoleRecord } from '../../services/api';
import PageShell from '../../components/layout/PageShell';
import PageHeader from '../../components/layout/PageHeader';
import SurfaceCard from '../../components/layout/SurfaceCard';
import { kpiCardSx, kpiLabelSx, kpiValueSx, surfaceCardSx } from '../../utils/pagePresentationStyles';

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401) {
      return 'Your session has expired. Redirecting to sign in...';
    }
    const msg = err.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (err.response?.status === 403) return 'You do not have permission for this action.';
  }
  return 'Failed to load roles and permissions.';
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    rolesApi.list()
      .then((r) => setRoles(r.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const groupedPermissions = (permissions: RoleRecord['permissions']) => {
    const groups: Record<string, typeof permissions> = {};
    permissions.forEach((p) => {
      if (!groups[p.resource]) groups[p.resource] = [];
      groups[p.resource].push(p);
    });
    return groups;
  };

  return (
    <PageShell fullHeight loading={loading} loadingLabel="Loading roles…">
      <PageHeader
        eyebrow="Security"
        title="Roles & Permissions"
        accent="rose"
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" flexWrap="wrap" gap={2} mb={3}>
        {roles.map((role) => (
          <Box key={role.id} sx={{ ...kpiCardSx('violet'), minWidth: 220, flex: '1 1 220px' }}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <SecurityIcon sx={{ color: '#7c3aed' }} />
              <Typography sx={kpiLabelSx('violet')}>{role.name}</Typography>
            </Box>
            <Typography sx={{ ...kpiValueSx('violet'), fontSize: '1.5rem' }}>{role.permissions.length}</Typography>
            <Typography variant="caption" color="text.secondary">permissions</Typography>
            <Chip label={role.code} size="small" variant="outlined" sx={{ mt: 1 }} />
          </Box>
        ))}
      </Stack>

      {roles.map((role) => (
        <Accordion
          key={role.id}
          defaultExpanded={role.code === 'super_admin'}
          sx={{ ...surfaceCardSx(), mb: 1.5, '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>{role.name}</Typography>
            <Chip label={`${role.permissions.length} permissions`} size="small" sx={{ ml: 2 }} />
          </AccordionSummary>
          <AccordionDetails>
            {role.permissions.length === 0 ? (
              <Typography color="text.secondary">No permissions assigned to this role.</Typography>
            ) : (
              <Box display="flex" flexWrap="wrap" gap={2}>
                {Object.entries(groupedPermissions(role.permissions)).map(([resource, perms]) => (
                  <Box key={resource} sx={{ ...surfaceCardSx(), p: 1.5, minWidth: 200, flex: '1 1 200px' }}>
                    <Typography variant="subtitle2" textTransform="capitalize" gutterBottom fontWeight={700}>
                      {resource}
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {perms.map((p) => (
                        <Chip key={p.id} label={p.action} size="small" color="primary" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </PageShell>
  );
}
