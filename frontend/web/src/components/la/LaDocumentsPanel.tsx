import { useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, LinearProgress, Tooltip, Typography,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import axios from 'axios';
import { landAcquisitionApi } from '../../services/api';
import { downloadLaDocumentHtml, openLaDocumentHtml } from '../../utils/laDocumentPdf';

type DocCatalogRow = {
  code: string;
  label: string;
  category: string;
  generated?: boolean;
  authority?: string;
  clearanceType?: string;
};

type DocRow = {
  id?: string;
  documentCode: string;
  title: string;
  status: string;
  category: string;
  generatedAt?: string;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

const CATEGORY_LABELS: Record<string, string> = {
  proposal: 'Proposals',
  letter: 'Letters',
  register: 'Registers',
  map: 'Maps',
  certificate: 'Certificates',
  summary: 'Summaries',
};

export default function LaDocumentsPanel({
  caseId,
  catalog,
  documents,
  onGenerated,
  canGenerate = true,
  hasParcels = true,
  hasClearances = false,
}: {
  caseId: string;
  catalog: DocCatalogRow[];
  documents: DocRow[];
  onGenerated: () => void;
  canGenerate?: boolean;
  hasParcels?: boolean;
  hasClearances?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const docMap = new Map(documents.map((d) => [d.documentCode, d]));
  const rows = catalog.length ? catalog : documents.map((d) => ({
    code: d.documentCode,
    label: d.title,
    category: d.category,
    generated: true,
  }));

  const byCategory = rows.reduce<Record<string, DocCatalogRow[]>>((acc, row) => {
    const cat = row.category || 'register';
    acc[cat] = acc[cat] ?? [];
    acc[cat].push(row);
    return acc;
  }, {});

  const pendingCount = rows.filter((r) => !docMap.get(r.code) && !r.generated).length;
  const generateDisabled = busy || !hasParcels || !rows.length;

  const generateAll = () => {
    setBusy(true);
    setError('');
    setSuccess('');
    landAcquisitionApi.generateDocuments(caseId)
      .then((res) => {
        const data = res.data as { generated?: number };
        setSuccess(`Generated ${data.generated ?? 0} document(s) for affected authorities`);
        onGenerated();
      })
      .catch((err) => setError(getApiError(err, 'Document generation failed')))
      .finally(() => setBusy(false));
  };

  const openDoc = (code: string, title: string, action: 'print' | 'download') => {
    setBusy(true);
    setError('');
    landAcquisitionApi.getDocument(caseId, code)
      .then((res) => {
        const html = String((res.data as { contentHtml?: string }).contentHtml ?? '');
        if (!html) throw new Error('Empty document');
        if (action === 'print') openLaDocumentHtml(html, title);
        else downloadLaDocumentHtml(html, `${title}-${caseId}`);
      })
      .catch((err) => setError(getApiError(err, 'Failed to open document')))
      .finally(() => setBusy(false));
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {busy && <LinearProgress sx={{ mb: 2 }} />}

      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
        <Typography variant="body2" color="text.secondary">
          Documents are shown only for authorities affected by the pipeline route (from parcel intersection
          and <strong>Detect Clearances</strong>). Run clearances before generating authority-specific letters.
          For a printable map with pipeline cover, centerline, and network circle markers, use
          <strong> Publish Acquisition Map</strong> on the Map tab.
        </Typography>
        {canGenerate && (
          <Tooltip
            title={
              !hasParcels
                ? 'Identify parcels first'
                : !rows.length
                  ? 'Run Detect Clearances to determine applicable authority documents'
                  : pendingCount
                    ? `Generate ${pendingCount} applicable document(s)`
                    : 'All applicable documents are up to date'
            }
          >
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={<AutoFixHighOutlinedIcon />}
                disabled={generateDisabled}
                onClick={generateAll}
              >
                Generate Applicable Documents
              </Button>
            </span>
          </Tooltip>
        )}
      </Box>

      {!hasClearances && hasParcels && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Run <strong>Detect Clearances</strong> on the Workflow tab to reveal authority-specific proposals
          and letters (Forest, Railway, PWD, Gram Sabha, Revenue).
        </Alert>
      )}

      {Object.entries(byCategory).map(([cat, items]) => (
        <Box key={cat} mb={2}>
          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            {CATEGORY_LABELS[cat] ?? cat}
          </Typography>
          <Grid container spacing={1}>
            {items.map((item) => {
              const saved = docMap.get(item.code);
              const isGenerated = Boolean(saved || item.generated);
              return (
                <Grid item xs={12} sm={6} md={4} key={item.code}>
                  <Box
                    p={1.5}
                    border={1}
                    borderColor="divider"
                    borderRadius={1}
                    height="100%"
                    display="flex"
                    flexDirection="column"
                    gap={1}
                  >
                    <Box display="flex" alignItems="flex-start" gap={1}>
                      <DescriptionOutlinedIcon fontSize="small" color="action" />
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
                        {item.authority && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {item.authority}
                          </Typography>
                        )}
                        <Chip
                          size="small"
                          label={isGenerated ? 'Generated' : 'Ready to generate'}
                          color={isGenerated ? 'success' : 'default'}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    </Box>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      <Tooltip title={isGenerated ? 'Open printable document' : 'Generate documents first'}>
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PictureAsPdfOutlinedIcon />}
                            disabled={busy || !isGenerated}
                            onClick={() => openDoc(item.code, item.label, 'print')}
                          >
                            Print / PDF
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title={isGenerated ? 'Download HTML' : 'Generate documents first'}>
                        <span>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<DownloadOutlinedIcon />}
                            disabled={busy || !isGenerated}
                            onClick={() => openDoc(item.code, item.label, 'download')}
                          >
                            HTML
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ))}

      {!rows.length && (
        <Typography variant="body2" color="text.secondary">
          {hasParcels
            ? 'No authority-specific documents apply yet. Run Detect Clearances after tracing the pipeline alignment.'
            : 'Identify parcels and trace alignment before documents can be generated.'}
        </Typography>
      )}
    </Box>
  );
}
