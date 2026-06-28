import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Grid, LinearProgress,
  Table, TableBody, TableCell, TableRow, TextField, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { constructionApi } from '../../services/api';
import { formatApiError } from '../../utils/apiError';
import ConstructionStyledTableHead, {
  constructionSectionBarSx, constructionTableShellSx, constructionTableTheme,
} from './ConstructionStyledTableHead';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { parseBilingualText, serializeBilingualText } from '../../utils/bilingualText';

type VerificationItem = {
  key: string;
  label: string;
  auto: boolean;
  passed: boolean;
  pct?: number;
  detail: string;
};

type Certificate = {
  title: string;
  reference: string;
  date: string;
  text: string;
};

interface Props {
  projectId: string;
  canVerify: boolean;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

function formatMoney(n: number) {
  return `₹${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatQty(n: number) {
  return Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export default function FinalBillPanel({
  projectId, canVerify, onRefresh, onError, onSuccess,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [verification, setVerification] = useState<VerificationItem[]>([]);
  const [allVerified, setAllVerified] = useState(false);
  const [finalBillStatus, setFinalBillStatus] = useState('pending');
  const [outputs, setOutputs] = useState<Record<string, unknown> | null>(null);
  const [verifyForm, setVerifyForm] = useState({
    asBuiltVerified: false,
    reservoirCommissioned: false,
    pumpingCommissioned: false,
  });
  const [savingVerify, setSavingVerify] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    invoiceNumber: `FINAL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    recoveries: 0,
    remarks: 'Final Bill — project completion',
  });

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await constructionApi.finalBillPreparation(projectId);
      const completion = data.completion as Record<string, unknown>;
      setVerification((data.verification ?? []) as VerificationItem[]);
      setAllVerified(Boolean(data.allVerified));
      setFinalBillStatus(String(completion.finalBillStatus ?? 'pending'));
      setOutputs((data.outputs as Record<string, unknown> | null) ?? null);
      setVerifyForm({
        asBuiltVerified: Boolean(completion.asBuiltVerified),
        reservoirCommissioned: Boolean(completion.reservoirCommissioned),
        pumpingCommissioned: Boolean(completion.pumpingCommissioned),
      });
    } catch (err) {
      setLoadError(formatApiError(err, 'Failed to load final bill preparation.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const handleSaveVerification = async () => {
    setSavingVerify(true);
    try {
      await constructionApi.verifyCompletion(projectId, verifyForm);
      onSuccess('Completion verification saved.');
      await load();
      await onRefresh();
    } catch (err) {
      onError(formatApiError(err, 'Failed to save verification.'));
    } finally {
      setSavingVerify(false);
    }
  };

  const handleGenerate = async () => {
    if (!generateForm.invoiceNumber.trim()) {
      onError('Final bill invoice number is required.');
      return;
    }
    setGenerating(true);
    try {
      await constructionApi.generateFinalBill(projectId, {
        invoiceNumber: generateForm.invoiceNumber.trim(),
        recoveries: Number(generateForm.recoveries) || 0,
        remarks: generateForm.remarks.trim() || undefined,
      });
      onSuccess('Final bill package generated successfully.');
      setGenerateOpen(false);
      await load();
      await onRefresh();
    } catch (err) {
      onError(formatApiError(err, 'Failed to generate final bill.'));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LinearProgress sx={{ my: 2 }} />;
  if (loadError) return <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>;

  const finalMbRegister = (outputs?.finalMbRegister ?? []) as Array<Record<string, unknown>>;
  const finalQuantityStatement = (outputs?.finalQuantityStatement ?? []) as Array<Record<string, unknown>>;
  const finalBill = outputs?.finalBill as Record<string, unknown> | null;
  const completionCert = outputs?.completionCertificate as Certificate | null;
  const handoverCert = outputs?.handoverCertificate as Certificate | null;
  const totals = outputs?.totals as Record<string, number> | undefined;
  const raReleasedTotal = Number(outputs?.raReleasedTotal ?? 0);
  const generated = finalBillStatus === 'generated';

  return (
    <Box>
      <Box sx={constructionSectionBarSx('final')} mb={2}>
        <Typography variant="h6" fontWeight={700} color={constructionTableTheme('final').headerColor}>
          Stage 7: Final Bill Preparation
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Completion Verification
              </Typography>
              {verification.map((item) => (
                <Box key={item.key} display="flex" alignItems="flex-start" gap={1} py={1}
                  borderBottom={1} borderColor="divider">
                    {item.passed
                      ? <CheckCircleIcon color="success" fontSize="small" sx={{ mt: 0.25 }} />
                      : <RadioButtonUncheckedIcon color="disabled" fontSize="small" sx={{ mt: 0.25 }} />}
                    <Box flex={1}>
                      <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {item.detail}
                        {item.pct != null ? ` (${item.pct}%)` : ''}
                        {item.auto ? ' · Auto-checked' : ' · EE verifies'}
                      </Typography>
                    </Box>
                  </Box>
                ))}

              {canVerify && !generated && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    EE manual verification
                  </Typography>
                  <FormControlLabel
                    control={<Checkbox checked={verifyForm.asBuiltVerified}
                      onChange={(e) => setVerifyForm((p) => ({ ...p, asBuiltVerified: e.target.checked }))} />}
                    label="As-Built Drawings verified"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={verifyForm.reservoirCommissioned}
                      onChange={(e) => setVerifyForm((p) => ({ ...p, reservoirCommissioned: e.target.checked }))} />}
                    label="Reservoir system commissioned"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={verifyForm.pumpingCommissioned}
                      onChange={(e) => setVerifyForm((p) => ({ ...p, pumpingCommissioned: e.target.checked }))} />}
                    label="Pumping system commissioned"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    disabled={savingVerify}
                    onClick={() => void handleSaveVerification()}
                  >
                    {savingVerify ? 'Saving…' : 'Save Verification'}
                  </Button>
                </>
              )}

              <Box mt={2}>
                {allVerified
                  ? <Chip label="All verifications passed" color="success" size="small" />
                  : <Chip label="Complete all verifications to generate final bill" color="warning" size="small" />}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Generate Final Package
              </Typography>
              {generated ? (
                <Chip label="Final bill generated" color="success" icon={<DescriptionOutlinedIcon />} />
              ) : (
                <Button
                  variant="contained"
                  disabled={!allVerified || !canVerify}
                  onClick={() => setGenerateOpen(true)}
                >
                  Generate Final Bill Package
                </Button>
              )}
              {!canVerify && !generated && (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  EE approval required.
                </Typography>
              )}
              {totals && (
                <Box mt={2}>
                  <Typography variant="caption" color="text.secondary">
                    Contract value: {formatMoney(totals.contractValue ?? 0)}
                    {' · '}MB value: {formatMoney(totals.mbValue ?? 0)}
                    {' · '}RA released: {formatMoney(raReleasedTotal)}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {generated && outputs && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight={700}>Generated Outputs</Typography>
            </Grid>

            {finalBill && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Final Bill</Typography>
                  <Typography variant="body2">Invoice: {String(finalBill.invoiceNumber)}</Typography>
                  <Typography variant="body2">Gross: {formatMoney(Number(finalBill.grossAmount))}</Typography>
                  <Typography variant="body2">GST: {formatMoney(Number(finalBill.gstAmount))}</Typography>
                  <Typography variant="body2" fontWeight={600}>Net: {formatMoney(Number(finalBill.netAmount))}</Typography>
                  <Chip size="small" label={String(finalBill.status)} sx={{ mt: 1 }} />
                </CardContent></Card>
              </Grid>
            )}

            {completionCert && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Completion Certificate</Typography>
                  <Typography variant="caption" color="text.secondary">{completionCert.reference}</Typography>
                  <Typography variant="body2" mt={1}>{completionCert.text}</Typography>
                </CardContent></Card>
              </Grid>
            )}

            {handoverCert && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Handover Certificate</Typography>
                  <Typography variant="caption" color="text.secondary">{handoverCert.reference}</Typography>
                  <Typography variant="body2" mt={1}>{handoverCert.text}</Typography>
                </CardContent></Card>
              </Grid>
            )}

            <Grid item xs={12} md={6}>
              <Card variant="outlined"><CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Final Measurement Book Register</Typography>
                <Table size="small" sx={constructionTableShellSx('final')}>
                  <ConstructionStyledTableHead stage="final">
                    <TableCell>MB #</TableCell><TableCell>Date</TableCell>
                    <TableCell>Scheme</TableCell><TableCell align="right">Entries</TableCell>
                  </ConstructionStyledTableHead>
                  <TableBody>
                    {finalMbRegister.map((mb, i) => (
                      <TableRow key={i}>
                        <TableCell>{String(mb.mbNumber)}</TableCell>
                        <TableCell>{String(mb.measurementDate ?? '—')}</TableCell>
                        <TableCell>{String(mb.schemeType ?? '—')}</TableCell>
                        <TableCell align="right">{Number(mb.entryCount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined"><CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Final Quantity Statement</Typography>
                <Table size="small" sx={{ maxHeight: 280, display: 'block', overflow: 'auto', ...constructionTableShellSx('final') }}>
                  <ConstructionStyledTableHead stage="final">
                    <TableCell>Item</TableCell><TableCell align="right">Contract</TableCell>
                    <TableCell align="right">MB Qty</TableCell><TableCell align="right">MB Value</TableCell>
                  </ConstructionStyledTableHead>
                  <TableBody>
                    {finalQuantityStatement.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Typography variant="caption" fontWeight={600}>{String(row.itemCode)}</Typography>
                          <Typography variant="caption" display="block" color="text.secondary" noWrap>
                            {String(row.description)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatQty(Number(row.contractQty))}</TableCell>
                        <TableCell align="right">{formatQty(Number(row.mbQty))}</TableCell>
                        <TableCell align="right">{formatMoney(Number(row.mbValue))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </Grid>
          </>
        )}
      </Grid>

      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Generate Final Bill Package</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth margin="dense" required label="Final Bill Invoice Number"
            value={generateForm.invoiceNumber}
            onChange={(e) => setGenerateForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
          />
          <TextField
            fullWidth margin="dense" type="number" label="Recoveries / Deductions (₹)"
            value={generateForm.recoveries}
            onChange={(e) => setGenerateForm((p) => ({ ...p, recoveries: Number(e.target.value) }))}
            inputProps={{ min: 0, step: 1000 }}
          />
          <BilingualRemarkField
            label="Remarks"
            pdfTitle="Final Bill Remarks"
            value={parseBilingualText(generateForm.remarks)}
            onChange={(v) => setGenerateForm((p) => ({ ...p, remarks: serializeBilingualText(v) }))}
            minRows={2}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={generating} onClick={() => void handleGenerate()}>
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
