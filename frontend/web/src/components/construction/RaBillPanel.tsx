import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, IconButton, Stack, Table, TableBody, TableCell,
  TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useMemo, useState } from 'react';
import { constructionApi } from '../../services/api';
import { formatApiError } from '../../utils/apiError';
import ConstructionStyledTableHead, {
  constructionSectionBarSx, constructionTableShellSx, constructionTableTheme,
} from './ConstructionStyledTableHead';
import {
  RA_DONE_STATUSES, RA_STATUS_APPROVER, raPendingApprover, raWorkflowStepLabel,
} from '../../constants/construction';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { parseBilingualText, serializeBilingualText } from '../../utils/bilingualText';

export interface RaBillLine {
  id?: string;
  description: string;
  unit: string;
  boqRate: number;
  previousQty: number;
  currentQty: number;
  totalQty: number;
  amount?: number;
}

export interface RaBillRecord {
  id: string;
  raNumber: string;
  raSequence: number;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  status: string;
  grossAmount: number;
  previousAmount: number;
  recoveries: number;
  gstAmount: number;
  netPayable: number;
  remarks?: string | null;
  lines?: RaBillLine[];
}

interface Props {
  projectId: string;
  raBills: RaBillRecord[];
  ratesFromL1Boq?: boolean;
  roles: string[];
  canGenerate: boolean;
  canApprove: boolean;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

function formatMoney(n: number) {
  return `₹${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatQty(n: number) {
  return Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function StatusChip({ status }: { status: string }) {
  const color = status === 'finance_released' ? 'success'
    : status === 'rejected' ? 'error'
    : status === 'draft' ? 'default'
    : 'warning';
  return <Chip size="small" label={raWorkflowStepLabel(status)} color={color} />;
}

export default function RaBillPanel({
  projectId, raBills, ratesFromL1Boq, roles, canGenerate, canApprove, onRefresh, onError,
}: Props) {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailBill, setDetailBill] = useState<RaBillRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [form, setForm] = useState({
    raNumber: '',
    billingPeriodFrom: new Date().toISOString().slice(0, 10),
    billingPeriodTo: new Date().toISOString().slice(0, 10),
    recoveries: 0,
    gstPercent: 18,
    remarks: '',
  });

  const nextRaNumber = useMemo(
    () => `RA-${String(raBills.length + 1).padStart(3, '0')}`,
    [raBills.length],
  );

  const openGenerate = () => {
    setForm({
      raNumber: nextRaNumber,
      billingPeriodFrom: new Date().toISOString().slice(0, 10),
      billingPeriodTo: new Date().toISOString().slice(0, 10),
      recoveries: 0,
      gstPercent: 18,
      remarks: '',
    });
    setGenerateOpen(true);
  };

  const handleGenerate = async () => {
    try {
      await constructionApi.generateRaBill(projectId, {
        raNumber: form.raNumber,
        billingPeriodFrom: form.billingPeriodFrom,
        billingPeriodTo: form.billingPeriodTo,
        recoveries: form.recoveries,
        remarks: form.remarks || undefined,
      });
      setGenerateOpen(false);
      await onRefresh();
    } catch (err) {
      onError(formatApiError(err, 'Failed to generate RA Bill.'));
    }
  };

  const viewDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const { data } = await constructionApi.getRaBill(projectId, id);
      setDetailBill(data as RaBillRecord);
    } catch (err) {
      onError(formatApiError(err, 'Failed to load RA Bill detail.'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const submitBill = async (id: string) => {
    try {
      await constructionApi.submitRaBill(projectId, id);
      await onRefresh();
    } catch (err) {
      onError(formatApiError(err, 'Failed to submit RA Bill.'));
    }
  };

  const workflowAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await constructionApi.raBillWorkflow(projectId, id, { action });
      if (detailBill?.id === id) {
        const { data } = await constructionApi.getRaBill(projectId, id);
        setDetailBill(data as RaBillRecord);
      }
      await onRefresh();
    } catch (err) {
      onError(formatApiError(err, `Failed to ${action} RA Bill.`));
    }
  };

  const deleteBill = async (id: string) => {
    try {
      await constructionApi.deleteRaBill(projectId, id);
      if (detailBill?.id === id) setDetailBill(null);
      await onRefresh();
    } catch (err) {
      onError(formatApiError(err, 'Failed to delete RA Bill.'));
    }
  };

  const RaActions = ({ bill }: { bill: RaBillRecord }) => {
    const status = bill.status;
    if (canGenerate && (status === 'draft' || status === 'rejected')) {
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button size="small" variant="contained"
            onClick={() => { void submitBill(bill.id); }}>
            {status === 'rejected' ? 'Resubmit' : 'Submit'}
          </Button>
          <Button size="small" variant="outlined" color="error"
            onClick={() => { void deleteBill(bill.id); }}>
            Delete
          </Button>
        </Stack>
      );
    }
    const approver = raPendingApprover(status);
    if (!approver || RA_DONE_STATUSES.includes(status)) return null;
    const canAct = !roles.includes('super_admin') && roles.includes(approver);
    if (!canApprove || !canAct) return null;
    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="caption" color="text.secondary">{approver.toUpperCase()}</Typography>
        <IconButton size="small" color="success" title="Approve"
          onClick={() => { void workflowAction(bill.id, 'approve'); }}>
          <CheckCircleIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" title="Reject"
          onClick={() => { void workflowAction(bill.id, 'reject'); }}>
          <CancelIcon fontSize="small" />
        </IconButton>
      </Stack>
    );
  };

  const lineTotal = (line: RaBillLine) => {
    if (line.amount != null && Number(line.amount) > 0) return Number(line.amount);
    return Number(line.currentQty) * Number(line.boqRate);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} gap={2} sx={constructionSectionBarSx('ra-bill')}>
        <Typography variant="subtitle1" fontWeight={700} color={constructionTableTheme('ra-bill').headerColor}>
          Stage 6: Running Account (RA) Bill Generation
          {ratesFromL1Boq ? ' · L1 BOQ rates' : ''}
        </Typography>
        {canGenerate && (
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={openGenerate}>
            Generate RA Bill
          </Button>
        )}
      </Box>

      <Table size="small" sx={constructionTableShellSx('ra-bill')}>
        <ConstructionStyledTableHead stage="ra-bill">
          <TableCell>RA #</TableCell>
          <TableCell>Seq</TableCell>
          <TableCell>Period</TableCell>
          <TableCell align="right">Gross (incl.)</TableCell>
          <TableCell align="right">Recoveries</TableCell>
          <TableCell align="right">GST (18/118)</TableCell>
          <TableCell align="right">Net Payable</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Actions</TableCell>
        </ConstructionStyledTableHead>
        <TableBody>
          {raBills.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} align="center">
                <Typography variant="body2" color="text.secondary" py={2}>
                  No RA bills yet.
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {raBills.map((bill) => (
            <TableRow key={bill.id} hover>
              <TableCell>{bill.raNumber}</TableCell>
              <TableCell>{bill.raSequence}</TableCell>
              <TableCell>
                {bill.billingPeriodFrom && bill.billingPeriodTo
                  ? `${String(bill.billingPeriodFrom).slice(0, 10)} – ${String(bill.billingPeriodTo).slice(0, 10)}`
                  : '—'}
              </TableCell>
              <TableCell align="right">{formatMoney(bill.grossAmount)}</TableCell>
              <TableCell align="right">{formatMoney(bill.recoveries)}</TableCell>
              <TableCell align="right">{formatMoney(bill.gstAmount)}</TableCell>
              <TableCell align="right">{formatMoney(bill.netPayable)}</TableCell>
              <TableCell><StatusChip status={bill.status} /></TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="nowrap">
                  <Button size="small" variant="text" startIcon={<VisibilityIcon fontSize="small" />}
                    disabled={loadingDetail}
                    onClick={() => { void viewDetail(bill.id); }}>
                    View
                  </Button>
                  <RaActions bill={bill} />
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Generate dialog */}
      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Running Account Bill</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField label="RA Number" required value={form.raNumber}
            onChange={(e) => setForm({ ...form, raNumber: e.target.value })} />
          <Box display="flex" gap={1}>
            <TextField type="date" label="Period From" fullWidth InputLabelProps={{ shrink: true }}
              value={form.billingPeriodFrom}
              onChange={(e) => setForm({ ...form, billingPeriodFrom: e.target.value })} />
            <TextField type="date" label="Period To" fullWidth InputLabelProps={{ shrink: true }}
              value={form.billingPeriodTo}
              onChange={(e) => setForm({ ...form, billingPeriodTo: e.target.value })} />
          </Box>
          <TextField type="number" label="Recoveries (₹)" value={form.recoveries}
            onChange={(e) => setForm({ ...form, recoveries: Number(e.target.value) })} />
          <BilingualRemarkField
            label="Remarks"
            pdfTitle="RA Bill Remarks"
            value={parseBilingualText(form.remarks)}
            onChange={(v) => setForm({ ...form, remarks: serializeBilingualText(v) })}
            minRows={2}
            fullWidth={false}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { void handleGenerate(); }}>Generate</Button>
        </DialogActions>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={Boolean(detailBill)} onClose={() => setDetailBill(null)} maxWidth="lg" fullWidth scroll="paper">
        {detailBill && (
          <>
            <DialogTitle>
              RA Bill {detailBill.raNumber} — {raWorkflowStepLabel(detailBill.status)}
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2} mb={2}>
                {[
                  ['Gross (incl. GST)', formatMoney(detailBill.grossAmount)],
                  ['GST Component (18/118)', formatMoney(detailBill.gstAmount)],
                  ['Previous Bills (Released)', formatMoney(detailBill.previousAmount)],
                  ['Recoveries', formatMoney(detailBill.recoveries)],
                  ['Net Payable', formatMoney(detailBill.netPayable)],
                ].map(([label, val]) => (
                  <Grid item xs={6} sm={4} key={String(label)}>
                    <Card variant="outlined"><CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="subtitle2" fontWeight={700}>{val}</Typography>
                    </CardContent></Card>
                  </Grid>
                ))}
              </Grid>

              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Line Items</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={constructionTableShellSx('ra-bill')}>
                  <ConstructionStyledTableHead stage="ra-bill">
                    <TableCell>SN</TableCell>
                    <TableCell>Item Description</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell align="right">BOQ Rate</TableCell>
                    <TableCell align="right">Executed Qty</TableCell>
                    <TableCell align="right">Previous Qty</TableCell>
                    <TableCell align="right">Current Qty</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </ConstructionStyledTableHead>
                  <TableBody>
                    {(detailBill.lines ?? []).map((line, idx) => (
                      <TableRow key={line.id ?? idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>{line.description}</TableCell>
                        <TableCell>{line.unit}</TableCell>
                        <TableCell align="right">{formatMoney(line.boqRate)}</TableCell>
                        <TableCell align="right">{formatQty(line.totalQty)}</TableCell>
                        <TableCell align="right">{formatQty(line.previousQty)}</TableCell>
                        <TableCell align="right">{formatQty(line.currentQty)}</TableCell>
                        <TableCell align="right">{formatMoney(lineTotal(line))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell colSpan={7} align="right"><strong>Gross (incl. GST)</strong></TableCell>
                      <TableCell align="right"><strong>{formatMoney(detailBill.grossAmount)}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              {detailBill.remarks && (
                <Typography variant="body2" mt={2} color="text.secondary">
                  Remarks: {detailBill.remarks}
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              {!RA_DONE_STATUSES.includes(detailBill.status) && raPendingApprover(detailBill.status) && (
                <>
                  <Button color="error" onClick={() => { void workflowAction(detailBill.id, 'reject'); }}>
                    Reject
                  </Button>
                  <Button variant="contained" onClick={() => { void workflowAction(detailBill.id, 'approve'); }}>
                    Approve ({RA_STATUS_APPROVER[detailBill.status]?.toUpperCase()})
                  </Button>
                </>
              )}
              <Button onClick={() => setDetailBill(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
