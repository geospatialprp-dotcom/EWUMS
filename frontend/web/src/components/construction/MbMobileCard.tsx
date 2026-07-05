import {
  Box, Button, Card, CardContent, Chip, Divider, Stack, Tooltip, Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SendIcon from '@mui/icons-material/Send';
import DprWorkItemCell from './DprWorkItemCell';

type MbMobileCardProps = {
  mbNumber: string;
  measurementDate: string;
  workItem: string;
  itemCode?: string;
  extraEntryCount?: number;
  chainage: string;
  qty: string;
  coordinates: string;
  status: string;
  statusLabel: string;
  statusColor?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  isEditable: boolean;
  canCreate: boolean;
  onView: () => void;
  onEdit?: () => void;
  onSubmit?: () => void;
  verifySlot?: React.ReactNode;
};

export default function MbMobileCard({
  mbNumber,
  measurementDate,
  workItem,
  itemCode,
  extraEntryCount = 0,
  chainage,
  qty,
  coordinates,
  status,
  statusLabel,
  statusColor = 'default',
  isEditable,
  canCreate,
  onView,
  onEdit,
  onSubmit,
  verifySlot,
}: MbMobileCardProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} mb={1}>
          <Box minWidth={0}>
            <Typography variant="subtitle2" fontWeight={800}>
              MB #{mbNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {measurementDate}
            </Typography>
          </Box>
          <Chip size="small" label={statusLabel} color={statusColor} />
        </Stack>

        <Box sx={{ mb: 0.75 }}>
          <DprWorkItemCell
            itemCode={itemCode}
            description={workItem}
            extraLineCount={extraEntryCount}
            lineClamp={3}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.75} noWrap>
          Chainage: {chainage}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1}>
          <Chip size="small" label={`Qty ${qty}`} variant="outlined" />
          {coordinates !== '—' && (
            <Tooltip title={coordinates}>
              <Chip
                size="small"
                label={coordinates}
                variant="outlined"
                sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
              />
            </Tooltip>
          )}
        </Stack>

        <Divider sx={{ my: 1.25 }} />

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
          <Button size="small" variant="text" startIcon={<VisibilityIcon fontSize="small" />} onClick={onView}>
            View
          </Button>
          {canCreate && isEditable && onEdit && (
            <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={onEdit}>
              Edit
            </Button>
          )}
          {canCreate && isEditable && onSubmit && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<SendIcon fontSize="small" />}
              onClick={onSubmit}
            >
              {status === 'rejected' ? 'Resubmit' : 'Submit'}
            </Button>
          )}
          {verifySlot}
        </Stack>
      </CardContent>
    </Card>
  );
}
