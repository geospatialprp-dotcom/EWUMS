import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  Divider, LinearProgress, List, ListItem, ListItemText, Step, StepLabel, Stepper,
  TextField, Typography,
} from '@mui/material';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import {
  DPR_TENDER_APPROVAL_LABELS,
  DPR_TENDER_PROCESSING_DOCUMENT_TYPES,
} from '../../constants/dprPlanningWorkflow';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { hasBilingualContent, serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type Stage10Readiness = {
  canBeginProcessing?: boolean;
  canUploadDocuments?: boolean;
  inProcessing?: boolean;
  published?: boolean;
  preparationComplete?: boolean;
  prepDocuments?: Array<{ key: string; label: string; attached: boolean; required: boolean }>;
  missingDocuments?: string[];
  approvalLevel?: string | null;
  approvalLevelLabel?: string | null;
  canActJe?: boolean;
  canActAe?: boolean;
  canActEe?: boolean;
  canPublish?: boolean;
  canHighlightUkTender?: boolean;
  canDownloadForVerification?: boolean;
  canReview?: boolean;
  approvals?: Array<{ level?: string; action?: string; remarks?: string | null; at?: string }>;
  packageNo?: string | null;
  nitRef?: string | null;
  publishedAt?: string | null;
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  stage10Readiness?: Stage10Readiness | null;
  documentSlots?: Array<{
    documentType: string;
    label: string;
    document: { id: string; fileName?: string | null } | null;
  }>;
};

const APPROVAL_STEPS = ['je', 'ae', 'ee', 'cleared'] as const;
const UK_TENDER_PORTAL_URL = 'https://uktenders.gov.in/';

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

export default function DprTenderProcessingPanel({ open, proposalId, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const [remarks, setRemarks] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [nitRef, setNitRef] = useState('');
  const [publishComments, setPublishComments] = useState<BilingualText>(EMPTY_BILINGUAL);
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
      setRemarks(EMPTY_BILINGUAL);
      setNitRef('');
      setPublishComments(EMPTY_BILINGUAL);
    }
  }, [open, proposalId, load]);

  const readiness = detail?.stage10Readiness;
  const canBegin = readiness?.canBeginProcessing === true;
  const canUpload = readiness?.canUploadDocuments === true;
  const canReview = readiness?.canReview === true;
  const canPublish = readiness?.canPublish === true;
  const published = readiness?.published === true;
  const highlightUkTender = readiness?.canHighlightUkTender === true;
  const canDownloadForVerification = readiness?.canDownloadForVerification === true;

  const activeStep = APPROVAL_STEPS.indexOf(
    (readiness?.approvalLevel ?? 'je') as typeof APPROVAL_STEPS[number],
  );
  const slotMap = new Map((detail?.documentSlots ?? []).map((s) => [s.documentType, s]));

  const requiredBeforePublish = [
    { key: 'dpr_complete_pdf', label: 'Final Approved DPR PDF' },
    { key: 'sanction_aa', label: 'Administrative Approval (AA)' },
    { key: 'sanction_es', label: 'Expenditure Sanction (ES)' },
    { key: 'sanction_budget_allocation', label: 'Budget Allocation Order' },
    { key: 'funding_release_order', label: 'Funding Release Order' },
    { key: 'boq_final', label: 'Final BOQ' },
    { key: 'bid_documents', label: 'Bid Documents' },
    { key: 'tender_tech_eligibility', label: 'Technical Eligibility Criteria' },
    { key: 'tender_financial_criteria', label: 'Financial Evaluation Criteria' },
  ] as const;

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

  const beginProcessing = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.beginTenderProcessing(proposalId, {});
      onUpdated();
      await load();
    } catch (err) {
      setError(getApiError(err, 'Failed to begin tender processing'));
    } finally {
      setBusy(false);
    }
  };

  const submitApproval = async (action: 'verify' | 'approve' | 'return') => {
    if (!proposalId) return;
    if (action === 'return' && !hasBilingualContent(remarks)) {
      setError('Remarks are required when returning tender');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.reviewTenderApproval(proposalId, {
        action,
        remarks: serializeBilingualText(remarks).trim() || undefined,
      });
      setRemarks(EMPTY_BILINGUAL);
      onUpdated();
      await load();
    } catch (err) {
      setError(getApiError(err, 'Tender approval action failed'));
    } finally {
      setBusy(false);
    }
  };

  const submitPublish = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.publishTenderProposal(proposalId, {
        nitRef: nitRef.trim() || undefined,
        comments: serializeBilingualText(publishComments).trim() || undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(getApiError(err, 'Failed to publish tender'));
    } finally {
      setBusy(false);
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

  const currentActionLabel = readiness?.canActJe
    ? 'Verify (JE)'
    : readiness?.canActAe
      ? 'Approve (AE)'
      : readiness?.canActEe
        ? 'Approve (EE)'
        : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={10}
        title="Tender Processing & Procurement"
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

            {highlightUkTender && (
              <Alert severity="success" sx={{ mb: 2, border: '2px solid', borderColor: 'success.main' }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Tender Cleared — Ready for UK Tender Portal
                </Typography>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  JE, AE, and EE sequential verification is complete. Download final documents below, then publish the tender on the UK Tender portal.
                </Typography>
                <Button
                  size="medium"
                  variant="contained"
                  color="success"
                  startIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => window.open(UK_TENDER_PORTAL_URL, '_blank', 'noopener,noreferrer')}
                >
                  Open UK Tender Portal for Bidding
                </Button>
              </Alert>
            )}

            {published && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Tender Published</Typography>
                {readiness?.nitRef && <Typography variant="body2">NIT Ref: {readiness.nitRef}</Typography>}
                {readiness?.publishedAt && (
                  <Typography variant="caption" display="block">
                    {new Date(readiness.publishedAt).toLocaleString('en-IN')}
                  </Typography>
                )}
              </Alert>
            )}

            {readiness?.inProcessing && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Approval Hierarchy
                </Typography>
                <Stepper activeStep={activeStep >= 0 ? activeStep : 0} alternativeLabel sx={{ mb: 2 }}>
                  {APPROVAL_STEPS.map((step) => (
                    <Step key={step} completed={activeStep > APPROVAL_STEPS.indexOf(step)}>
                      <StepLabel>{DPR_TENDER_APPROVAL_LABELS[step]}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
                {readiness.approvalLevelLabel && (
                  <Chip size="small" color="primary" label={readiness.approvalLevelLabel} sx={{ mb: 2 }} />
                )}
              </>
            )}

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Tender Package Preparation
            </Typography>
            {!highlightUkTender && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  UK Tender portal link is available throughout Stage 10 for EE reference.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  startIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => window.open(UK_TENDER_PORTAL_URL, '_blank', 'noopener,noreferrer')}
                >
                  Open UK Tender Portal
                </Button>
              </Alert>
            )}
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              {(readiness?.prepDocuments ?? DPR_TENDER_PROCESSING_DOCUMENT_TYPES.map((d) => ({
                key: d.type, label: d.label, attached: false, required: true,
              }))).map((doc) => (
                <Chip
                  key={doc.key}
                  size="small"
                  color={doc.attached ? 'success' : 'default'}
                  variant={doc.attached ? 'filled' : 'outlined'}
                  icon={doc.attached ? <CheckCircleOutlineIcon /> : undefined}
                  label={doc.label}
                />
              ))}
            </Box>

            {canUpload && (
              <>
                <input ref={fileRef} type="file" hidden onChange={onFilePicked} />
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  {DPR_TENDER_PROCESSING_DOCUMENT_TYPES.map((def) => (
                    <Button key={def.type} size="small" variant="outlined"
                      startIcon={<CloudUploadOutlinedIcon />}
                      disabled={!!uploadingType}
                      onClick={() => triggerUpload(def.type)}>
                      {uploadingType === def.type ? 'Uploading…' : def.label}
                    </Button>
                  ))}
                </Box>
              </>
            )}

            {canBegin && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                All preparation documents uploaded. Begin tender processing to start JE verification.
              </Alert>
            )}

            {(readiness?.approvals?.length ?? 0) > 0 && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Approval History
                </Typography>
                <List dense disablePadding sx={{ mb: 2 }}>
                  {readiness!.approvals!.map((a, idx) => (
                    <ListItem key={idx} disableGutters>
                      <ListItemText
                        primary={`${DPR_TENDER_APPROVAL_LABELS[a.level ?? ''] ?? a.level} — ${a.action ?? 'action'}`}
                        secondary={`${a.at ? new Date(a.at).toLocaleString('en-IN') : ''}${a.remarks ? ` — ${a.remarks}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {canDownloadForVerification && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Download for Verification
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Download all tender documents, verify, and forward through JE → AE → EE approval chain.
                </Alert>
                <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                  {requiredBeforePublish.map((item) => {
                    const doc = slotMap.get(item.key)?.document;
                    return (
                      <Button
                        key={item.key}
                        size="small"
                        variant="outlined"
                        disabled={!doc?.id}
                        startIcon={<DownloadOutlinedIcon />}
                        onClick={() => doc?.id && download(doc.id, doc.fileName ?? `${item.key}.pdf`)}
                      >
                        {doc?.id ? item.label : `${item.label} (missing)`}
                      </Button>
                    );
                  })}
                </Box>
              </>
            )}

            {canReview && (
              <>
                <Divider sx={{ my: 2 }} />
                <BilingualRemarkField
                  label={currentActionLabel?.includes('Verify') ? 'Verification remarks' : 'Review remarks'}
                  pdfTitle="Tender Processing Review Remarks"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={remarks}
                  onChange={setRemarks}
                  minRows={2}
                />
                <Box display="flex" gap={1} flexWrap="wrap">
                  {readiness?.canActJe && (
                    <Button variant="contained" disabled={busy} onClick={() => submitApproval('verify')}>
                      JE Verify &amp; Forward to AE
                    </Button>
                  )}
                  {(readiness?.canActAe || readiness?.canActEe) && (
                    <Button variant="contained" disabled={busy} onClick={() => submitApproval('approve')}>
                      {readiness?.canActAe ? 'AE Approve & Forward to EE' : 'EE Approve Tender'}
                    </Button>
                  )}
                  <Button variant="outlined" color="warning" disabled={busy}
                    onClick={() => submitApproval('return')}>
                    Return for Correction
                  </Button>
                </Box>
              </>
            )}

            {canPublish && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>Publish Tender</Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Before publishing to UK Tender portal, download and verify the final approved DPR copy and all required tender documents.
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
                    {requiredBeforePublish.map((item) => {
                      const doc = slotMap.get(item.key)?.document;
                      return (
                        <Button
                          key={item.key}
                          size="small"
                          variant="outlined"
                          disabled={!doc?.id}
                          onClick={() => doc?.id && download(doc.id, doc.fileName ?? `${item.key}.pdf`)}
                        >
                          {doc?.id ? `Download ${item.label}` : `${item.label} missing`}
                        </Button>
                      );
                    })}
                  </Box>
                </Alert>
                <TextField fullWidth size="small" label="NIT Reference (optional)" sx={{ mb: 2 }}
                  value={nitRef} onChange={(e) => setNitRef(e.target.value)} />
                <BilingualRemarkField
                  label="Publication remarks"
                  pdfTitle="Tender Publication Remarks"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={publishComments}
                  onChange={setPublishComments}
                  minRows={2}
                />
              </>
            )}

            {canBegin && (readiness?.missingDocuments?.length ?? 0) > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Upload before processing: {(readiness?.missingDocuments ?? []).join(', ')}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canBegin && (
          <Button variant="contained" disabled={busy} onClick={beginProcessing}>
            Begin Tender Processing
          </Button>
        )}
        {canPublish && (
          <Button variant="contained" startIcon={<PublishOutlinedIcon />} disabled={busy} onClick={submitPublish}>
            Publish Tender
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
