import { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Grid, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { constructionApi } from '../../services/api';

function isImageFileName(name: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

export default function DprPhotoGallery({
  projectId,
  documents,
}: {
  projectId: string;
  documents: Array<Record<string, unknown>>;
}) {
  const photoDocs = useMemo(
    () => documents.filter((doc) => String(doc.docType) === 'site_photo'),
    [documents],
  );
  const photoKey = photoDocs.map((doc) => String(doc.id)).join('|');

  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!photoDocs.length) {
        setLoading(false);
        setPreviewUrls({});
        setErrors({});
        return;
      }

      setLoading(true);
      const nextUrls: Record<string, string> = {};
      const nextErrors: Record<string, string> = {};

      await Promise.all(photoDocs.map(async (doc) => {
        const docId = String(doc.id);
        if (!isImageFileName(String(doc.fileName ?? ''))) return;
        try {
          const blob = await constructionApi.fetchDocumentFile(projectId, docId);
          if (!cancelled) {
            nextUrls[docId] = URL.createObjectURL(blob);
          }
        } catch {
          if (!cancelled) {
            nextErrors[docId] = 'Photo file not found — open Edit DPR and re-upload the image';
          }
        }
      }));

      if (!cancelled) {
        setPreviewUrls((prev) => {
          Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
          return nextUrls;
        });
        setErrors(nextErrors);
        setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      setPreviewUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return {};
      });
    };
  }, [projectId, photoKey, photoDocs]);

  const handleDownload = async (docId: string, fileName: string) => {
    const blob = await constructionApi.fetchDocumentFile(projectId, docId, true);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!photoDocs.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No geo-tagged photographs uploaded.
      </Typography>
    );
  }

  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1} py={1}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">Loading photographs…</Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {photoDocs.map((doc) => {
        const docId = String(doc.id);
        const fileName = String(doc.fileName ?? 'photo');
        const preview = previewUrls[docId];
        const err = errors[docId];

        return (
          <Grid item xs={12} sm={6} key={docId}>
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'grey.50',
              }}
            >
              {preview ? (
                <Box
                  component="img"
                  src={preview}
                  alt={fileName}
                  sx={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block', bgcolor: '#111' }}
                />
              ) : (
                <Box sx={{ p: 2, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color={err ? 'error' : 'text.secondary'} align="center">
                    {err ?? 'Preview unavailable'}
                  </Typography>
                </Box>
              )}
              <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" noWrap title={fileName} sx={{ flex: 1 }}>
                  {fileName}
                </Typography>
                <Button
                  size="small"
                  startIcon={<DownloadIcon fontSize="small" />}
                  onClick={() => { void handleDownload(docId, fileName); }}
                >
                  Download
                </Button>
              </Box>
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
}
