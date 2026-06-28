import { useRef, useState } from 'react';
import {
  Box, Button, Dialog, DialogContent, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ZoomInOutlinedIcon from '@mui/icons-material/ZoomInOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { readImageFile } from '../../utils/featureImage';

interface FeatureImageInputProps {
  value?: string | null;
  disabled?: boolean;
  saving?: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  onClear?: () => void;
}

const COMPACT_SIZE = { width: 32, height: 32 };

export default function FeatureImageInput({
  value,
  disabled,
  saving,
  compact,
  onChange,
  onClear,
}: FeatureImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [error, setError] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await readImageFile(file);
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyUrl = () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) {
      setError('Enter a valid image URL (https://…).');
      return;
    }
    setError('');
    onChange(trimmed);
    setUrlDraft('');
  };

  if (value) {
    const previewBoxSx = compact
      ? { ...COMPACT_SIZE, flexShrink: 0 }
      : { aspectRatio: '4/3' };

    return (
      <Box sx={compact ? { display: 'inline-flex' } : undefined}>
        <Box
          sx={{
            position: 'relative',
            borderRadius: compact ? 0.75 : 2,
            overflow: 'hidden',
            bgcolor: '#e2e8f0',
            border: 1,
            borderColor: 'divider',
            ...previewBoxSx,
          }}
        >
          <Box
            component="img"
            src={value}
            alt="Feature"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              setZoomOpen(true);
            }}
            sx={{
              position: 'absolute',
              bottom: compact ? 1 : 8,
              left: compact ? 1 : 8,
              p: compact ? 0.2 : undefined,
              bgcolor: 'rgba(15, 23, 42, 0.55)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.75)' },
            }}
            aria-label="Zoom image"
          >
            <ZoomInOutlinedIcon sx={{ fontSize: compact ? 13 : 18 }} />
          </IconButton>
          {!disabled && onClear && (
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
              disabled={saving}
              sx={{
                position: 'absolute',
                top: compact ? 1 : 8,
                right: compact ? 1 : 8,
                p: compact ? 0.2 : undefined,
                bgcolor: 'rgba(255,255,255,0.92)',
                '&:hover': { bgcolor: '#fff' },
              }}
              aria-label="Remove image"
            >
              <DeleteOutlineIcon sx={{ fontSize: compact ? 13 : undefined }} />
            </IconButton>
          )}
        </Box>
        {!compact && !disabled && (
          <Button
            size="small"
            startIcon={<PhotoCameraOutlinedIcon />}
            disabled={saving}
            onClick={() => fileInputRef.current?.click()}
            sx={{ mt: 1 }}
          >
            Replace image
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => { void handleFile(event.target.files?.[0]); }}
        />
        <Dialog
          open={zoomOpen}
          onClose={() => setZoomOpen(false)}
          maxWidth="md"
          fullWidth
          onClick={(event) => event.stopPropagation()}
        >
          <Box display="flex" justifyContent="flex-end" p={1}>
            <IconButton size="small" onClick={() => setZoomOpen(false)} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Box>
          <DialogContent sx={{ pt: 0, display: 'flex', justifyContent: 'center' }}>
            <Box
              component="img"
              src={value}
              alt="Feature preview"
              sx={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 1 }}
            />
          </DialogContent>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box>
      {compact ? (
        <IconButton
          size="small"
          disabled={disabled || saving}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            ...COMPACT_SIZE,
            border: 1,
            borderColor: 'divider',
            borderRadius: 0.75,
            bgcolor: '#f8fafc',
          }}
          aria-label="Upload image"
        >
          <PhotoCameraOutlinedIcon fontSize="small" color="action" />
        </IconButton>
      ) : (
        <Stack spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<PhotoCameraOutlinedIcon />}
            disabled={disabled || saving}
            onClick={() => fileInputRef.current?.click()}
            sx={{ justifyContent: 'flex-start' }}
          >
            Upload image
          </Button>
          <TextField
            size="small"
            placeholder="Or paste image URL…"
            value={urlDraft}
            disabled={disabled || saving}
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyUrl();
            }}
            InputProps={{
              startAdornment: <LinkOutlinedIcon fontSize="small" color="action" sx={{ mr: 1 }} />,
            }}
          />
          <Button
            size="small"
            variant="text"
            disabled={disabled || saving || !urlDraft.trim()}
            onClick={applyUrl}
          >
            Use URL
          </Button>
          <Typography variant="caption" color="text.secondary">
            JPG, PNG or WebP · max 2 MB
          </Typography>
        </Stack>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => { void handleFile(event.target.files?.[0]); }}
      />
      {error && (
        <Typography variant="caption" color="error" display="block" mt={1}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
