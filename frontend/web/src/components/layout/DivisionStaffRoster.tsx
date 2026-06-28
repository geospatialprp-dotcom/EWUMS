import { useEffect, useState } from 'react';
import { Box, Chip, CircularProgress, Typography } from '@mui/material';
import { divisionsApi, type DivisionStaffLogin } from '../../services/api';

const ROLE_ORDER = ['ee', 'ae', 'je', 'accounts', 'contractor'];

function sortAccounts(accounts: DivisionStaffLogin[]) {
  return [...accounts].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.role);
    const bi = ROLE_ORDER.indexOf(b.role);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export default function DivisionStaffRoster() {
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState<Array<{ divisionName: string; accounts: DivisionStaffLogin[] }>>([]);

  useEffect(() => {
    divisionsApi.staffLogins()
      .then((res) => setDivisions(res.data.divisions ?? []))
      .catch(() => setDivisions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (!divisions.length) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
        Create a scheme for a division to generate staff logins.
      </Typography>
    );
  }

  return (
    <Box sx={{ maxHeight: 320, overflowY: 'auto', px: 1, pb: 1 }}>
      <Typography
        variant="overline"
        sx={{ px: 1, color: '#64748b', fontWeight: 700, letterSpacing: '0.1em', display: 'block', mb: 1 }}
      >
        Division authority logins
      </Typography>
      {divisions.map((group) => (
        <Box key={group.divisionName} sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ px: 1, fontWeight: 800, color: '#1e40af', display: 'block', mb: 0.5 }}>
            {group.divisionName.replace(/\s+Division$/i, '')}
          </Typography>
          {sortAccounts(group.accounts).map((acc) => (
            <Box
              key={acc.email}
              sx={{
                mx: 0.5,
                mb: 0.5,
                p: 1,
                borderRadius: 1.5,
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <Chip
                label={`${acc.roleLabel.replace(/ \(.*\)/, '')} · ${group.divisionName.replace(/\s+Division$/i, '')}`}
                size="small"
                sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, mb: 0.5 }}
              />
              <Typography variant="caption" display="block" sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
                {acc.email}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                {acc.password}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
