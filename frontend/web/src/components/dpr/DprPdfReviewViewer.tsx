import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogContent, Divider, IconButton, LinearProgress,
  List, ListItem, ListItemText, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined';
import HighlightOutlinedIcon from '@mui/icons-material/HighlightOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import axios from 'axios';
import { dprPdfReviewApi, dprPlanningApi } from '../../services/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type AnnotationTool = 'freehand' | 'highlight' | 'sticky_note';

type PdfAnnotation = {
  id: string;
  pageNumber: number;
  annotationType: string;
  geometry: Record<string, unknown>;
  color: string;
  content?: string | null;
};

type PdfComment = {
  id: string;
  pageNumber?: number | null;
  body: string;
  annotationId?: string | null;
  createdAt: string;
};

type Point = { x: number; y: number };

interface Props {
  open: boolean;
  proposalId: string;
  documentId: string;
  fileName?: string;
  readOnly?: boolean;
  onClose: () => void;
}

async function parseBlobErrorMessage(blob: Blob, fallback: string): Promise<string> {
  try {
    const text = await blob.slice(0, 4096).text();
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (typeof parsed.message === 'string') return parsed.message;
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
  } catch {
    /* not JSON */
  }
  return fallback;
}

async function resolveApiError(err: unknown, fallback: string): Promise<string> {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
    if (err.response?.data instanceof Blob) {
      return parseBlobErrorMessage(
        err.response.data,
        err.response.status === 404
          ? 'File not found on server — re-upload the DPR PDF from Stage 3'
          : fallback,
      );
    }
    if (err.response?.status === 404) {
      return 'File not found on server — re-upload the DPR PDF from Stage 3';
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function assertPdfBlob(blob: Blob): Promise<void> {
  if (!blob.size) {
    throw new Error('PDF file is empty — re-upload the DPR PDF from Stage 3');
  }
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const magic = String.fromCharCode(...head);
  if (magic.startsWith('%PDF')) return;
  throw new Error(await parseBlobErrorMessage(
    blob,
    'Server did not return a valid PDF — try Download DPR PDF or re-upload from Stage 3',
  ));
}

async function loadPdfBlob(proposalId: string, documentId: string): Promise<Blob> {
  let planningErr: unknown;
  try {
    const blob = await dprPlanningApi.fetchDocumentFile(proposalId, documentId);
    await assertPdfBlob(blob);
    return blob;
  } catch (err) {
    planningErr = err;
  }
  try {
    const blob = await dprPdfReviewApi.fetchPdfStream(proposalId, documentId);
    await assertPdfBlob(blob);
    return blob;
  } catch (streamErr) {
    throw planningErr ?? streamErr;
  }
}

export default function DprPdfReviewViewer({
  open,
  proposalId,
  documentId,
  fileName,
  readOnly = false,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const scale = 1.2;
  const [tool, setTool] = useState<AnnotationTool>('freehand');
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [comments, setComments] = useState<PdfComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [reviewStatus, setReviewStatus] = useState('open');
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const drawingRef = useRef<{ active: boolean; points: Point[]; start?: Point }>({
    active: false,
    points: [],
  });

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const reviewRes = await dprPdfReviewApi.getReview(proposalId, documentId);
      setReviewStatus(reviewRes.data.status ?? 'open');

      const [annRes, comRes, blob] = await Promise.all([
        dprPdfReviewApi.listAnnotations(proposalId, documentId).catch(() => ({ data: [] })),
        dprPdfReviewApi.listComments(proposalId, documentId).catch(() => ({ data: [] })),
        loadPdfBlob(proposalId, documentId),
      ]);
      setAnnotations(annRes.data ?? []);
      setComments(comRes.data ?? []);
      const buffer = await blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      pdfDocRef.current = pdf;
      setPageCount(pdf.numPages);
      setPageNumber(1);
    } catch (err) {
      setError(await resolveApiError(err, 'Failed to load PDF review'));
    } finally {
      setLoading(false);
    }
  }, [proposalId, documentId]);

  useEffect(() => {
    if (open) {
      loadSession();
    } else {
      pdfDocRef.current = null;
      setAnnotations([]);
      setComments([]);
      setPageCount(0);
      setPageNumber(1);
      setError('');
    }
  }, [open, loadSession]);

  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!pdf || !canvas || !overlay) return;

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    overlay.width = viewport.width;
    overlay.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport }).promise;
    drawAnnotationsOnOverlay(overlay, pageAnnotations);
  }, [pageNumber, scale, pageAnnotations]);

  useEffect(() => {
    if (open && pdfDocRef.current) {
      renderPage().catch(() => setError('Failed to render page'));
    }
  }, [open, renderPage]);

  const drawAnnotationsOnOverlay = (overlay: HTMLCanvasElement, items: PdfAnnotation[]) => {
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    for (const ann of items) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.annotationType === 'highlight' ? 12 : 2;
      ctx.globalAlpha = ann.annotationType === 'highlight' ? 0.35 : 1;
      if (ann.annotationType === 'freehand' && Array.isArray(ann.geometry.points)) {
        const pts = ann.geometry.points as Point[];
        if (pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i += 1) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      } else if (ann.annotationType === 'highlight' && ann.geometry.rect) {
        const r = ann.geometry.rect as { x: number; y: number; w: number; h: number };
        ctx.fillRect(r.x, r.y, r.w, r.h);
      } else if (ann.annotationType === 'sticky_note' && ann.geometry.point) {
        const p = ann.geometry.point as Point;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff9c4';
        ctx.strokeStyle = ann.color;
        ctx.fillRect(p.x, p.y, 140, 60);
        ctx.strokeRect(p.x, p.y, 140, 60);
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        const text = (ann.content ?? '').slice(0, 80);
        ctx.fillText(text, p.x + 6, p.y + 20, 128);
      }
      ctx.globalAlpha = 1;
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const overlay = overlayRef.current!;
    const rect = overlay.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * overlay.width,
      y: ((e.clientY - rect.top) / rect.height) * overlay.height,
    };
  };

  const persistAnnotation = async (payload: {
    annotationType: AnnotationTool;
    geometry: Record<string, unknown>;
    content?: string;
  }) => {
    const { data } = await dprPdfReviewApi.createAnnotation(proposalId, {
      documentId,
      pageNumber,
      annotationType: payload.annotationType,
      geometry: payload.geometry,
      color: '#e53935',
      content: payload.content,
    });
    setAnnotations((prev) => [...prev, data as PdfAnnotation]);
  };

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const pt = getCanvasPoint(e);
    if (tool === 'sticky_note') {
      const content = window.prompt('Sticky note text')?.trim();
      if (!content) return;
      persistAnnotation({
        annotationType: 'sticky_note',
        geometry: { point: pt },
        content,
      }).catch((err) => setError(getApiError(err, 'Could not save note')));
      return;
    }
    drawingRef.current = { active: true, points: [pt], start: pt };
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly || !drawingRef.current.active) return;
    const pt = getCanvasPoint(e);
    drawingRef.current.points.push(pt);
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (tool === 'freehand') {
      drawAnnotationsOnOverlay(overlay, pageAnnotations);
      const ctx = overlay.getContext('2d');
      if (!ctx || drawingRef.current.points.length < 2) return;
      const pts = drawingRef.current.points;
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    } else if (tool === 'highlight' && drawingRef.current.start) {
      drawAnnotationsOnOverlay(overlay, pageAnnotations);
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      const s = drawingRef.current.start;
      ctx.fillStyle = '#e53935';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(s.x, s.y, pt.x - s.x, pt.y - s.y);
      ctx.globalAlpha = 1;
    }
  };

  const handleOverlayMouseUp = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly || !drawingRef.current.active) return;
    const { points, start } = drawingRef.current;
    const end = e ? getCanvasPoint(e) : points[points.length - 1];
    drawingRef.current = { active: false, points: [] };
    if (tool === 'freehand' && points.length >= 2) {
      persistAnnotation({ annotationType: 'freehand', geometry: { points } })
        .catch((err) => setError(getApiError(err, 'Could not save drawing')));
    } else if (tool === 'highlight' && start && end) {
      persistAnnotation({
        annotationType: 'highlight',
        geometry: {
          rect: {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            w: Math.abs(end.x - start.x),
            h: Math.abs(end.y - start.y),
          },
        },
      }).catch((err) => setError(getApiError(err, 'Could not save highlight')));
    }
  };

  const submitComment = async () => {
    const body = commentDraft.trim();
    if (!body) return;
    try {
      const { data } = await dprPdfReviewApi.createComment(proposalId, {
        documentId,
        pageNumber,
        body,
      });
      setComments((prev) => [...prev, data as PdfComment]);
      setCommentDraft('');
    } catch (err) {
      setError(getApiError(err, 'Could not post comment'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Box display="flex" flexDirection="column" height="100vh" bgcolor="#1e1e1e">
        <Box display="flex" alignItems="center" gap={1} px={2} py={1} bgcolor="#2d2d2d" color="#fff">
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            DPR PDF Review — {fileName ?? 'document.pdf'}
          </Typography>
          <Typography variant="caption" sx={{ mr: 2 }}>
            Status: {reviewStatus} · Page {pageNumber}/{pageCount || '—'}
          </Typography>
          {!readOnly && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={tool}
              onChange={(_, v) => v && setTool(v)}
              sx={{ bgcolor: '#fff', mr: 1 }}
            >
              <ToggleButton value="freehand"><DrawOutlinedIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="highlight"><HighlightOutlinedIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="sticky_note"><StickyNote2OutlinedIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          )}
          <IconButton color="inherit" onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1}>
            <ChevronLeftIcon />
          </IconButton>
          <IconButton color="inherit" onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))} disabled={pageNumber >= pageCount}>
            <ChevronRightIcon />
          </IconButton>
          <IconButton color="inherit" onClick={onClose}><CloseIcon /></IconButton>
        </Box>

        {loading && <LinearProgress />}
        {error && (
          <Alert severity="error" sx={{ m: 1 }} onClose={() => setError('')}>{error}</Alert>
        )}

        <Box display="flex" flex={1} minHeight={0}>
          <Box ref={containerRef} flex={1} overflow="auto" display="flex" justifyContent="center" p={2}>
            <Box position="relative" sx={{ boxShadow: 4 }}>
              <canvas ref={canvasRef} style={{ display: 'block' }} />
              <canvas
                ref={overlayRef}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  cursor: readOnly ? 'default' : 'crosshair',
                }}
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
                onMouseLeave={handleOverlayMouseUp}
              />
            </Box>
          </Box>

          <Box width={320} bgcolor="#fafafa" borderLeft="1px solid #ddd" display="flex" flexDirection="column">
            <Box px={2} py={1.5}>
              <Typography variant="subtitle2" display="flex" alignItems="center" gap={0.5}>
                <CommentOutlinedIcon fontSize="small" /> Review Panel
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Phase 1 — comments &amp; annotations on page {pageNumber}
              </Typography>
            </Box>
            <Divider />
            <List dense sx={{ flex: 1, overflow: 'auto' }}>
              {comments.length === 0 && (
                <ListItem><ListItemText primary="No comments yet" secondary="Add a discussion note below" /></ListItem>
              )}
              {comments.map((c) => (
                <ListItem key={c.id} alignItems="flex-start">
                  <ListItemText
                    primary={c.body}
                    secondary={c.pageNumber ? `Page ${c.pageNumber}` : undefined}
                  />
                </ListItem>
              ))}
            </List>
            {!readOnly && (
              <Box p={2} borderTop="1px solid #ddd">
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                  placeholder="Add review comment…"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                />
                <Button fullWidth variant="contained" sx={{ mt: 1 }} onClick={submitComment} disabled={!commentDraft.trim()}>
                  Post Comment
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      <DialogContent sx={{ display: 'none' }} />
    </Dialog>
  );
}
