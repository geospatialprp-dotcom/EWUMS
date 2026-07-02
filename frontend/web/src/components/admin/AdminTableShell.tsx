import { ReactNode } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import SurfaceCard from '../layout/SurfaceCard';

type AdminTableShellProps = {
  title: string;
  count: number;
  divisionScope?: string | null;
  toolbarHint?: string;
  emptyLabel?: string;
  children: ReactNode;
};

export function AdminTableShell({
  title,
  count,
  divisionScope,
  toolbarHint,
  emptyLabel = 'No records in this division scope.',
  children,
}: AdminTableShellProps) {
  return (
    <SurfaceCard
      darkHeader
      flush
      cardSx={{ overflow: 'hidden' }}
      contentSx={{ overflow: 'hidden', minWidth: 0, p: 0, '&:last-child': { pb: 0 } }}
      header={(
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={1}
          sx={{ width: '100%' }}
        >
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#f8fafc', letterSpacing: '0.04em' }}>
            {title}
          </Typography>
          <Chip
            label={`${count} record${count === 1 ? '' : 's'}`}
            size="small"
            sx={{
              bgcolor: 'rgba(255,255,255,0.12)',
              color: '#e2e8f0',
              fontWeight: 700,
              border: '1px solid rgba(148, 163, 184, 0.35)',
            }}
          />
        </Stack>
      )}
    >
      <Box
        sx={{
          px: 2,
          py: 1.1,
          bgcolor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {divisionScope ? (
          <Chip
            icon={<BusinessOutlinedIcon sx={{ fontSize: '16px !important' }} />}
            label={divisionScope}
            size="small"
            sx={{
              fontWeight: 700,
              bgcolor: '#eff6ff',
              color: '#1e40af',
              border: '1px solid #bfdbfe',
            }}
          />
        ) : (
          <Chip
            label="All divisions"
            size="small"
            sx={{ fontWeight: 600, bgcolor: '#fff', border: '1px solid #e2e8f0' }}
          />
        )}
        {toolbarHint ? (
          <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
            {toolbarHint}
          </Typography>
        ) : null}
      </Box>

      {count === 0 ? (
        <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        </Box>
      ) : (
        children
      )}
    </SurfaceCard>
  );
}

export const adminTableContainerSx = {
  width: '100%',
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'visible',
  WebkitOverflowScrolling: 'touch',
  overscrollBehaviorX: 'contain',
};

export default AdminTableShell;
