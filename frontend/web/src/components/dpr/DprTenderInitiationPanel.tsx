import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  Divider, LinearProgress, List, ListItem, ListItemText, Typography,
} from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_TENDER_PREP_DOCUMENT_TYPES } from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type OfficialPackageDoc = {
  key: string;
  label: string;
  documentId: string;
  fileName?: string | null;
  category?: string;
};

type Stage9Readiness = {
  canAuthorize?: boolean;
  canInitiate?: boolean;
  authorized?: boolean;
  canDownloadOfficialPackage?: boolean;
  canBeginEePrep?: boolean;
  initiated?: boolean;
  canUploadPrepDocuments?: boolean;
  canTrack?: boolean;
  taskOrderNo?: string | null;
  packageNo?: string | null;
  initiatedAt?: string | null;
  divisionName?: string | null;
  divisionInstructions?: string | null;
  officialPackageDocuments?: OfficialPackageDoc[];
  sanctionedPackageFrozenAt?: string | null;
  authorization?: {
    authorizedAt?: string | null;
    divisionName?: string | null;
    divisionInstructions?: string | null;
    comments?: string | null;
  } | null;
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
  isSuperAdmin?: boolean;
}

export default function DprTenderInitiationPanel({ open, proposalId, onClose, onUpdated, isSuperAdmin }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const [divisionInstructions, setDivisionInstructions] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [comments, setComments] = useState<BilingualText>(EMPTY_BILINGUAL);
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
    }
  }, [open, proposalId, load]);

  const readiness = detail?.stage9Readiness;
  const canAuthorize = (readiness?.canAuthorize || readiness?.canInitiate) === true;
  const authorized = readiness?.authorized === true;
  const canDownloadOfficial = readiness?.canDownloadOfficialPackage === true;
  const canBeginEePrep = readiness?.canBeginEePrep === true;
  const prepStarted = detail?.status !== 'sanctioned' || !!(readiness?.initiatedAt);
  const canUpload = readiness?.canUploadPrepDocuments === true;

  const slotMap = new Map((detail?.documentSlots ?? []).map((s) => [s.documentType, s]));
  const officialDocs = readiness?.officialPackageDocuments ?? [];

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

  const submitAuthorize = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.authorizeTenderPrepForEe(proposalId, {
        divisionInstructions: serializeBilingualText(divisionInstructions).trim() || undefined,
        comments: serializeBilingualText(comments).trim() || undefined,
      });
      onUpdated();
      await load();
    } catch (err) {
      setError(getApiError(err, 'Failed to authorize tender preparation'));
    } finally {
      setBusy(false);
    }
  };

  const submitBeginEePrep = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.beginEeTenderPrep(proposalId, {});
      onUpdated();
      await load();
    } catch (err) {
      setError(getApiError(err, 'Failed to begin tender preparation'));
    } finally {
      setBusy(false);
    }
  };

  const panelTitle = isSuperAdmin && canAuthorize
    ? 'Authorize EE — Tender Preparation'
    : 'Tender & BOQ Preparation (Division EE)';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={9}
        title={panelTitle}
        proposalNo={detail?.proposalNo}
        statusLabel={detail?.statusLabel ?? detail?.status}
        busy={busy}
      />
      <DialogContent sx={dprDialogContentSx}>
        {busy && <LinearProgress sx={{ mb: 2 }} />}
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

            {!authorized && detail.status === 'sanctioned' && !isSuperAdmin && (
              <Alert severity="info" icon={<LockOutlinedIcon />} sx={{ mb: 2 }}>
                Final sanctioned DPR and supporting documents will be available for download after Super Admin authorizes tender preparation.
              </Alert>
            )}

            {authorized && readiness?.authorization && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Super Admin Authorization</Typography>
                {readiness.authorization.authorizedAt && (
                  <Typography variant="caption" display="block">
                    Authorized: {new Date(readiness.authorization.authorizedAt).toLocaleString('en-IN')}
                  </Typography>
                )}
                {readiness.authorization.divisionInstructions && (
                  <Typography variant="body2" sx={{ mt: 1 }}>{readiness.authorization.divisionInstructions}</Typography>
                )}
              </Alert>
            )}

            {(canDownloadOfficial || officialDocs.length > 0) && (detail.status === 'sanctioned' || detail.status === 'tender_prep_initiated') && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Sanctioned Official Package — Final Checked &amp; Signed Copy
                </Typography>
                {readiness?.sanctionedPackageFrozenAt && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Frozen at sanction: {new Date(readiness.sanctionedPackageFrozenAt).toLocaleString('en-IN')}
                  </Typography>
                )}
                {officialDocs.length === 0 ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>Official package manifest is empty — contact administrator.</Alert>
                ) : (
                  <List dense disablePadding sx={{ mb: 2 }}>
                    {officialDocs.map((doc) => (
                      <ListItem key={doc.documentId} disableGutters secondaryAction={
                        canDownloadOfficial ? (
                          <Button size="small" startIcon={<DownloadOutlinedIcon />}
                            onClick={() => download(doc.documentId, doc.fileName ?? `${doc.key}.pdf`)}>
                            Download
                          </Button>
                        ) : undefined
                      }>
                        <ListItemText
                          primary={doc.label}
                          secondary={doc.fileName ?? doc.key}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </>
            )}

            {prepStarted && readiness?.taskOrderNo && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Tender Preparation Started</Typography>
                <Typography variant="body2">
                  {readiness.taskOrderNo} · Package: {readiness.packageNo ?? '—'}
                </Typography>
                {readiness.initiatedAt && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    Began: {new Date(readiness.initiatedAt).toLocaleString('en-IN')}
                  </Typography>
                )}
              </Alert>
            )}

            {prepStarted && (
              <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
                sx={{ mb: 2 }} onClick={downloadTaskOrder}>
                Download Task Order
              </Button>
            )}

            {canAuthorize && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Authorize Division EE
                </Typography>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  After authorization, Division EE can download the final sanctioned DPR package and begin BOQ / tender document preparation.
                </Alert>
                <BilingualRemarkField
                  label="Instructions to Division EE"
                  pdfTitle="Tender Preparation — Division Instructions"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={divisionInstructions}
                  onChange={setDivisionInstructions}
                  minRows={2}
                  helperText={`Addressed to: ${readiness?.divisionName ?? 'Concerned division EE'}`}
                />
                <BilingualRemarkField
                  label="Authorization remarks"
                  pdfTitle="Tender Preparation Authorization Remarks"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={comments}
                  onChange={setComments}
                  minRows={2}
                />
              </>
            )}

            {(prepStarted || canUpload) && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1, mt: 2 }}>
                  Tender Preparation Documents (BOQ &amp; Tender Docs)
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  {(readiness?.prepDocuments ?? DPR_TENDER_PREP_DOCUMENT_TYPES.map((d) => ({
                    key: d.type, label: d.label, attached: false, required: d.type !== 'tender_task_order',
                  }))).map((doc) => (
                    <Chip
                      key={doc.key}
                      size="small"
                      color={doc.attached ? 'success' : 'default'}
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
                  <Alert severity="success">All tender preparation documents uploaded — proceed to Stage 10 for JE / AE / EE verification.</Alert>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canAuthorize && (
          <Button variant="contained" startIcon={<AssignmentOutlinedIcon />}
            disabled={busy} onClick={submitAuthorize}>
            Authorize EE — Tender Preparation
          </Button>
        )}
        {canBeginEePrep && (
          <Button variant="contained" color="primary" startIcon={<AssignmentOutlinedIcon />}
            disabled={busy} onClick={submitBeginEePrep}>
            Begin Tender Preparation
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
