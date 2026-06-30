import {
  Button, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type ParcelRow = Record<string, unknown>;

const COLUMNS: Array<{ key: string; label: string; align?: 'left' | 'right'; format?: (v: unknown) => string }> = [
  { key: 'khasraNo', label: 'Khasra No.' },
  { key: 'khataNo', label: 'Khata No.' },
  { key: 'village', label: 'Village' },
  { key: 'affectedAreaSqm', label: 'Area Affected (m²)', align: 'right', format: (v) => Number(v ?? 0).toLocaleString('en-IN') },
  { key: 'affectedLengthM', label: 'Length Inside (m)', align: 'right', format: (v) => Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 1 }) },
  { key: 'rowWidthM', label: 'Width Req. (m)', align: 'right', format: (v) => Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 1 }) },
  { key: 'temporaryAreaSqm', label: 'Temporary (m²)', align: 'right', format: (v) => Number(v ?? 0).toLocaleString('en-IN') },
  { key: 'permanentAreaSqm', label: 'Permanent (m²)', align: 'right', format: (v) => Number(v ?? 0).toLocaleString('en-IN') },
  { key: 'totalAreaSqm', label: 'Total Area (m²)', align: 'right', format: (v) => Number(v ?? 0).toLocaleString('en-IN') },
  { key: 'ownershipClassificationLabel', label: 'Ownership Class' },
  { key: 'ownershipType', label: 'Ownership (Raw)' },
  { key: 'department', label: 'Department' },
  { key: 'ownerName', label: 'Owner Name' },
  { key: 'landCategory', label: 'Land Category' },
  { key: 'landUse', label: 'Land Use' },
  { key: 'currentStatus', label: 'Current Status' },
  { key: 'mutationStatus', label: 'Mutation Status' },
  { key: 'acquisitionMode', label: 'Acquisition' },
  { key: 'status', label: 'LA Status' },
];

function parcelStatusColor(status: string): 'default' | 'warning' | 'success' | 'info' {
  if (status === 'identified') return 'warning';
  if (status === 'surveyed') return 'info';
  if (['notified', 'awarded', 'paid', 'possession'].includes(status)) return 'success';
  return 'default';
}

function parcelStatusLabel(status: string): string {
  if (status === 'identified') return 'Identified (GIS)';
  if (status === 'surveyed') return 'Survey verified';
  return status;
}

type Props = {
  parcels: ParcelRow[];
  canUpdate?: boolean;
  verifyingParcelId?: string | null;
  onVerifySurvey?: (parcelId: string) => void;
};

export default function LaParcelsTable({
  parcels,
  canUpdate = false,
  verifyingParcelId = null,
  onVerifySurvey,
}: Props) {
  const showActions = Boolean(canUpdate && onVerifySurvey);

  return (
    <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
      <Table size="small" sx={dataTableSx} stickyHeader>
        <TableHead>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableCell key={col.key} align={col.align ?? 'left'}>{col.label}</TableCell>
            ))}
            {showActions && <TableCell align="right">Action</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {parcels.map((p) => {
            const parcelId = String(p.id);
            const status = String(p.status ?? 'identified');
            const needsSurvey = status === 'identified';

            return (
              <TableRow key={parcelId}>
                {COLUMNS.map((col) => {
                  const raw = p[col.key];
                  if (col.key === 'status') {
                    return (
                      <TableCell key={col.key}>
                        <Chip
                          size="small"
                          label={parcelStatusLabel(status)}
                          color={parcelStatusColor(status)}
                          variant={needsSurvey ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                    );
                  }
                  const text = col.format ? col.format(raw) : String(raw ?? '—');
                  return (
                    <TableCell key={col.key} align={col.align ?? 'left'}>{text}</TableCell>
                  );
                })}
                {showActions && (
                  <TableCell align="right">
                    {needsSurvey ? (
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<VerifiedOutlinedIcon />}
                        disabled={verifyingParcelId === parcelId}
                        onClick={() => onVerifySurvey!(parcelId)}
                      >
                        Verify Survey
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {!parcels.length && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + (showActions ? 1 : 0)} align="center">
                <Typography variant="body2" color="text.secondary" py={2}>
                  Run <strong>Identify Parcels</strong> after tracing alignment. Import khasra polygons as{' '}
                  <strong>khasra_boundary</strong> or <strong>la_parcels</strong> with owner and land attributes.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export { COLUMNS as LA_PARCEL_TABLE_COLUMNS };
