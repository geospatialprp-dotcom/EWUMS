import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, Divider, Grid, Paper, Typography,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import type { ReactNode } from 'react';
import DprPhotoGallery from './DprPhotoGallery';
import DprBoqProgressCell from './DprBoqProgressCell';
import DprTableQtyCell from './DprTableQtyCell';
import { dprWorkflowStepLabel, STATUS_COLORS } from '../../constants/construction';
import { parseDprActivityBilling } from '../../utils/dprForm';
import { constructionTableTheme } from '../../utils/constructionTableStyles';

type InfoTileProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

function InfoTile({ icon, label, value }: InfoTileProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        height: '100%',
        borderColor: 'divider',
        bgcolor: 'grey.50',
      }}
    >
      <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
        <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
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

function WorkItemMeta({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value}</Typography>
    </Box>
  );
}

type DprDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  dpr: Record<string, unknown> | null;
  onEdit?: () => void;
  canEdit?: boolean;
  canApprove?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
};

export default function DprDetailDialog({
  open, onClose, projectId, dpr, onEdit, canEdit, canApprove, onApprove, onReject,
}: DprDetailDialogProps) {
  const theme = constructionTableTheme('dpr');
  const status = String(dpr?.status ?? 'draft');
  const activities = (dpr?.activities as Array<Record<string, unknown>>) ?? [];
  const documents = (dpr?.documents as Array<Record<string, unknown>>) ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <Box
        sx={{
          px: 3,
          py: 2,
          background: theme.panelBg,
          borderBottom: `2px solid ${theme.panelBorder}`,
        }}
      >
        <Typography variant="overline" color={theme.headerColor} fontWeight={700} letterSpacing={1}>
          Daily Progress Report
        </Typography>
        <Typography variant="h6" fontWeight={700} color={theme.headerColor}>
          DPR {String(dpr?.dprNumber ?? '—')}
          <Typography component="span" variant="body1" fontWeight={500} color="text.secondary" sx={{ ml: 1 }}>
            {String(dpr?.reportDate ?? '')}
          </Typography>
        </Typography>
        {dpr && (
          <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
            <Chip
              size="small"
              label={String(dpr.schemeType).replace(/_/g, ' ')}
              sx={{ textTransform: 'capitalize', fontWeight: 600 }}
            />
            <Chip
              size="small"
              label={dprWorkflowStepLabel(status)}
              color={STATUS_COLORS[status] ?? 'default'}
              sx={{ fontWeight: 600 }}
            />
            {dpr.weather && (
              <Chip
                size="small"
                icon={<WbSunnyOutlinedIcon />}
                label={String(dpr.weather)}
                variant="outlined"
                sx={{ fontWeight: 600, borderColor: theme.panelBorder }}
              />
            )}
          </Box>
        )}
      </Box>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        {dpr && (
          <Box display="flex" flexDirection="column" gap={2.5}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <InfoTile
                  icon={<LocationOnOutlinedIcon fontSize="small" />}
                  label="Location"
                  value={String(dpr.workSite ?? '—')}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoTile
                  icon={<BusinessOutlinedIcon fontSize="small" />}
                  label="Contractor"
                  value={String(dpr.contractorName ?? '—')}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <InfoTile
                  icon={<PersonOutlineIcon fontSize="small" />}
                  label="Supervisor"
                  value={String(dpr.supervisorName ?? '—')}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <InfoTile
                  icon={<WbSunnyOutlinedIcon fontSize="small" />}
                  label="Weather"
                  value={String(dpr.weather ?? '—')}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <InfoTile
                  icon={<GroupsOutlinedIcon fontSize="small" />}
                  label="Total Manpower"
                  value={String(dpr.manpowerCount ?? 0)}
                />
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Work Items
                <Typography component="span" variant="body2" color="text.secondary" fontWeight={500} sx={{ ml: 1 }}>
                  ({activities.length})
                </Typography>
              </Typography>
              <Box display="flex" flexDirection="column" gap={1.5}>
                {activities.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No work items recorded.</Typography>
                )}
                {activities.map((act, idx) => {
                  const plannedQty = act.plannedQty != null ? Number(act.plannedQty) : null;
                  const boqCum = act.boqCumulativeQty != null ? Number(act.boqCumulativeQty) : null;
                  const billing = parseDprActivityBilling(act, plannedQty, boqCum);
                  return (
                  <Paper
                    key={String(act.id ?? idx)}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderLeft: `4px solid ${theme.accent}`,
                      bgcolor: '#fff',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      {idx + 1}. {String(act.description)}
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: 'grey.50' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} textTransform="uppercase" letterSpacing={0.5} display="block" mb={1}>
                        L1 Contractor BOQ — planned vs actual
                      </Typography>
                      <Grid container spacing={2} alignItems="flex-end">
                        <Grid item xs={4} sm={1.2}>
                          <Typography variant="caption" color="text.secondary" display="block">Planned</Typography>
                          <DprTableQtyCell value={billing.plannedQty} />
                        </Grid>
                        <Grid item xs={4} sm={1.2}>
                          <Typography variant="caption" color="text.secondary" display="block">Unit</Typography>
                          <Typography variant="body2" fontWeight={700}>{billing.unit}</Typography>
                        </Grid>
                        <Grid item xs={4} sm={1.2}>
                          <Typography variant="caption" color="text.secondary" display="block">Previous</Typography>
                          <DprTableQtyCell value={billing.previousQty} />
                        </Grid>
                        <Grid item xs={4} sm={1.2}>
                          <Typography variant="caption" color="text.secondary" display="block">Today</Typography>
                          <DprTableQtyCell value={billing.todayQty} variant="today" />
                        </Grid>
                        <Grid item xs={4} sm={1.2}>
                          <Typography variant="caption" color="text.secondary" display="block">Balance</Typography>
                          <DprTableQtyCell value={billing.remainingQty} variant="balance" />
                        </Grid>
                        <Grid item xs={4} sm={2}>
                          <Typography variant="caption" color="text.secondary" display="block">% Done</Typography>
                          <DprBoqProgressCell
                            plannedQty={billing.plannedQty}
                            cumQty={billing.cumQty}
                            cumPct={billing.cumPct}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <WorkItemMeta
                          label="Chainage"
                          value={[act.chainageFrom, act.chainageTo].filter(Boolean).join(' → ') || '—'}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <WorkItemMeta
                          label="Labour"
                          value={String(act.labourCount ?? 0)}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <WorkItemMeta
                          label="GPS"
                          value={act.latitude != null && act.longitude != null
                            ? `${act.latitude}, ${act.longitude}`
                            : '—'}
                        />
                      </Grid>
                      {Boolean(act.materialConsumption) && (
                        <Grid item xs={12} sm={6}>
                          <WorkItemMeta label="Material" value={String(act.materialConsumption)} />
                        </Grid>
                      )}
                      {Boolean(act.equipmentDetails) && (
                        <Grid item xs={12} sm={6}>
                          <Box display="flex" alignItems="flex-start" gap={0.5}>
                            <EngineeringOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
                            <WorkItemMeta label="Equipment" value={String(act.equipmentDetails)} />
                          </Box>
                        </Grid>
                      )}
                      {Boolean(act.locationDetail) && (
                        <Grid item xs={12}>
                          <Box display="flex" alignItems="flex-start" gap={0.5}>
                            <PlaceOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.25 }} />
                            <WorkItemMeta label="Site detail" value={String(act.locationDetail)} />
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
              <Box>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Geo-tagged Photographs
                </Typography>
                <DprPhotoGallery projectId={projectId} documents={documents} />
              </Box>
            )}

            {Boolean(dpr.remarks) && (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Remarks</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{String(dpr.remarks)}</Typography>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider', gap: 1 }}>
        {canEdit && onEdit && (
          <Button variant="outlined" onClick={onEdit} sx={{ mr: 'auto' }}>
            Edit DPR
          </Button>
        )}
        {canApprove && onApprove && onReject && (
          <>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={onApprove}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={onReject}
            >
              Reject
            </Button>
          </>
        )}
        <Button variant="contained" onClick={onClose} sx={{ ml: canApprove ? 0 : 'auto' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
