import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, Divider, Grid, Paper, Typography,
} from '@mui/material';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import type { ReactNode } from 'react';
import DprPhotoGallery from './DprPhotoGallery';
import { mbWorkflowStepLabel, STATUS_COLORS } from '../../constants/construction';
import { constructionTableTheme } from '../../utils/constructionTableStyles';
import { formatCurrency, formatQty } from '../../utils/boqReconciliation';
import { mbEntryLineAmount, parseMbRemarks } from '../../utils/mbForm';

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%', borderColor: 'divider', bgcolor: 'grey.50' }}>
      <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.4}>
          {label}
        </Typography>
      </Box>
      <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Paper>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

type MbDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  mb: Record<string, unknown> | null;
  workPackageLabel?: string;
  linkedDprLabel?: string;
  onEdit?: () => void;
  canEdit?: boolean;
};

export default function MbDetailDialog({
  open, onClose, projectId, mb, workPackageLabel, linkedDprLabel, onEdit, canEdit,
}: MbDetailDialogProps) {
  const theme = constructionTableTheme('mb');
  const status = String(mb?.status ?? 'draft');
  const entries = (mb?.entries as Array<Record<string, unknown>>) ?? [];
  const documents = (mb?.documents as Array<Record<string, unknown>>) ?? [];
  const remarks = parseMbRemarks(mb?.remarks as string | undefined);
  const totalAmount = entries.reduce((sum, e) => sum + mbEntryLineAmount(e), 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <Box sx={{ px: 3, py: 2, background: theme.panelBg, borderBottom: `2px solid ${theme.panelBorder}` }}>
        <Typography variant="overline" color={theme.headerColor} fontWeight={700} letterSpacing={1}>
          Measurement Book — Site Inspection
        </Typography>
        <Typography variant="h6" fontWeight={700} color={theme.headerColor}>
          MB {String(mb?.mbNumber ?? '—')}
          <Typography component="span" variant="body1" fontWeight={500} color="text.secondary" sx={{ ml: 1 }}>
            {String(mb?.measurementDate ?? '')}
          </Typography>
        </Typography>
        {mb && (
          <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
            <Chip
              size="small"
              label={String(mb.schemeType).replace(/_/g, ' ')}
              sx={{ textTransform: 'capitalize', fontWeight: 600 }}
            />
            <Chip
              size="small"
              label={mbWorkflowStepLabel(status)}
              color={STATUS_COLORS[status] ?? 'default'}
              sx={{ fontWeight: 600 }}
            />
            {entries.length > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`${entries.length} item${entries.length === 1 ? '' : 's'}`}
                sx={{ fontWeight: 600, borderColor: theme.panelBorder }}
              />
            )}
          </Box>
        )}
      </Box>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        {mb && (
          <Box display="flex" flexDirection="column" gap={2.5}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <InfoTile icon={<LocationOnOutlinedIcon fontSize="small" />} label="Site" value={String(mb.siteAddress ?? '—')} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoTile icon={<CategoryOutlinedIcon fontSize="small" />} label="Scheme" value={String(mb.schemeType ?? '—').replace(/_/g, ' ')} />
              </Grid>
              {workPackageLabel && (
                <Grid item xs={12} sm={6}>
                  <InfoTile icon={<Inventory2OutlinedIcon fontSize="small" />} label="Work Package" value={workPackageLabel} />
                </Grid>
              )}
              {linkedDprLabel && (
                <Grid item xs={12} sm={6}>
                  <InfoTile icon={<LinkOutlinedIcon fontSize="small" />} label="Linked DPR" value={linkedDprLabel} />
                </Grid>
              )}
            </Grid>

            {(remarks.quality || remarks.material || remarks.general) && (
              <Box>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Verification</Typography>
                <Grid container spacing={1.5}>
                  {remarks.quality && (
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderLeft: `4px solid ${theme.accent}`, bgcolor: '#fff' }}>
                        <Box display="flex" alignItems="center" gap={0.75} mb={0.75}>
                          <VerifiedOutlinedIcon fontSize="small" color="success" />
                          <Typography variant="subtitle2" fontWeight={700}>Quality</Typography>
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{remarks.quality}</Typography>
                      </Paper>
                    </Grid>
                  )}
                  {remarks.material && (
                    <Grid item xs={12} md={6}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderLeft: `4px solid ${theme.accent}`, bgcolor: '#fff' }}>
                        <Box display="flex" alignItems="center" gap={0.75} mb={0.75}>
                          <ScienceOutlinedIcon fontSize="small" color="success" />
                          <Typography variant="subtitle2" fontWeight={700}>Material</Typography>
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{remarks.material}</Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
                {remarks.general && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, whiteSpace: 'pre-wrap' }}>
                    {remarks.general}
                  </Typography>
                )}
              </Box>
            )}

            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={1.5} flexWrap="wrap" gap={1}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Measured Work Items
                  <Typography component="span" variant="body2" color="text.secondary" fontWeight={500} sx={{ ml: 1 }}>
                    ({entries.length})
                  </Typography>
                </Typography>
                {totalAmount > 0 && (
                  <Typography variant="subtitle2" fontWeight={700} color={theme.headerColor}>
                    Total {formatCurrency(totalAmount)}
                  </Typography>
                )}
              </Box>

              <Box display="flex" flexDirection="column" gap={1.5}>
                {entries.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No measurement entries recorded.</Typography>
                )}
                {entries.map((e, idx) => {
                  const dims = [e.lengthM, e.widthM, e.depthM].filter((v) => v != null && String(v).trim() !== '');
                  const chainage = [e.chainageFrom, e.chainageTo].filter(Boolean).join(' → ') || '—';
                  const gps = e.latitude != null && e.longitude != null
                    ? `${e.latitude}, ${e.longitude}`
                    : '—';
                  const amount = mbEntryLineAmount(e);
                  return (
                    <Paper
                      key={String(e.id ?? idx)}
                      variant="outlined"
                      sx={{ p: 2, borderLeft: `4px solid ${theme.accent}`, bgcolor: '#fff' }}
                    >
                      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                        {idx + 1}. {String(e.description)}
                      </Typography>
                      {e.itemCode && (
                        <Chip size="small" label={String(e.itemCode)} sx={{ mb: 1.25, fontWeight: 700 }} />
                      )}
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <MetaChip label="Quantity" value={`${formatQty(Number(e.measuredQty ?? 0))} ${String(e.unit ?? '')}`} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <MetaChip label="L1 Rate" value={formatCurrency(Number(e.rate ?? 0))} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <MetaChip label="Amount" value={formatCurrency(amount)} />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <MetaChip label="Chainage" value={chainage} />
                        </Grid>
                        {dims.length > 0 && (
                          <Grid item xs={12} sm={6}>
                            <Box display="flex" alignItems="flex-start" gap={0.75}>
                              <StraightenOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />
                              <MetaChip label="L × W × D (m)" value={dims.join(' × ')} />
                            </Box>
                          </Grid>
                        )}
                        {gps !== '—' && (
                          <Grid item xs={12} sm={6}>
                            <Box display="flex" alignItems="flex-start" gap={0.75}>
                              <MyLocationOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />
                              <MetaChip label="GPS" value={gps} />
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </Paper>
                  );
                })}
              </Box>
            </Box>

            {documents.length > 0 && (
              <>
                <Divider />
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Geo-tagged Photographs</Typography>
                <DprPhotoGallery projectId={projectId} documents={documents} />
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {canEdit && onEdit && (
          <Button variant="outlined" onClick={onEdit}>Edit</Button>
        )}
        <Box flex={1} />
        <Button variant="contained" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
