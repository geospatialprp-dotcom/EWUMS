import { Chip, Stack, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  AuditLocationFields,
  getAuditLocationPresentation,
} from '../../utils/auditLocationDisplay';

export function AuditLocationDisplay({ entry }: { entry: AuditLocationFields }) {
  const pres = getAuditLocationPresentation(entry);

  if (pres.kind === 'unknown') {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }

  if (pres.kind === 'approximate') {
    return (
      <Stack spacing={0.5}>
        <Chip
          label="Approximate"
          size="small"
          sx={{
            height: 20,
            width: 'fit-content',
            fontSize: '0.625rem',
            fontWeight: 700,
            bgcolor: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fcd34d',
          }}
        />
        <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
          {pres.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          City-level IP lookup
        </Typography>
      </Stack>
    );
  }

  const coords = `${pres.latitude.toFixed(6)}, ${pres.longitude.toFixed(6)}`;
  const accuracy = pres.accuracyMeters != null ? ` ±${Math.round(pres.accuracyMeters)} m` : '';

  return (
    <Stack spacing={0.5}>
      <Chip
        label="GPS"
        size="small"
        sx={{
          height: 20,
          width: 'fit-content',
          fontSize: '0.625rem',
          fontWeight: 700,
          bgcolor: '#ecfdf5',
          color: '#047857',
          border: '1px solid #6ee7b7',
        }}
      />
      {pres.address ? (
        <Typography
          variant="body2"
          sx={{
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {pres.address}
        </Typography>
      ) : null}
      <Typography
        variant="caption"
        component="a"
        href={pres.mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.35,
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          color: '#2563eb',
          fontWeight: 600,
          textDecoration: 'none',
          width: 'fit-content',
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        {coords}
        {accuracy}
        <OpenInNewIcon sx={{ fontSize: 12 }} />
      </Typography>
    </Stack>
  );
}
