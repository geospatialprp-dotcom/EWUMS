import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent,
  IconButton, LinearProgress, List, ListItem, ListItemText, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import axios from 'axios';
import { dprPlanningApi } from '../../services/api';
import { DPR_STAGE_3_DOCUMENT_TYPES, DPR_TAC_ACTION_LABELS } from '../../constants/dprPlanningWorkflow';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { DprDialogHeader, dprDialogActionsSx, dprDialogContentSx, dprDialogPaperSx } from './dprUi';
import BoqValidationReportView, { type BoqValidationData } from './BoqValidationReportView';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../../hooks/useBilingualRemark';
import { hasBilingualContent, serializeBilingualText, type BilingualText } from '../../utils/bilingualText';

type TacObservation = {
  at?: string;
  action?: string;
  remarks?: string | null;
  complianceNotes?: string | null;
};

type Stage5Readiness = {
  status?: string;
  canBeginRevision?: boolean;
  canUpload?: boolean;
  canResubmitToTac?: boolean;
  missingDocuments?: string[];
  hasCompletePdf?: boolean;
  hasBoqExcel?: boolean;
  boqValidationPassed?: boolean;
  tacObservations?: TacObservation[];
  latestTacRemarks?: string | null;
};

type DocVersion = {
  id: string;
  versionNo: number;
  fileName?: string | null;
  uploadedAt?: string;
};

type ProposalDetail = {
  id: string;
  proposalNo: string;
  title: string;
  status: string;
  statusLabel?: string;
  stage5Readiness?: Stage5Readiness | null;
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
  onResubmitted?: (proposalId: string) => void;
}

