import {
  Box, Button, Card, CardContent, Chip, Divider, Stack, Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SendIcon from '@mui/icons-material/Send';
import DprBoqProgressCell from './DprBoqProgressCell';
import DprTableQtyCell from './DprTableQtyCell';
import DprWorkItemCell from './DprWorkItemCell';

type DprMobileCardProps = {
  dprNumber: string;
  reportDate: string;
  location: string;
  chainage: string;
  itemCode?: string;
  workItem: string;
  unit: string;
  plannedQty: number | null;
  previousQty: number | null;
  todayQty: number | null;
  balanceQty: number | null;
  cumQty: number | null;
  cumPct: number | null;
  contractor?: string;
  supervisor?: string;
  weather?: string;
  status: string;
  statusLabel: string;
  statusColor?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  isEditable: boolean;
  canSubmit: boolean;
  onView: () => void;
  onEdit?: () => void;
  onSubmit?: () => void;
  approvalSlot?: React.ReactNode;
};

function QtyRow({ label, value, variant }: { label: string; value: number | null; variant?: 'today' | 'balance' }) {
  return (
    <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block" noWrap>
        {label}
      </Typography>
      <DprTableQtyCell value={value} variant={variant} />
    </Box>
  );
}

export default function DprMobileCard({
  dprNumber,
  reportDate,
  location,
  chainage,
  itemCode,
  workItem,
  unit,
  plannedQty,
  previousQty,
  todayQty,
  balanceQty,
  cumQty,
  cumPct,
  contractor,
  supervisor,
  weather,
  status,
  statusLabel,
  statusColor = 'default',
  isEditable,
  canSubmit,
  onView,
  onEdit,
  onSubmit,
  approvalSlot,
}: DprMobileCardProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} mb={1}>
          <Box minWidth={0}>
            <Typography variant="subtitle2" fontWeight={800}>
              DPR #{dprNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {reportDate}
            </Typography>
          </Box>
          <Chip size="small" label={statusLabel} color={statusColor} />
        </Stack>

        <Typography variant="body2" color="text.secondary" mb={0.75}>
          {location} · {chainage}
        </Typography>

        <Box mb={1}>
          <DprWorkItemCell itemCode={itemCode} description={workItem} />
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
          <Chip size="small" label={unit} variant="outlined" />
          {weather ? <Chip size="small" label={weather} variant="outlined" /> : null}
        </Stack>

        <Stack direction="row" spacing={0.5} mb={1}>
          <QtyRow label="Planned" value={plannedQty} />
          <QtyRow label="Previous" value={previousQty} />
          <QtyRow label="Today" value={todayQty} variant="today" />
          <QtyRow label="Balance" value={balanceQty} variant="balance" />
        </Stack>

        <Box mb={1}>
          <DprBoqProgressCell plannedQty={plannedQty} cumQty={cumQty} cumPct={cumPct} />
        </Box>

        <Typography variant="caption" color="text.secondary" display="block">
          {contractor ?? '—'} · Supervisor: {supervisor ?? '—'}
        </Typography>

        <Divider sx={{ my: 1.25 }} />

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="text" startIcon={<VisibilityIcon fontSize="small" />} onClick={onView}>
            View
          </Button>
          {canSubmit && isEditable && onEdit && (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              onClick={onEdit}
            >
              Edit
            </Button>
          )}
          {canSubmit && isEditable && onSubmit && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<SendIcon fontSize="small" />}
              onClick={onSubmit}
            >
              {status === 'rejected' ? 'Resubmit' : 'Submit to JE'}
            </Button>
          )}
          {approvalSlot}
        </Stack>
      </CardContent>
    </Card>
  );
}
