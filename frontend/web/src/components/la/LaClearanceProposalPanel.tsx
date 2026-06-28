import {
  Box, Chip, Grid, LinearProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type ClearanceProposal = {
  id?: string;
  proposalNo?: string;
  title?: string;
  status?: string;
  package?: {
    generatedAt?: string;
    clearancesRequired?: Array<{
      code: string;
      label: string;
      authority: string;
      count: number;
      approvalStatus: string;
    }>;
    checklist?: Array<{
      clearanceCode: string;
      clearanceLabel: string;
      item: string;
      completed: boolean;
    }>;
    forms?: Array<{
      code: string;
      name: string;
      clearanceCode: string;
      clearanceLabel: string;
      status: string;
    }>;
    documents?: Array<{
      code: string;
      name: string;
      clearanceCode: string;
      clearanceLabel: string;
      status: string;
    }>;
    approvalSummary?: {
      total: number;
      approved: number;
      pending: number;
      applied: number;
    };
  };
};

function statusColor(status?: string): 'default' | 'success' | 'warning' | 'info' {
  if (status === 'approved') return 'success';
  if (status === 'applied' || status === 'submitted') return 'info';
  if (status === 'required' || status === 'pending') return 'warning';
  return 'default';
}

export default function LaClearanceProposalPanel({ proposal }: { proposal: ClearanceProposal | null | undefined }) {
  if (!proposal?.package) {
    return (
      <Typography variant="body2" color="text.secondary" py={1}>
        Run Detect Clearances to auto-generate the statutory clearance proposal, checklist, forms, and documents.
      </Typography>
    );
  }

  const pkg = proposal.package;
  const summary = pkg.approvalSummary;
  const progress = summary && summary.total > 0
    ? Math.round((summary.approved / summary.total) * 100)
    : 0;

  return (
    <Box mb={3}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1} mb={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>{proposal.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {proposal.proposalNo} · Generated {pkg.generatedAt ? new Date(pkg.generatedAt).toLocaleString('en-IN') : '—'}
          </Typography>
        </Box>
        <Chip size="small" label={proposal.status ?? 'draft'} color={statusColor(proposal.status)} />
      </Box>

      {summary && (
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="caption" color="text.secondary">Approval progress</Typography>
            <Typography variant="caption">{summary.approved}/{summary.total} approved</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 1 }} />
          <Box display="flex" gap={1} mt={1} flexWrap="wrap">
            <Chip size="small" variant="outlined" label={`${summary.pending} pending`} color="warning" />
            <Chip size="small" variant="outlined" label={`${summary.applied} applied`} color="info" />
            <Chip size="small" variant="outlined" label={`${summary.approved} approved`} color="success" />
          </Box>
        </Box>
      )}

      <Grid container spacing={2} mb={2}>
        {(pkg.clearancesRequired ?? []).map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c.code}>
            <Box p={1.5} border={1} borderColor="divider" borderRadius={1}>
              <Typography variant="body2" fontWeight={600}>{c.label}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">{c.authority}</Typography>
              <Box display="flex" gap={0.5} mt={0.5}>
                <Chip size="small" label={`×${c.count}`} variant="outlined" />
                <Chip size="small" label={c.approvalStatus} color={statusColor(c.approvalStatus)} />
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={0.5}>
        <CheckCircleOutlineIcon fontSize="small" /> Checklist
      </Typography>
      <TableContainer sx={{ mb: 2, maxHeight: 220 }}>
        <Table size="small" stickyHeader sx={dataTableSx}>
          <TableHead>
            <TableRow>
              <TableCell>Clearance</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(pkg.checklist ?? []).map((row, i) => (
              <TableRow key={`${row.clearanceCode}-${i}`}>
                <TableCell>{row.clearanceLabel}</TableCell>
                <TableCell>{row.item}</TableCell>
                <TableCell>
                  <Chip size="small" label={row.completed ? 'Done' : 'Pending'} color={row.completed ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={0.5}>
            <AssignmentOutlinedIcon fontSize="small" /> Required Forms
          </Typography>
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Form</TableCell>
                  <TableCell>Clearance</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(pkg.forms ?? []).map((f) => (
                  <TableRow key={`${f.clearanceCode}-${f.code}`}>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>{f.clearanceLabel}</TableCell>
                    <TableCell><Chip size="small" label={f.status} color={statusColor(f.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={0.5}>
            <DescriptionOutlinedIcon fontSize="small" /> Required Documents
          </Typography>
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell>Clearance</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(pkg.documents ?? []).map((d) => (
                  <TableRow key={`${d.clearanceCode}-${d.code}`}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{d.clearanceLabel}</TableCell>
                    <TableCell><Chip size="small" label={d.status} color={statusColor(d.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
}
