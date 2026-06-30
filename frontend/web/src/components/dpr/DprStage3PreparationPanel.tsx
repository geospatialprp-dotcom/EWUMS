import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent,
  IconButton, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_STAGE_3_DOCUMENT_TYPES } from '../../constants/dprPlanningWorkflow';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import DprLaReadinessChip from '../la/DprLaReadinessChip';
import BoqValidationReportView, { type BoqValidationData } from './BoqValidationReportView';
import type { LaReadiness } from '../../constants/laAcquisition';
import BilingualTextDisplay from '../forms/BilingualTextDisplay';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { hasBilingualContent, parseBilingualText, serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type DocVersion = {
  id: string;
  versionNo: number;
  fileName?: string | null;
  uploadedAt?: string;
  remarks?: string | null;
};

type PdfValidationData = {
  status?: string;
  pageCountEstimate?: number;
  fileSizeKb?: number;
  checks?: Array<{ label: string; passed: boolean; severity: string; message: string }>;
  summary?: { message?: string; readyForTac?: boolean; manualReviewRequired?: boolean };
  validatedAt?: string;
};

type Stage3Readiness = {
  complete?: boolean;
  missingDocuments?: string[];
  canBeginPreparation?: boolean;
  canUpload?: boolean;
  canSubmitToHq?: boolean;
  canSaveRemarks?: boolean;
  canReviewOnly?: boolean;
  viewMode?: 'prepare' | 'review' | 'read';
  totalVersions?: number;
  versionCounts?: Array<{ documentType: string; label: string; versionCount: number; latestVersion: number }>;
  tacPackage?: {
    hasCompletePdf?: boolean;
    hasBoqExcel?: boolean;
    complete?: boolean;
    validationMode?: 'excel_auto' | 'pdf_only';
    pdfValidation?: PdfValidationData | null;
    boqValidationPassed?: boolean;
    pdfValidationReady?: boolean;
  };
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  dprPrepOrderNo?: string | null;
  stage3HqRemarks?: string | null;
  boqValidation?: BoqValidationData | null;
  stage3Readiness?: Stage3Readiness & { laReadiness?: LaReadiness; laMissingActions?: string[] };
  laReadiness?: LaReadiness;
  documentVersionHistory?: Array<{
    documentType: string;
    label: string;
    versions: DocVersion[];
    latestVersion: DocVersion | null;
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

interface Props {
  open: boolean;
  proposalId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  onSubmittedToTac?: (proposalId: string) => void;
}

export default function DprStage3PreparationPanel({ open, proposalId, onClose, onUpdated, onSubmittedToTac }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [submitComments, setSubmitComments] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [hqRemarks, setHqRemarks] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [pendingDocType, setPendingDocType] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingBoq, setUploadingBoq] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfAttachedInSession, setPdfAttachedInSession] = useState(false);
  const [boqAttachedInSession, setBoqAttachedInSession] = useState(false);
  const [boqValidation, setBoqValidation] = useState<BoqValidationData | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const boqRef = useRef<HTMLInputElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!proposalId) return;
    setLoadingProposal(true);
    try {
      const res = await dprPlanningApi.getProposal(proposalId);
      setDetail(res.data as ProposalDetail);
    } catch (err) {
      setError(getApiError(err, 'Failed to load proposal'));
    } finally {
      setLoadingProposal(false);
    }
  }, [proposalId]);

  useEffect(() => {
    if (open && proposalId) load();
    if (!open) {
      setDetail(null);
      setError('');
      setSubmitError('');
      setSubmitComments(EMPTY_BILINGUAL);
      setHqRemarks(EMPTY_BILINGUAL);
      setExpandedType(null);
      setLoadingProposal(false);
      setPdfAttachedInSession(false);
      setBoqAttachedInSession(false);
      setBoqValidation(null);
    }
  }, [open, proposalId, load]);

  const loadBoqValidation = useCallback(async () => {
    if (!proposalId) return;
    try {
      const res = await dprPlanningApi.getBoqValidation(proposalId);
      setBoqValidation((res.data as BoqValidationData) ?? null);
    } catch {
      setBoqValidation(null);
    }
  }, [proposalId]);

  useEffect(() => {
    if (open && proposalId && (detail?.stage3Readiness?.tacPackage?.hasBoqExcel || detail?.boqValidation)) {
      loadBoqValidation();
    }
  }, [open, proposalId, detail?.stage3Readiness?.tacPackage?.hasBoqExcel, detail?.boqValidation?.validatedAt, loadBoqValidation]);

  useEffect(() => {
    if (detail?.stage3HqRemarks != null) {
      setHqRemarks(parseBilingualText(detail.stage3HqRemarks));
    }
  }, [detail?.stage3HqRemarks]);

  const readiness = detail?.stage3Readiness;
  const isReviewMode = readiness?.viewMode === 'review' || readiness?.canReviewOnly;
  const canUpload = readiness?.canUpload === true;
  const canSubmit = readiness?.canSubmitToHq === true;
  const boqValidationPassed = readiness?.tacPackage?.boqValidationPassed === true;
  const boqValidationFailed = readiness?.tacPackage?.hasBoqExcel && !boqValidationPassed;
  const canSaveRemarks = readiness?.canSaveRemarks === true;
  const historyByType = new Map(
    (detail?.documentVersionHistory ?? [])
      .filter((h) => DPR_STAGE_3_DOCUMENT_TYPES.some((d) => d.type === h.documentType))
      .map((h) => [h.documentType, h]),
  );

  const beginPreparation = async () => {
    if (!proposalId) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.beginDprPreparation(proposalId);
      load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Failed to begin DPR preparation'));
    } finally {
      setBusy(false);
    }
  };

  const triggerUpload = (docType: string) => {
    setPendingDocType(docType);
    fileRef.current?.click();
  };

  const openPdfPicker = () => {
    if (pdfRef.current) pdfRef.current.value = '';
    pdfRef.current?.click();
  };

  const openBoqPicker = () => {
    if (boqRef.current) boqRef.current.value = '';
    boqRef.current?.click();
  };

  const uploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (pdfRef.current) pdfRef.current.value = '';
    if (!file || !proposalId) return;
    setUploadingPdf(true);
    setError('');
    try {
      await dprPlanningApi.uploadCompleteDprPdf(proposalId, file);
      await load();
      setPdfAttachedInSession(true);
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'PDF upload failed'));
    } finally {
      setUploadingPdf(false);
    }
  };

  const uploadBoq = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (boqRef.current) boqRef.current.value = '';
    if (!file || !proposalId) return;
    setUploadingBoq(true);
    setError('');
    setBoqValidation(null);
    try {
      const res = await dprPlanningApi.uploadTacBoqExcel(proposalId, file);
      const payload = res.data as { validation?: BoqValidationData };
      if (payload.validation) setBoqValidation(payload.validation);
      else await loadBoqValidation();
      await load();
      setBoqAttachedInSession(true);
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'BOQ Excel upload failed'));
    } finally {
      setUploadingBoq(false);
    }
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

  const submitDpr = async () => {
    if (!proposalId || busy || loadingProposal) return;
    setBusy(true);
    setError('');
    setSubmitError('');
    try {
      await dprPlanningApi.submitDprToHq(proposalId, {
        comments: serializeBilingualText(submitComments).trim() || undefined,
      });
      onUpdated();
      onClose();
      onSubmittedToTac?.(proposalId);
    } catch (err) {
      const msg = getApiError(err, 'Failed to submit DPR to TAC');
      setSubmitError(msg);
      setError(msg);
      dialogContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const saveHqRemarks = async () => {
    if (!proposalId || !hasBilingualContent(hqRemarks)) return;
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.saveStage3HqRemarks(proposalId, { remarks: serializeBilingualText(hqRemarks).trim() });
      load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Failed to save HQ remarks'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={3}
        title={isReviewMode ? 'HQ Review (read-only)' : 'DPR Preparation'}
        proposalNo={detail?.proposalNo}
        statusLabel={detail?.statusLabel ?? detail?.status}
        busy={loadingProposal || busy}
      />
      <DialogContent ref={dialogContentRef} sx={dprDialogContentSx}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(''); setSubmitError(''); }}>{error}</Alert>}

        {loadingProposal && !detail && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Loading DPR preparation details…
          </Typography>
        )}

        {!loadingProposal && !detail && !error && (
          <Alert severity="warning">Could not load proposal details. Close and try again.</Alert>
        )}

        {detail && (
          <>
            <DprLaReadinessChip
              proposalId={proposalId ?? detail.id}
              proposalTitle={detail.title}
              readiness={detail.laReadiness ?? detail.stage3Readiness?.laReadiness}
              onNavigateAway={onClose}
            />
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>{detail.title}</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              <Chip size="small" label={detail.statusLabel ?? detail.status} />
              {detail.dprPrepOrderNo && (
                <Chip size="small" variant="outlined" label={`Prep Order: ${detail.dprPrepOrderNo}`} />
              )}
              {readiness?.totalVersions != null && readiness.totalVersions > 0 && (
                <Chip size="small" icon={<HistoryOutlinedIcon />} variant="outlined"
                  label={`${readiness.totalVersions} document version(s)`} />
              )}
            </Box>

            {readiness?.canBeginPreparation && canUpload && (
              <Alert severity="info" sx={{ mb: 2 }}
                action={(
                  <Button color="inherit" size="small" startIcon={<PlayArrowOutlinedIcon />}
                    onClick={beginPreparation} disabled={busy}>
                    Begin Preparation
                  </Button>
                )}>
                HQ has approved DPR preparation. Click Begin Preparation to start the preparation stage.
              </Alert>
            )}

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
              DPR Deliverables (version-controlled)
            </Typography>
            <input ref={fileRef} type="file" hidden
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.jpg,.jpeg,.png,.zip,.kml,.kmz,.geojson"
              onChange={onFilePicked} />
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell>Latest</TableCell>
                  <TableCell>Versions</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DPR_STAGE_3_DOCUMENT_TYPES.map((def) => {
                  const hist = historyByType.get(def.type);
                  const latest = hist?.latestVersion;
                  const versions = hist?.versions ?? [];
                  const versionCount = readiness?.versionCounts?.find((v) => v.documentType === def.type);
                  const isExpanded = expandedType === def.type;
                  return (
                    <Fragment key={def.type}>
                      <TableRow>
                        <TableCell>{def.label}</TableCell>
                        <TableCell>
                          {latest ? (
                            <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />}
                              label={`v${latest.versionNo} — ${latest.fileName ?? 'file'}`} />
                          ) : (
                            <Chip size="small" color="warning" label="Pending" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          {versionCount?.versionCount ? `${versionCount.versionCount} version(s)` : '—'}
                        </TableCell>
                        <TableCell align="right">
                          {versions.length > 1 && (
                            <IconButton size="small" onClick={() => setExpandedType(isExpanded ? null : def.type)}>
                              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          )}
                          {latest && (
                            <Tooltip title="Download latest">
                              <IconButton size="small" onClick={() => downloadDoc(latest.id, latest.fileName ?? 'document')}>
                                <DownloadOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {canUpload && (
                            <Button size="small" startIcon={<CloudUploadOutlinedIcon />}
                              disabled={uploadingType === def.type}
                              onClick={() => triggerUpload(def.type)}>
                              {latest ? 'New Version' : 'Upload'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {versions.length > 1 && (
                        <TableRow key={`${def.type}-history`}>
                          <TableCell colSpan={4} sx={{ py: 0, border: 0 }}>
                            <Collapse in={isExpanded}>
                              <Box py={1} pl={2}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600}>Version history</Typography>
                                {versions.map((v) => (
                                  <Box key={v.id} display="flex" alignItems="center" gap={1} py={0.5}>
                                    <Chip size="small" label={`v${v.versionNo}`} variant="outlined" />
                                    <Typography variant="caption">{v.fileName ?? 'file'}</Typography>
                                    {v.uploadedAt && (
                                      <Typography variant="caption" color="text.secondary">
                                        {new Date(v.uploadedAt).toLocaleString('en-IN')}
                                      </Typography>
                                    )}
                                    <IconButton size="small" onClick={() => downloadDoc(v.id, v.fileName ?? 'document')}>
                                      <DownloadOutlinedIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Box>
                                ))}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>

            <Typography variant="overline" color="text.secondary" display="block" sx={{ mt: 3, mb: 1 }}>
              TAC Submission Package
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload Complete DPR PDF and BOQ Excel for TAC. The system auto-validates every calculation sheet
              (description, unit, Qty×Rate, subtotals, grand totals) and blocks submission until all errors are fixed.
            </Typography>

            {(uploadingPdf || uploadingBoq) && <LinearProgress sx={{ mb: 2 }} />}

            <Box display="flex" gap={2} flexWrap="wrap" mb={2} alignItems="center">
              {canUpload && (
                <>
                  <input ref={pdfRef} type="file" hidden accept=".pdf" onChange={uploadPdf} />
                  <input ref={boqRef} type="file" hidden accept=".xlsx,.xls" onChange={uploadBoq} />
                  <Button variant="contained" startIcon={<CloudUploadOutlinedIcon />}
                    disabled={uploadingPdf || uploadingBoq}
                    onClick={openPdfPicker}>
                    {readiness?.tacPackage?.hasCompletePdf ? 'Replace Complete DPR PDF' : 'Upload Complete DPR PDF'}
                  </Button>
                  <Button variant="outlined" startIcon={<CloudUploadOutlinedIcon />}
                    disabled={uploadingBoq || uploadingPdf}
                    onClick={openBoqPicker}>
                    {readiness?.tacPackage?.hasBoqExcel ? 'Replace BOQ Excel' : 'Upload BOQ Excel'}
                  </Button>
                </>
              )}
            </Box>

            {(pdfAttachedInSession || boqAttachedInSession) && !uploadingPdf && !uploadingBoq && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {pdfAttachedInSession && (
                    <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="DPR PDF ready for TAC" />
                  )}
                  {boqAttachedInSession && (
                    <Chip size="small"
                      color={boqValidation?.status === 'failed' ? 'error' : boqValidation?.status === 'warning' ? 'warning' : 'success'}
                      variant="outlined" icon={<CheckCircleOutlineIcon />}
                      label={boqValidation?.status === 'failed' ? 'BOQ validation failed' : 'BOQ Excel validated'} />
                  )}
                </Box>
              </Alert>
            )}

            {(uploadingBoq || readiness?.tacPackage?.hasBoqExcel) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  BOQ Auto-Validation Report
                </Typography>
                <BoqValidationReportView
                  validation={boqValidation}
                  validating={uploadingBoq}
                  validatingLabel="Validating BOQ Excel — checking all sheets, Qty×Rate, totals and formulas…"
                  proposalId={proposalId}
                />
              </Box>
            )}

            {boqValidationPassed && !uploadingBoq && boqValidation?.status === 'passed' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                BOQ validation PASSED — review the full report above, then submit to TAC when all deliverables are complete.
              </Alert>
            )}

            {boqValidationFailed && !uploadingBoq && (
              <Alert severity="error" sx={{ mb: 2 }}>
                BOQ must pass validation before HQ submission. Fix highlighted errors and re-upload the Excel workbook.
              </Alert>
            )}

            {canUpload && readiness?.canSubmitToHq === false && ['dpr_prep_approved', 'dpr_preparation'].includes(detail.status) && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>Before submitting to TAC:</Typography>
                {(readiness.laMissingActions ?? []).map((d) => (
                  <Typography key={d} variant="caption" display="block">• Land acquisition: {d}</Typography>
                ))}
                {(readiness.missingDocuments ?? []).map((d) => (
                  <Typography key={d} variant="caption" display="block">• Upload deliverable: {d}</Typography>
                ))}
                {!readiness.tacPackage?.hasCompletePdf && (
                  <Typography variant="caption" display="block">• Upload Complete DPR PDF (required for TAC)</Typography>
                )}
                {!readiness.tacPackage?.hasBoqExcel && (
                  <Typography variant="caption" display="block">• Upload Complete BOQ Excel (required — auto-validated)</Typography>
                )}
                {readiness.tacPackage?.hasBoqExcel && !readiness.tacPackage?.boqValidationPassed && (
                  <Typography variant="caption" display="block">• BOQ must pass validation before HQ submission</Typography>
                )}
              </Alert>
            )}

            {canSubmit && (
              <>
                <Box sx={{ mt: 2 }}>
                  <BilingualRemarkField
                    label="Submission comments to TAC"
                    pdfTitle="DPR Submission Comments to TAC"
                    pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                    value={submitComments}
                    onChange={setSubmitComments}
                    minRows={2}
                    helperText="Requires all 8 deliverables, Complete DPR PDF, and passing BOQ Excel auto-validation."
                  />
                </Box>
                {submitError && (
                  <Alert severity="error" sx={{ mt: 2 }}>{submitError}</Alert>
                )}
              </>
            )}

            {canSaveRemarks && (
              <Box sx={{ mt: 2 }}>
                <BilingualRemarkField
                  label="HQ remarks on DPR preparation"
                  pdfTitle="HQ Remarks on DPR Preparation"
                  pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                  value={hqRemarks}
                  onChange={setHqRemarks}
                  minRows={3}
                  helperText="Visible to the division EE — observations before final submission to TAC."
                />
              </Box>
            )}

            {!canSaveRemarks && detail.stage3HqRemarks && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>HQ remarks</Typography>
                <BilingualTextDisplay text={detail.stage3HqRemarks} />
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canSaveRemarks && (
          <Button variant="contained" color="secondary" disabled={busy || !hasBilingualContent(hqRemarks)} onClick={saveHqRemarks}>
            Save HQ Remarks
          </Button>
        )}
        {canSubmit && (
          <Button variant="contained" color="primary" type="button" startIcon={<SendOutlinedIcon />}
            disabled={busy || loadingProposal || uploadingPdf || uploadingBoq || boqValidationFailed}
            onClick={submitDpr}>
            Submit to TAC
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
