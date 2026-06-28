import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  Divider, FormControlLabel, FormGroup, LinearProgress, TextField, Typography,
} from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_TENDER_PREP_CHECKLIST, DPR_TENDER_PREP_DOCUMENT_TYPES } from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type Stage9Readiness = {
  canInitiate?: boolean;
  initiated?: boolean;
  canUploadPrepDocuments?: boolean;
  canTrack?: boolean;
  taskOrderNo?: string | null;
  packageNo?: string | null;
  initiatedAt?: string | null;
  divisionName?: string | null;
  divisionInstructions?: string | null;
  prepDocuments?: Array<{ key: string; label: string; attached: boolean; required: boolean }>;
  missingPrepDocuments?: string[];
  prepComplete?: boolean;
  sanction?: {
    administrativeApprovalNo?: string | null;
    expenditureSanctionNo?: string | null;
    sanctionedAmount?: number | null;
    budgetHead?: string | null;
    sanctionDate?: string | null;
  } | null;
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  stage9Readiness?: Stage9Readiness | null;
  documentSlots?: Array<{
    documentType: string;
    label: string;
    document: { id: string; fileName?: string | null } | null;
  }>;
};

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

export default function DprTenderInitiationPanel({ open, proposalId, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const [divisionInstructions, setDivisionInstructions] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [comments, setComments] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [checklist, setChecklist] = useState({
    finalBoqPrep: false,
    sorVerification: false,
    bidPackagePrep: false,
    techSpecsFinalization: false,
    tenderDocGeneration: false,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState('');

  const load = useCallback(async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      const res = await dprPlanningApi.getProposal(proposalId);
      setDetail(res.data as ProposalDetail);
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
      setDivisionInstructions(EMPTY_BILINGUAL);
      setComments(EMPTY_BILINGUAL);
      setChecklist({
        finalBoqPrep: false,
        sorVerification: false,
        bidPackagePrep: false,
        techSpecsFinalization: false,
        tenderDocGeneration: false,
      });
    }
  }, [open, proposalId, load]);

  const readiness = detail?.stage9Readiness;
  const canInitiate = readiness?.canInitiate === true;
  const initiated = readiness?.initiated === true;
  const canUpload = readiness?.canUploadPrepDocuments === true;
  const allChecked = DPR_TENDER_PREP_CHECKLIST.every((item) => checklist[item.key as keyof typeof checklist]);

  const slotMap = new Map((detail?.documentSlots ?? []).map((s) => [s.documentType, s]));

  const downloadTaskOrder = async () => {
    if (!proposalId || !detail) return;
    try {
      const blob = await dprPlanningApi.downloadTenderTaskOrder(proposalId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TPO-${detail.proposalNo.replace(/[^a-zA-Z0-9-_]/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download Task Order');
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

  const submitInitiate = async () => {
    if (!proposalId) return;
    if (!allChecked) {
      setError('Confirm all division addressal items before initiating tender preparation');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.initiateTenderPreparation(proposalId, {
        divisionInstructions: serializeBilingualText(divisionInstructions).trim() || undefined,
        comments: serializeBilingualText(comments).trim() || undefined,
        ...checklist,
      });
      onUpdated();
      await load();
    } catch (err) {
      setError(getApiError(err, 'Failed to initiate tender preparation'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={9}
        title="Tender & BOQ Initiation (HQ)"
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

            {readiness?.sanction && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Sanctioned &amp; Budget Approved</Typography>
                <Typography variant="body2">
                  AA: {readiness.sanction.administrativeApprovalNo ?? '—'} · ES: {readiness.sanction.expenditureSanctionNo ?? '—'}
                </Typography>
                <Typography variant="caption" display="block">
                  Amount: {formatInr(readiness.sanction.sanctionedAmount)} · Budget: {readiness.sanction.budgetHead ?? '—'}
                </Typography>
              </Alert>
            )}

            {initiated && readiness?.taskOrderNo && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Tender Preparation Task Order Issued</Typography>
                <Typography variant="body2">
                  {readiness.taskOrderNo} · Package: {readiness.packageNo ?? '—'}
                </Typography>
                <Typography variant="body2">
                  Division: {readiness.divisionName ?? '—'}
                </Typography>
                {readiness.initiatedAt && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Issued: {new Date(readiness.initiatedAt).toLocaleString('en-IN')}
                  </Typography>
                )}
                {readiness.divisionInstructions && (
                  <Typography variant="body2" sx={{ mt: 1 }}>{readiness.divisionInstructions}</Typography>
                )}
              </Alert>
            )}

            {initiated && (
              <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
                sx={{ mb: 2 }} onClick={downloadTaskOrder}>
                Download Task Order
              </Button>
            )}

            {canInitiate && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  HQ Addresses Concerned Division For
                </Typography>
                <FormGroup sx={{ mb: 2 }}>
                  {DPR_TENDER_PREP_CHECKLIST.map((item) => (
                    <FormControlLabel
                      key={item.key}
                      control={
                        <Checkbox
                          checked={checklist[item.key as keyof typeof checklist]}
                          onChange={(e) => setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                        />
                      }
                      label={item.label}
                    />
                  ))}
                </FormGroup>
                <BilingualRemarkField
                  label="Instructions to division"
                  pdfTitle="Tender Preparation — Division Instructions"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={divisionInstructions}
                  onChange={setDivisionInstructions}
                  minRows={2}
                  helperText={`Addressed to: ${readiness?.divisionName ?? 'Concerned division'}`}
                />
                <BilingualRemarkField
                  label="HQ remarks"
                  pdfTitle="Tender Preparation — HQ Remarks"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={comments}
                  onChange={setComments}
                  minRows={2}
                />
              </>
            )}

            {(initiated || canUpload) && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Tender Preparation Documents
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  {(readiness?.prepDocuments ?? DPR_TENDER_PREP_DOCUMENT_TYPES.map((d) => ({
                    key: d.type, label: d.label, attached: false, required: d.type !== 'tender_task_order',
                  }))).map((doc) => (
                    <Chip
                      key={doc.key}
                      size="small"
                      color={doc.attached ? 'success' : doc.required ? 'default' : 'default'}
                      variant={doc.attached ? 'filled' : 'outlined'}
                      icon={doc.attached ? <CheckCircleOutlineIcon /> : undefined}
                      label={doc.label}
                      onClick={doc.attached && slotMap.get(doc.key)?.document
                        ? () => download(slotMap.get(doc.key)!.document!.id, slotMap.get(doc.key)!.document!.fileName ?? doc.key)
                        : undefined}
                      sx={doc.attached ? { cursor: 'pointer' } : undefined}
                    />
                  ))}
                </Box>
                {canUpload && (
                  <>
                    <input ref={fileRef} type="file" hidden onChange={onFilePicked} />
                    <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                      {DPR_TENDER_PREP_DOCUMENT_TYPES.filter((d) => d.type !== 'tender_task_order').map((def) => (
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
                {readiness?.prepComplete && (
                  <Alert severity="success">All tender preparation documents uploaded.</Alert>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canInitiate && (
          <Button variant="contained" startIcon={<AssignmentOutlinedIcon />}
            disabled={busy || !allChecked} onClick={submitInitiate}>
            Issue Task Order &amp; Initiate Tender Prep
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
