import { ReactNode } from 'react';
import { Box, Checkbox, Typography } from '@mui/material';
import { ARCMAP } from '../gis/arcMapUi';

export function MapExplorerStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        px: 0.75,
        py: 0.35,
        border: `1px solid ${ARCMAP.toolbarBorder}`,
        bgcolor: '#ffffff',
        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      <Typography variant="caption" sx={{ color: ARCMAP.textMuted, fontWeight: 700, fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Typography variant="caption" fontWeight={700} sx={{ color: ARCMAP.text, display: 'block' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function MapPanelSectionLabel({
  title,
  count,
}: {
  title: string;
  count?: number;
  icon?: ReactNode;
}) {
  return (
    <Typography sx={{ ...{ fontSize: '0.7rem', fontWeight: 700, color: ARCMAP.textMuted }, px: 1, py: 0.35, bgcolor: '#f0f0f0', borderBottom: `1px solid ${ARCMAP.toolbarBorder}` }}>
      {title}{count != null ? ` (${count})` : ''}
    </Typography>
  );
}

export function MapLayerEmptyState({ message }: { message: string }) {
  return (
    <Box px={1} py={0.75}>
      <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
        {message}
      </Typography>
    </Box>
  );
}

export function MapJurisdictionChip({ label }: { label: string }) {
  return (
    <Typography variant="caption" sx={{ color: ARCMAP.textMuted, fontSize: '0.7rem' }} noWrap>
      {label}
    </Typography>
  );
}
