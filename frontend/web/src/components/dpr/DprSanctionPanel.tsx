import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  Divider, LinearProgress, TextField, Typography,
} from '@mui/material';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import DprLaReadinessChip from '../la/DprLaReadinessChip';
import type { LaReadiness } from '../../constants/laAcquisition';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type Attachment = { key: string; label: string; required: boolean; attached: boolean };

type Stage8Readiness = {
  canRecord?: boolean;
  canUploadDocuments?: boolean;
  sanctioned?: boolean;
  attachments?: Attachment[];
  missingDocuments?: string[];
  preliminaryEstimate?: number | null;
  fundingSource?: string | null;
  sanction?: {
    administrativeApprovalNo?: string | null;
    expenditureSanctionNo?: string | null;
    sanctionedAmount?: number | null;
    budgetHead?: string | null;
    sanctionDate?: string | null;
    fundingReleaseRef?: string | null;
    recordedAt?: string;
  } | null;
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  stage8Readiness?: Stage8Readiness & { laReadiness?: LaReadiness; laMissingActions?: string[] } | null;
  laReadiness?: LaReadiness;
  documentSlots?: Array<{
    documentType: string;
    label: string;
    document: { id: string; fileName?: string | null } | null;
  }>;
};

const SANCTION_DOC_TYPES = [
  { type: 'sanction_aa', label: 'Administrative Approval (AA)' },
  { type: 'sanction_es', label: 'Expenditure Sanction (ES)' },
  { type: 'sanction_budget_allocation', label: 'Budget Allocation Order' },
  { type: 'funding_release_order', label: 'Funding Release Order' },
];

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function formatInr(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

interface Props {
  open: boolean;
  proposalId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function DprSanctionPanel({ open, proposalId, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const [aaNo, setAaNo] = useState('');
  const [esNo, setEsNo] = useState('');
  const [sanctionedAmount, setSanctionedAmount] = useState('');
  const [budgetHead, setBudgetHead] = useState('');
  const [sanctionDate, setSanctionDate] = useState('');
  const [fundingReleaseRef, setFundingReleaseRef] = useState('');
  const [comments, setComments] = useState<BilingualText>(EMPTY_BILINGUAL);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState('');

  const load = useCallback(async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      const res = await dprPlanningApi.getProposal(proposalId);
      const data = res.data as ProposalDetail;
      setDetail(data);
      const s = data.stage8Readiness?.sanction;
      if (s) {
        setAaNo(s.administrativeApprovalNo ?? '');
        setEsNo(s.expenditureSanctionNo ?? '');
        setSanctionedAmount(s.sanctionedAmount != null ? String(s.sanctionedAmount) : '');
        setBudgetHead(s.budgetHead ?? '');
        setSanctionDate(s.sanctionDate ?? '');
        setFundingReleaseRef(s.fundingReleaseRef ?? '');
      } else if (data.stage8Readiness?.preliminaryEstimate) {
        setSanctionedAmount(String(data.stage8Readiness.preliminaryEstimate));
      }
    } catch (err) {
      setError(getApiError(err, 'Failed to load proposal'));
    } finally {
      setBusy(false);
    }
  }, [proposalId]);

  useEffect(() => {
    if (open && proposalId) load();
    if (!open) {
      setDetail(null);
      setError('');
      setAaNo('');
      setEsNo('');
      setSanctionedAmount('');
      setBudgetHead('');
      setSanctionDate('');
      setFundingReleaseRef('');
      setComments(EMPTY_BILINGUAL);
    }
  }, [open, proposalId, load]);

  const readiness = detail?.stage8Readiness;
  const canRecord = readiness?.canRecord === true;
  const canUpload = readiness?.canUploadDocuments === true;
  const sanctioned = readiness?.sanctioned === true;

  const slotMap = new Map((detail?.documentSlots ?? []).map((s) => [s.documentType, s]));

  const triggerUpload = (docType: string) => {
    setPendingDocType(docType);
    fileRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !proposalId || !pendingDocType) return;
    setUploadingType(pendingDocType);
    try {
      await dprPlanningApi.uploadDocumentFile(proposalId, pendingDocType, file);
      await load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Upload failed'));
    } finally {
      setUploadingType('');
      setPendingDocType('');
    }
  };

  const download = async (docId: string, fileName: string) => {
    if (!proposalId) return;
    try {
      const blob = await dprPlanningApi.fetchDocumentFile(proposalId, docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed');
    }
  };

  const submitSanction = async () => {
    if (!proposalId) return;
    if (!aaNo.trim() || !esNo.trim()) {
      setError('AA and ES sanction numbers are required');
      return;
    }
    if (!sanctionedAmount.trim() || Number(sanctionedAmount) <= 0) {
      setError('Approved sanctioned amount is required');
      return;
    }
    if (!sanctionDate.trim()) {
      setError('Sanction date is required');
      return;
    }
    if (!budgetHead.trim()) {
      setError('Budget allocation / budget head is required');
      return;
    }
    if (!fundingReleaseRef.trim()) {
      setError('Funding release order reference is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.recordAdministrativeSanction(proposalId, {
        administrativeApprovalNo: aaNo.trim(),
        expenditureSanctionNo: esNo.trim(),
        sanctionedAmount: Number(sanctionedAmount),
        budgetHead: budgetHead.trim(),
        sanctionDate: sanctionDate.trim(),
        fundingReleaseRef: fundingReleaseRef.trim(),
        comments: serializeBilingualText(comments).trim() || undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(getApiError(err, 'Failed to record administrative sanction'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={8}
        title="Administrative Sanction & Budget Approval"
        proposalNo={detail?.proposalNo}
        statusLabel={detail?.statusLabel ?? detail?.status}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detail && (
          <>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{detail.title}</Typography>
            <Chip size="small" label={detail.statusLabel ?? detail.status} sx={{ mb: 2 }} />

            <DprLaReadinessChip
              proposalId={detail.id}
              proposalTitle={detail.title}
              readiness={detail.laReadiness ?? readiness?.laReadiness}
              onNavigateAway={onClose}
            />

            {sanctioned && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Sanctioned &amp; Budget Approved</Typography>
                <Typography variant="body2">
                  AA: {readiness?.sanction?.administrativeApprovalNo ?? '—'} · ES: {readiness?.sanction?.expenditureSanctionNo ?? '—'}
                </Typography>
                <Typography variant="body2">
                  Amount: {formatInr(readiness?.sanction?.sanctionedAmount)} · Date: {readiness?.sanction?.sanctionDate ?? '—'}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Budget: {readiness?.sanction?.budgetHead ?? '—'} · Funding Release: {readiness?.sanction?.fundingReleaseRef ?? '—'}
                </Typography>
              </Alert>
            )}

            <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
              <Chip label={`DPR Estimate: ${formatInr(readiness?.preliminaryEstimate)}`} variant="outlined" />
              <Chip label={`Funding: ${readiness?.fundingSource ?? 'Not specified'}`} variant="outlined" />
            </Box>

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Sanction Document Repository
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              {(readiness?.attachments ?? SANCTION_DOC_TYPES.map((d) => ({
                key: d.type, label: d.label, required: true, attached: false,
              }))).map((att) => (
                <Chip
                  key={att.key}
                  size="small"
                  color={att.attached ? 'success' : att.required ? 'error' : 'default'}
                  variant={att.attached ? 'filled' : 'outlined'}
                  icon={att.attached ? <CheckCircleOutlineIcon /> : undefined}
                  label={`${att.label}${att.required ? ' *' : ''}`}
                  onClick={att.attached && slotMap.get(att.key)?.document
                    ? () => download(slotMap.get(att.key)!.document!.id, slotMap.get(att.key)!.document!.fileName ?? att.key)
                    : undefined}
                  sx={att.attached ? { cursor: 'pointer' } : undefined}
                />
              ))}
            </Box>

            {canUpload && (
              <>
                <input ref={fileRef} type="file" hidden onChange={onFilePicked} />
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  {SANCTION_DOC_TYPES.map((def) => (
                    <Button key={def.type} size="small" variant="outlined"
                      startIcon={<CloudUploadOutlinedIcon />}
                      disabled={!!uploadingType}
                      onClick={() => triggerUpload(def.type)}>
                      {uploadingType === def.type ? 'Uploading…' : `Upload ${def.label}`}
                    </Button>
                  ))}
                </Box>
              </>
            )}

            {sanctioned && (
              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                {SANCTION_DOC_TYPES.map((def) => {
                  const doc = slotMap.get(def.type)?.document;
                  if (!doc) return null;
                  return (
                    <Button key={def.type} size="small" variant="text" startIcon={<DownloadOutlinedIcon />}
                      onClick={() => download(doc.id, doc.fileName ?? def.type)}>
                      {def.label}
                    </Button>
                  );
                })}
              </Box>
            )}

            {canRecord && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Record Sanction Details</Typography>
                <TextField fullWidth size="small" label="Administrative Approval (AA) No. *" sx={{ mb: 2 }}
                  value={aaNo} onChange={(e) => setAaNo(e.target.value)} />
                <TextField fullWidth size="small" label="Expenditure Sanction (ES) No. *" sx={{ mb: 2 }}
                  value={esNo} onChange={(e) => setEsNo(e.target.value)} />
                <TextField fullWidth size="small" type="number" label="Approved Sanctioned Amount (₹) *" sx={{ mb: 2 }}
                  value={sanctionedAmount} onChange={(e) => setSanctionedAmount(e.target.value)}
                  helperText={`Preliminary estimate: ${formatInr(readiness?.preliminaryEstimate)}`} />
                <TextField fullWidth size="small" label="Budget Allocation / Budget Head *" sx={{ mb: 2 }}
                  value={budgetHead} onChange={(e) => setBudgetHead(e.target.value)} />
                <TextField fullWidth size="small" type="date" label="Sanction Date *" InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }} value={sanctionDate} onChange={(e) => setSanctionDate(e.target.value)} />
                <TextField fullWidth size="small" label="Funding Release Order Reference *" sx={{ mb: 2 }}
                  value={fundingReleaseRef} onChange={(e) => setFundingReleaseRef(e.target.value)} />
                <BilingualRemarkField
                  label="Sanction remarks"
                  pdfTitle="DPR Sanction Remarks"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={comments}
                  onChange={setComments}
                  minRows={2}
                  helperText="Optional"
                />
              </>
            )}

            {canRecord && (readiness?.missingDocuments?.length ?? 0) > 0 && (
              <Alert severity="warning">
                Upload required documents before recording: {(readiness?.missingDocuments ?? []).join(', ')}
              </Alert>
            )}

            {canRecord && (readiness?.laMissingActions?.length ?? 0) > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Land acquisition must be complete before sanction: {(readiness?.laMissingActions ?? []).join('; ')}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canRecord && (
          <Button variant="contained" startIcon={<AccountBalanceOutlinedIcon />}
            disabled={busy || (readiness?.missingDocuments?.length ?? 0) > 0}
            onClick={submitSanction}>
            Record Sanction — Sanctioned &amp; Budget Approved
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