export default function DprRevisionPanel({ open, proposalId, onClose, onUpdated, onResubmitted }: Props) {
  const [detail, setDetail] = useState<ProposalDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingBoq, setUploadingBoq] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [observationResponse, setObservationResponse] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [resubmitComments, setResubmitComments] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [pendingDocType, setPendingDocType] = useState('');
  const [boqValidation, setBoqValidation] = useState<BoqValidationData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const boqRef = useRef<HTMLInputElement>(null);

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
      setObservationResponse(EMPTY_BILINGUAL);
      setResubmitComments(EMPTY_BILINGUAL);
    }
  }, [open, proposalId, load]);

  const readiness = detail?.stage5Readiness;

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
    if (open && proposalId && readiness?.hasBoqExcel) loadBoqValidation();
  }, [open, proposalId, readiness?.hasBoqExcel, loadBoqValidation]);

  const canUpload = readiness?.canUpload === true;
  const canBegin = readiness?.canBeginRevision === true;
  const canResubmit = readiness?.canResubmitToTac === true;
  const boqValidationFailed = readiness?.hasBoqExcel && !readiness?.boqValidationPassed;

  const historyByType = new Map(
    (detail?.documentVersionHistory ?? [])
      .filter((h) => DPR_STAGE_3_DOCUMENT_TYPES.some((d) => d.type === h.documentType))
      .map((h) => [h.documentType, h]),
  );

  const beginRevision = async () => {
    if (!proposalId) return;
    setBusy(true);
    try {
      await dprPlanningApi.beginDprRevision(proposalId);
      await load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'Failed to begin revision'));
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

  const uploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (pdfRef.current) pdfRef.current.value = '';
    if (!file || !proposalId) return;
    setUploadingPdf(true);
    try {
      await dprPlanningApi.uploadCompleteDprPdf(proposalId, file);
      await load();
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
    setBoqValidation(null);
    try {
      const res = await dprPlanningApi.uploadTacBoqExcel(proposalId, file);
      const payload = res.data as { validation?: BoqValidationData };
      if (payload.validation) setBoqValidation(payload.validation);
      else await loadBoqValidation();
      await load();
      onUpdated();
    } catch (err) {
      setError(getApiError(err, 'BOQ upload failed'));
    } finally {
      setUploadingBoq(false);
    }
  };

  const downloadDoc = async (docId: string, fileName: string) => {
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

  const resubmit = async () => {
    if (!proposalId) return;
    if (!hasBilingualContent(observationResponse)) {
      setError('Describe how TAC observations were addressed');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await dprPlanningApi.resubmitRevisedDprToTac(proposalId, {
        observationResponse: serializeBilingualText(observationResponse).trim(),
        comments: serializeBilingualText(resubmitComments).trim() || undefined,
      });
      onUpdated();
      onClose();
      onResubmitted?.(proposalId);
    } catch (err) {
      setError(getApiError(err, 'Failed to resubmit revised DPR to TAC'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const observations = readiness?.tacObservations ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: dprDialogPaperSx }}>
      <DprDialogHeader
        stage={5}
        title="DPR Revision & Finalization"
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

            {(observations.length > 0 || readiness?.latestTacRemarks) && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  TAC Observations to Address
                </Typography>
                {readiness?.latestTacRemarks && (
                  <Alert severity="warning" sx={{ mb: 1 }}>{readiness.latestTacRemarks}</Alert>
                )}
                <List dense disablePadding sx={{ mb: 2 }}>
                  {observations.map((obs, idx) => (
                    <ListItem key={idx} disableGutters sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <ListItemText
                        primary={DPR_TAC_ACTION_LABELS[obs.action ?? ''] ?? obs.action ?? 'TAC observation'}
                        secondary={`${obs.at ? new Date(obs.at).toLocaleString('en-IN') : ''}${obs.remarks ? ` — ${obs.remarks}` : ''}${obs.complianceNotes ? ` | Compliance: ${obs.complianceNotes}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {canBegin && (
              <Alert severity="warning" sx={{ mb: 2 }}
                action={(
                  <Button color="inherit" size="small" startIcon={<PlayArrowOutlinedIcon />}
                    onClick={beginRevision} disabled={busy}>
                    Begin Revision
                  </Button>
                )}>
                TAC has requested corrections. Click Begin Revision to start addressing observations.
              </Alert>
            )}

            {canUpload && detail.status === 'dpr_revision' && (
              <>
                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Revised Deliverables
                </Typography>
                <input ref={fileRef} type="file" hidden
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.jpg,.jpeg,.png,.zip,.kml,.kmz,.geojson"
                  onChange={onFilePicked} />
                <Table size="small" sx={{ ...dataTableSx, mb: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Document</TableCell>
                      <TableCell>Latest</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {DPR_STAGE_3_DOCUMENT_TYPES.map((def) => {
                      const hist = historyByType.get(def.type);
                      const latest = hist?.latestVersion;
                      const versions = hist?.versions ?? [];
                      const isExpanded = expandedType === def.type;
                      return (
                        <Fragment key={def.type}>
                          <TableRow>
                            <TableCell>{def.label}</TableCell>
                            <TableCell>
                              {latest ? (
                                <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />}
                                  label={`v${latest.versionNo}`} />
                              ) : (
                                <Chip size="small" color="warning" label="Pending" variant="outlined" />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {versions.length > 1 && (
                                <IconButton size="small" onClick={() => setExpandedType(isExpanded ? null : def.type)}>
                                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </IconButton>
                              )}
                              {latest && (
                                <IconButton size="small" onClick={() => downloadDoc(latest.id, latest.fileName ?? 'file')}>
                                  <DownloadOutlinedIcon fontSize="small" />
                                </IconButton>
                              )}
                              <Button size="small" startIcon={<CloudUploadOutlinedIcon />}
                                disabled={uploadingType === def.type}
                                onClick={() => triggerUpload(def.type)}>
                                {latest ? 'New Version' : 'Upload'}
                              </Button>
                            </TableCell>
                          </TableRow>
                          {versions.length > 1 && (
                            <TableRow>
                              <TableCell colSpan={3} sx={{ py: 0, border: 0 }}>
                                <Collapse in={isExpanded}>
                                  <Box py={1} pl={2}>
                                    {versions.map((v) => (
                                      <Box key={v.id} display="flex" gap={1} alignItems="center" py={0.5}>
                                        <Chip size="small" label={`v${v.versionNo}`} variant="outlined" />
                                        <Typography variant="caption">{v.fileName}</Typography>
                                        <IconButton size="small" onClick={() => downloadDoc(v.id, v.fileName ?? 'file')}>
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

                <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Revised TAC Package
                </Typography>
                {(uploadingPdf || uploadingBoq) && <LinearProgress sx={{ mb: 1 }} />}
                <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
                  <input ref={pdfRef} type="file" hidden accept=".pdf" onChange={uploadPdf} />
                  <input ref={boqRef} type="file" hidden accept=".xlsx,.xls" onChange={uploadBoq} />
                  <Button variant="contained" startIcon={<CloudUploadOutlinedIcon />}
                    disabled={uploadingPdf || uploadingBoq}
                    onClick={() => { if (pdfRef.current) pdfRef.current.value = ''; pdfRef.current?.click(); }}>
                    {readiness?.hasCompletePdf ? 'Replace Revised DPR PDF' : 'Upload Revised DPR PDF'}
                  </Button>
                  <Button variant="outlined" startIcon={<CloudUploadOutlinedIcon />}
                    disabled={uploadingBoq || uploadingPdf}
                    onClick={() => { if (boqRef.current) boqRef.current.value = ''; boqRef.current?.click(); }}>
                    {readiness?.hasBoqExcel ? 'Replace BOQ Excel' : 'Upload BOQ Excel'}
                  </Button>
                  {readiness?.hasCompletePdf && (
                    <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="Revised PDF ready" />
                  )}
                </Box>

                {(uploadingBoq || readiness?.hasBoqExcel) && (
                  <Box sx={{ mb: 2 }}>
                    <BoqValidationReportView
                      validation={boqValidation}
                      validating={uploadingBoq}
                      proposalId={proposalId}
                    />
                  </Box>
                )}

                {boqValidationFailed && !uploadingBoq && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    BOQ validation must pass before resubmitting to TAC.
                  </Alert>
                )}

                {canResubmit && (
                  <>
                    <BilingualRemarkField
                      label="How TAC observations were addressed"
                      pdfTitle="DPR Revision — TAC Observation Response"
                      pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                      value={observationResponse}
                      onChange={setObservationResponse}
                      minRows={3}
                      required
                      helperText="Required — describe changes made in response to TAC comments"
                    />
                    <BilingualRemarkField
                      label="Resubmission comments to TAC"
                      pdfTitle="DPR Resubmission Comments to TAC"
                      pdfSubtitle={detail ? `${detail.proposalNo} — ${detail.title}` : undefined}
                      value={resubmitComments}
                      onChange={setResubmitComments}
                      minRows={2}
                    />
                  </>
                )}

                {!canResubmit && detail.status === 'dpr_revision' && (
                  <Alert severity="info">
                    {(readiness?.missingDocuments ?? []).map((d) => (
                      <Typography key={d} variant="caption" display="block">• Upload deliverable: {d}</Typography>
                    ))}
                    {!readiness?.hasCompletePdf && (
                      <Typography variant="caption" display="block">• Upload Revised Complete DPR PDF</Typography>
                    )}
                    {!readiness?.hasBoqExcel && (
                      <Typography variant="caption" display="block">• Upload BOQ Excel (required — auto-validated)</Typography>
                    )}
                    {readiness?.hasBoqExcel && !readiness?.boqValidationPassed && (
                      <Typography variant="caption" display="block">• Fix BOQ validation errors and re-upload Excel</Typography>
                    )}
                  </Alert>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={dprDialogActionsSx}>
        <Button onClick={onClose}>Close</Button>
        {canResubmit && (
          <Button variant="contained" color="primary" startIcon={<SendOutlinedIcon />}
            disabled={busy || !hasBilingualContent(observationResponse) || boqValidationFailed} onClick={resubmit}>
            Resubmit Revised DPR to TAC
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
