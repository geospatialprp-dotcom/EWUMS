import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { omApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DOC_STATUS_LABELS, HANDOVER_DOCUMENT_SLOTS } from '../../constants/omHandoverDocuments';
import { dataTableSx } from '../../utils/pagePresentationStyles';

type DocRow = {
  docType: string;
  label: string;
  category: string;
  document: {
    id: string;
    fileName?: string | null;
    fileUrl?: string | null;
    status: string;
    source: string;
    uploadedAt?: string;
    approvedAt?: string | null;
    approvedByLabel?: string | null;
    metadata?: { content?: unknown };
  } | null;
};

interface Props {
  handoverId: string | null;
  locked?: boolean;
  contractorView?: boolean;
  deptReviewMode?: boolean;
  readOnlyArchive?: boolean;
  onDocumentApproved?: () => void;
  onDocsChanged?: (summary: { requiredTotal: number; requiredApproved: number; requiredPending: number }) => void;
}

export default function OmHandoverDocuments({
  handoverId, locked, contractorView = false, deptReviewMode = false, readOnlyArchive = false, onDocumentApproved, onDocsChanged,
}: Props) {
  const { user, hasPermission } = useAuth();
  const roles = user?.roles ?? [];
  const isDeptReviewer = roles.some((r) => ['je', 'ae', 'ee'].includes(r));
  const canApprove = hasPermission('om:approve') || hasPermission('om:update') || isDeptReviewer;
  const [rows, setRows] = useState<DocRow[]>([]);
  const [error, setError] = useState('');
  const [busyType, setBusyType] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState('');

  const load = useCallback(() => {
    if (!handoverId) {
      const empty = HANDOVER_DOCUMENT_SLOTS.map((s) => ({
        docType: s.type,
        label: s.label,
        category: s.category,
        document: null,
      }));
      setRows(empty);
      onDocsChanged?.({ requiredTotal: 0, requiredApproved: 0, requiredPending: 0 });
      return;
    }
    omApi.listHandoverDocuments(handoverId)
      .then((r) => {
        const next = Array.isArray(r.data) && r.data.length ? r.data : HANDOVER_DOCUMENT_SLOTS.map((s) => ({
          docType: s.type,
          label: s.label,
          category: s.category,
          document: null,
        }));
        setRows(next);
        const required = next.filter((row) => row.category === 'required');
        const requiredApproved = required.filter((row) => row.document?.status === 'approved').length;
        const requiredPending = required.filter(
          (row) => row.document && ['uploaded', 'submitted'].includes(row.document.status),
        ).length;
        onDocsChanged?.({
          requiredTotal: required.length,
          requiredApproved,
          requiredPending,
        });
      })
      .catch(() => {
        setRows(HANDOVER_DOCUMENT_SLOTS.map((s) => ({
          docType: s.type,
          label: s.label,
          category: s.category,
          document: null,
        })));
        setError('Document repository is initializing — refresh after backend restart. If upload fails, run migration 028.');
      });
  }, [handoverId, onDocsChanged]);

  useEffect(() => { load(); }, [load]);

  const triggerUpload = (docType: string) => {
    setPendingDocType(docType);
    fileRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !handoverId || !pendingDocType) return;
    setBusyType(pendingDocType);
    setError('');
    try {
      await omApi.uploadHandoverDocument(handoverId, pendingDocType, file);
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed');
    } finally {
      setBusyType('');
      setPendingDocType('');
    }
  };

  const downloadDoc = async (docId: string, fileName: string) => {
    if (!handoverId) return;
    try {
      const blob = await omApi.fetchHandoverDocumentFile(handoverId, docId);
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

  const act = async (docId: string, action: 'approve' | 'reject') => {
    if (!handoverId) return;
    setError('');
    try {
      await omApi.actOnHandoverDocument(handoverId, docId, { action });
      load();
      onDocumentApproved?.();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed');
    }
  };

  const statusColor = (status: string): 'default' | 'warning' | 'success' | 'error' => {
    if (status === 'approved') return 'success';
    if (status === 'submitted' || status === 'uploaded') return 'warning';
    if (status === 'rejected') return 'error';
    return 'default';
  };

  if (!handoverId) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Save the handover draft first to open the electronic document repository.
      </Alert>
    );
  }

  const required = rows.filter((r) => r.category === 'required');
  const generated = rows.filter((r) => r.category === 'generated');
  const approvedRequired = required.filter((r) => r.document?.status === 'approved').length;
  const pendingRequired = required.filter(
    (r) => r.document && ['uploaded', 'submitted'].includes(r.document.status),
  ).length;

  return (
    <Box mb={2}>
      <input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={onFilePicked} />
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}

      {readOnlyArchive && (
        <Alert severity="success" sx={{ mb: 1.5 }}>
          Department-approved contractor documents are kept here permanently for audit and demo reference.
        </Alert>
      )}

      {deptReviewMode && canApprove && !readOnlyArchive && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          <strong>Step 1 — JE document check:</strong> download each file, then click <strong>Approve</strong> on every uploaded document ({approvedRequired}/{required.length} approved).
          Handover approval unlocks after all required documents are approved.
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>Electronic Document Repository (e-DMS)</Typography>
          <Typography variant="caption" color="text.secondary">
            {contractorView
              ? 'Upload completion documents · Submit handover when all verifications are complete'
              : 'Upload completion documents · Department verifies & approves · '}
            {!contractorView && `${approvedRequired}/${required.length} required docs approved`}
          </Typography>
        </Box>
      </Box>

      <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
        REQUIRED — UPLOAD & DEPARTMENT APPROVAL
      </Typography>
      <Box sx={dataTableSx()} mb={2}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Document</TableCell>
              <TableCell>File</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {required.map((row) => {
              const doc = row.document;
              return (
                <TableRow key={row.docType}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell>
                    {doc?.fileName ? (
                      <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>{doc.fileName}</Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Not uploaded</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={DOC_STATUS_LABELS[doc?.status ?? 'pending'] ?? 'Pending'}
                      color={statusColor(doc?.status ?? 'pending')}
                      variant="outlined"
                    />
                    {doc?.status === 'approved' && (doc.approvedByLabel || doc.approvedAt) && (
                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                        {doc.approvedByLabel ? `By ${doc.approvedByLabel}` : 'Department approved'}
                        {doc.approvedAt ? ` · ${new Date(doc.approvedAt).toLocaleString()}` : ''}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {!locked && (
                      <Tooltip title="Upload / replace">
                        <span>
                          <IconButton
                            size="small"
                            disabled={busyType === row.docType}
                            onClick={() => triggerUpload(row.docType)}
                          >
                            <CloudUploadOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    {doc?.fileUrl && (
                      <Tooltip title="Download / view">
                        <IconButton
                          size="small"
                          onClick={() => downloadDoc(doc.id, doc.fileName ?? 'document')}
                        >
                          <DownloadOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canApprove && !readOnlyArchive && (doc?.status === 'submitted' || doc?.status === 'uploaded') && (
                      <>
                        {deptReviewMode ? (
                          <>
                            <Button
                              size="small"
                              color="success"
                              variant="contained"
                              sx={{ ml: 0.5 }}
                              onClick={() => act(doc.id, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ ml: 0.5 }}
                              onClick={() => act(doc.id, 'reject')}
                            >
                              Reject
                            </Button>
                          </>
                        ) : (
                          <>
                            <Tooltip title="Approve (Department)">
                              <IconButton size="small" color="success" onClick={() => act(doc.id, 'approve')}>
                                <CheckCircleOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton size="small" color="error" onClick={() => act(doc.id, 'reject')}>
                                <CancelOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
        GENERATED — SYSTEM OUTPUTS (after Generate Outputs)
      </Typography>
      <Box sx={dataTableSx()}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Document</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {generated.map((row) => (
              <TableRow key={row.docType}>
                <TableCell>{row.label}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.document ? 'Ready' : 'Not generated'}
                    color={row.document ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {!HANDOVER_DOCUMENT_SLOTS.length && (
        <Typography variant="body2" color="text.secondary">No document types configured.</Typography>
      )}
    </Box>
  );
}
