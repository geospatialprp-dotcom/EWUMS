import { Link, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mapsExactLocationUrl, parseCoordinatePair } from '../../utils/coordinateFields';
import { resolveAuditLocation, type AuditLocationFields } from '../../utils/auditDisplay';

type CoordinateMapLinkProps = {
  latitude?: unknown;
  longitude?: unknown;
  label?: string;
  sx?: SxProps<Theme>;
};

/** Hyperlink lat/lng to Google Maps exact pin. */
export function CoordinateMapLink({
  latitude,
  longitude,
  label,
  sx,
}: CoordinateMapLinkProps) {
  const coords = parseCoordinatePair(latitude, longitude);
  if (!coords) {
    return (
      <Typography variant="body2" component="span" sx={sx}>
        {label ?? '—'}
      </Typography>
    );
  }

  const text = label
    ?? `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;

  return (
    <Link
      href={mapsExactLocationUrl(coords.latitude, coords.longitude)}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      title="Open exact location in Google Maps"
      sx={{
        color: '#0369a1',
        fontWeight: 600,
        wordBreak: 'break-word',
        ...((sx ?? {}) as object),
      }}
    >
      {text}
    </Link>
  );
}

type AuditLocationLinkProps = {
  log: AuditLocationFields;
  sx?: SxProps<Theme>;
};

/** Audit Trail Location cell — address + coords, linked to exact map pin when available. */
export function AuditLocationLink({ log, sx }: AuditLocationLinkProps) {
  const view = resolveAuditLocation(log);
  if (view.text === '—') {
    return (
      <Typography variant="body2" sx={sx}>—</Typography>
    );
  }

  if (!view.mapsUrl) {
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.35, ...((sx ?? {}) as object) }}>
        {view.text}
      </Typography>
    );
  }

  return (
    <Link
      href={view.mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      title="Open exact location in Google Maps"
      sx={{
        display: 'block',
        color: '#0369a1',
        fontWeight: 600,
        whiteSpace: 'pre-line',
        lineHeight: 1.35,
        wordBreak: 'break-word',
        ...((sx ?? {}) as object),
      }}
    >
      {view.text}
    </Link>
  );
}
