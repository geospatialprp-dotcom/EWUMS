import {
  Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { buildPlannedActualRows, formatProgressQty, type DprProgressSummary } from '../../utils/dprForm';

type Props = {
  hint: DprProgressSummary;
  todayQty: number;
  unit: string;
};

export default function DprPlannedVsActualPanel({ hint, todayQty, unit }: Props) {
  const rows = buildPlannedActualRows(hint, todayQty, unit);

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box px={1.5} py={1} bgcolor="grey.100" borderBottom={1} borderColor="divider">
        <Typography variant="caption" fontWeight={700} textTransform="uppercase" letterSpacing={0.5}>
          Planned vs actual — {hint.boqSourceLabel ?? 'L1 Contractor BOQ'}
        </Typography>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Planned</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Actual</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Remaining</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>% done</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.label}
              sx={row.label.startsWith('After today') ? { bgcolor: 'action.hover' } : undefined}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={row.label.includes('Job') ? 600 : 500}>
                  {row.label}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace">
                  {formatProgressQty(row.planned)} {row.unit}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                  {formatProgressQty(row.actual)} {row.unit}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace" color="warning.dark">
                  {formatProgressQty(row.remaining)} {row.unit}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace">
                  {formatProgressQty(row.pctDone)}%
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
