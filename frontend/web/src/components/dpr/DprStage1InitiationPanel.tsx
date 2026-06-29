import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  Grid, IconButton, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_STAGE_1_DOCUMENT_TYPES } from '../../constants/dprPlanningWorkflow';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import BilingualTextDisplay from '../forms/BilingualTextDisplay';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { parseBilingualText, serializeBilingualText, type BilingualText } from '../../utils/bilingualText';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';

type DocSlot = {
  documentType: string;
  label: string;
  document: {
    id: string;
    fileName?: string | null;
    fileUrl?: string | null;
    versionNo?: number;
    uploadedAt?: string;
  } | null;
};

type Stage1Readiness = {
  complete?: boolean;
  canForwardToHq?: boolean;
  missingDocuments?: string[];
  missingFields?: string[];
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  schemeJustification?: string | null;
  preliminaryEstimate?: number | null;
  fundingSource?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  documentSlots?: DocSlot[];
  stage1Readiness?: Stage1Readiness;
  hqRemarks?: string | null;
  hqReviewedAt?: string | null;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

interface Props {
  open: boolean;
  proposalId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function DprStage1InitiationPanel({ open, proposalId, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState('');

  const [draft, setDraft] = useState<{
    schemeJustification: BilingualText;
    preliminaryEstimate: string;
    fundingSource: string;
    latitude: string;
    longitude: string;
    forwardComments: BilingualText;
  }>({
    schemeJustification: EMPTY_BILINGUAL,
    preliminaryEstimate: '',
    fundingSource: '',
    latitude: '',
    longitude: '',
    forwardComments: EMPTY_BILINGUAL,
  });

  const load = useCallback(() => {
    if (!proposalId) return;
    setBusy(true);
    dprPlanningApi.getProposal(proposalId)
      .then((res) => {
        const data = res.data as ProposalDetail;
        setDetail(data);
        setDraft({
          schemeJustification: parseBilingualText(data.schemeJustification ?? ''),
          preliminaryEstimate: data.preliminaryEstimate != null ? String(data.preliminaryEstimate) : '',
          fundingSource: data.fundingSource ?? '',
          latitude: data.latitude != null ? String(data.latitude) : '',
          longitude: data.longitude != null ? String(data.longitude) : '',
          forwardComments: EMPTY_BILINGUAL,
        });
      })
      .catch((err) => setError(getApiError(err, 'Failed to load proposal')))
      .finally(() => setBusy(false));
  }, [proposalId]);

  useEffect(() => {
    if (open && proposalId) load();
    if (!open) {
      setDetail(null);
      setError('');
    }
  }, [open, proposalId, load]);

  const stage1Slots = detail?.documentSlots?.filter((s) =>
    DPR_STAGE_1_DOCUMENT_TYPES.some((d) => d.type === s.documentType),
  ) ?? DPR_STAGE_1_DOCUMENT_TYPES.map((d) => ({
    documentType: d.type,
    label: d.label,
    document: null,
  }));

  const readiness = detail?.stage1Readiness;
  const editable = ['proposal_draft', 'proposal_returned'].includes(detail?.status ?? '');
  const isReturned = detail?.status === 'proposal_returned';

  const saveDraft = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.updateProposal(proposalId, {
        schemeJustification: serializeBilingualText(draft.schemeJustification).trim() || undefined,
        preliminaryEstimate: draft.preliminaryEstimate ? Number(draft.preliminaryEstimate) : undefined,
        fundingSource: draft.fundingSource.trim() || undefined,
        latitude: draft.latitude ? Number(draft.latitude) : undefined,
        longitude: draft.longitude ? Number(draft.longitude) : undefined,
      });
      load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Failed to save draft'));
    } finally {
      setBusy(false);
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
    setError('');
    try {
      await dprPlanningApi.uploadDocumentFile(proposalId, pendingDocType, file);
      load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Upload failed'));
    } finally {
      setUploadingType('');
      setPendingDocType('');
    }
  };

  const downloadDoc = async (docId: string, fileName: string) => {
    if (!proposalId) return;
    try {
      const blob = await dprPlanningApi.fetchDocumentFile(proposalId, docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'document';
      a.target = '_blank';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download file');
    }
  };

  const forwardToHq = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.updateProposal(proposalId, {
        schemeJustification: serializeBilingualText(draft.schemeJustification).trim() || undefined,
        preliminaryEstimate: draft.preliminaryEstimate ? Number(draft.preliminaryEstimate) : undefined,
        fundingSource: draft.fundingSource.trim() || undefined,
        latitude: draft.latitude ? Number(draft.latitude) : undefined,
        longitude: draft.longitude ? Number(draft.longitude) : undefined,
      });
      await dprPlanningApi.submitToHq(proposalId, {
        comments: serializeBilingualText(draft.forwardComments).trim() || undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(getApiError(err, 'Failed to forward to HQ'));
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={1}
        title="DPR Proposal Initiation"
        proposalNo={detail?.proposalNo}
        statusLabel={detail?.statusLabel ?? detail?.status}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {detail && (
          <>
            <Typography variant="subtitle2" gutterBottom>
              {detail.title}
            </Typography>
            <Chip size="small" label={detail.statusLabel ?? detail.status} sx={{ mb: 2 }} />

            {isReturned && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  HQ returned this proposal to your division for revision
                </Typography>
                {detail.hqRemarks ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      HQ remarks{detail.hqReviewedAt ? ` (${new Date(detail.hqReviewedAt).toLocaleDateString('en-IN')})` : ''}:
                    </Typography>
                    <BilingualTextDisplay text={detail.hqRemarks} />
                  </Box>
                ) : (
                  <Typography variant="body2">Revise the proposal and resubmit to HQ.</Typography>
                )}
              </Alert>
            )}

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Proposal Details
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <BilingualRemarkField
                  label="Scheme Justification"
                  pdfTitle="Scheme Justification"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={draft.schemeJustification}
                  onChange={(schemeJustification) => setDraft({ ...draft, schemeJustification })}
                  disabled={!editable}
                  minRows={3}
                  showExport={editable}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth size="small" type="number" label="Preliminary Estimate (₹)"
                  disabled={!editable} value={draft.preliminaryEstimate}
                  onChange={(e) => setDraft({ ...draft, preliminaryEstimate: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth size="small" label="Funding Source"
                  disabled={!editable} value={draft.fundingSource}
                  onChange={(e) => setDraft({ ...draft, fundingSource: e.target.value })}
                />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField
                  fullWidth size="small" type="number" label="Latitude"
                  disabled={!editable} value={draft.latitude}
                  onChange={(e) => setDraft({ ...draft, latitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField
                  fullWidth size="small" type="number" label="Longitude"
                  disabled={!editable} value={draft.longitude}
                  onChange={(e) => setDraft({ ...draft, longitude: e.target.value })}
                  inputProps={{ step: 'any' }}
                />
              </Grid>
            </Grid>

            {editable && (
              <Box mb={2}>
                <Button size="small" variant="outlined" onClick={saveDraft} disabled={busy}>
                  Save Draft Fields
                </Button>
              </Box>
            )}

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Required Uploads (Division EE)
            </Typography>
            <input ref={fileRef} type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.kml,.kmz,.geojson" onChange={onFilePicked} />
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stage1Slots.map((slot) => (
                  <TableRow key={slot.documentType}>
                    <TableCell>{slot.label}</TableCell>
                    <TableCell>
                      {slot.document ? (
                        <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label={`v${slot.document.versionNo ?? 1}`} />
                      ) : (
                        <Chip size="small" color="warning" label="Pending" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      {slot.document?.fileName ?? '—'}
                    </TableCell>
                    <TableCell align="right">
                      {slot.document && (
                        <Tooltip title="Download">
                          <IconButton size="small" onClick={() => downloadDoc(slot.document!.id, slot.document!.fileName ?? 'document')}>
                            <DownloadOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {editable && (
                        <Button
                          size="small"
                          startIcon={<CloudUploadOutlinedIcon />}
                          disabled={uploadingType === slot.documentType}
                          onClick={() => triggerUpload(slot.documentType)}
                        >
                          {slot.document ? 'Replace' : 'Upload'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {editable && readiness && !readiness.complete && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>Before forwarding to HQ:</Typography>
                {readiness.missingDocuments?.map((d) => <Typography key={d} variant="caption" display="block">• Upload: {d}</Typography>)}
                {readiness.missingFields?.map((f) => <Typography key={f} variant="caption" display="block">• Complete: {f}</Typography>)}
              </Alert>
            )}

            {editable && (
              <Box sx={{ mt: 2 }}>
                <BilingualRemarkField
                  label="Comments to HQ"
                  pdfTitle="DPR Forwarding Comments to HQ"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={draft.forwardComments}
                  onChange={(forwardComments) => setDraft({ ...draft, forwardComments })}
                  minRows={2}
                  helperText="Optional — use हिंदी toggle to add Hindi comments."
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {editable && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<SendOutlinedIcon />}
            disabled={busy || !readiness?.canForwardToHq}
            onClick={forwardToHq}
          >
            {isReturned ? 'Resubmit to HQ' : 'Forward to HQ for DPR Approval'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
