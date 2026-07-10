import { useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import { omApi } from '../../services/api';
import { HANDOVER_STATUS_LABELS } from '../../constants/omHandover';
import SurfaceCard from '../layout/SurfaceCard';
import OmHandoverDocuments from './OmHandoverDocuments';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type HandoverRow = {
  id: string;
  schemeName?: string;
  status?: string;
  verificationProgress?: { done: number; total: number; pct: number };
};

function verificationLabel(h: HandoverRow): string {
  const vp = h.verificationProgress;
  if (!vp) return '—';
  return `${vp.done}/${vp.total}`;
}

/** Always-visible e-DMS for submitted handovers (read-only after JE doc approval). */
export default function OmHandoverDocumentArchive({ handovers }: { handovers: HandoverRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [schemeName, setSchemeName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const archiveRows = handovers.filter((h) => {
    const s = String(h.status ?? '');
    return s && !['draft', 'rejected'].includes(s);
  });

  const openDocs = async (h: HandoverRow) => {
    setError('');
    try {
      await omApi.getHandover(String(h.id));
      setOpenId(String(h.id));
      setSchemeName(String(h.schemeName ?? 'Handover'));
      setStatus(String(h.status ?? ''));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Cannot open documents');
    }
  };

  if (!archiveRows.length) return null;

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <SurfaceCard
        cardSx={{ mt: 2 }}
        header={(
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>
              Handover Document Repository (e-DMS)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Contractor uploads and department-approved documents — available at every workflow step (JE, AE, EE).
            </Typography>
          </Box>
        )}
      >
        <TableContainer sx={{ ...dataTableSx(), maxWidth: '100%', overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Scheme</TableCell>
                <TableCell align="center">Workflow</TableCell>
                <TableCell align="center">Verifications</TableCell>
                <TableCell align="center">View documents</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {archiveRows.map((h) => (
                <TableRow key={String(h.id)} hover>
                  <TableCell sx={{ wordBreak: 'break-word' }}>{String(h.schemeName)}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={HANDOVER_STATUS_LABELS[String(h.status)] ?? String(h.status)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">{verificationLabel(h)}</TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<FolderOpenOutlinedIcon />}
                      onClick={() => openDocs(h)}
                    >
                      View docs
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SurfaceCard>

      <Dialog
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: omDialogPaperSx }}
      >
        <OmDialogHeader
          stage={1}
          title="Handover documents"
          subtitle={schemeName}
          busy={false}
        />
        <DialogContent dividers sx={omDialogContentSx}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Read-only repository. Status: <strong>{HANDOVER_STATUS_LABELS[status] ?? status}</strong>.
            {' '}Download any file; green <strong>Approved</strong> chips show documents verified by department (typically JE).
          </Alert>
          <OmHandoverDocuments
            handoverId={openId}
            locked
            readOnlyArchive
          />
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setOpenId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
