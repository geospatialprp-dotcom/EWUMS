import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LinkIcon from '@mui/icons-material/Link';
import {
  hasOrthomosaicBasemap,
  normalizeOrthomosaicConfig,
  validateOrthomosaicTileUrl,
} from '../../utils/orthomosaicBasemap';
import { formatApiError } from '../../utils/apiError';

export type MapProjectOption = {
  id: string;
  name: string;
  orthomosaicConfig?: unknown;
};

interface OrthomosaicBasemapDialogProps {
  open: boolean;
  projects: MapProjectOption[];
  defaultProjectId?: string;
  onClose: () => void;
  onSubmitUrl: (projectId: string, tileUrl: string, name?: string) => Promise<void>;
  onUploadFile: (projectId: string, file: File, name?: string) => Promise<void>;
  onRemove?: (projectId: string) => Promise<void>;
}

const ALLOWED_EXTENSIONS = ['.tif', '.tiff', '.geotiff'];

function isGeoTiffFile(file: File) {
  const lower = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export default function OrthomosaicBasemapDialog({
  open,
  projects,
  defaultProjectId,
  onClose,
  onSubmitUrl,
  onUploadFile,
  onRemove,
}: OrthomosaicBasemapDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [projectId, setProjectId] = useState('');
  const [mosaicUrl, setMosaicUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projects, projectId],
  );

  const existingConfig = useMemo(
    () => normalizeOrthomosaicConfig(selectedProject?.orthomosaicConfig),
    [selectedProject],
  );

  useEffect(() => {
    if (!open) return;
    const initialProjectId = defaultProjectId && projects.some((p) => p.id === defaultProjectId)
      ? defaultProjectId
      : projects[0]?.id ?? '';
    setProjectId(initialProjectId);
    setError('');
    setSaving(false);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, defaultProjectId, projects]);

  useEffect(() => {
    if (!open || !projectId) return;
    const project = projects.find((p) => p.id === projectId);
    const config = normalizeOrthomosaicConfig(project?.orthomosaicConfig);
    setMosaicUrl(config?.sourceType === 'file' ? '' : (config?.tileUrl ?? ''));
    setDisplayName(config?.name?.trim() ?? '');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTab(config?.sourceType === 'file' ? 'upload' : config?.tileUrl ? 'url' : 'upload');
    setError('');
  }, [open, projectId, projects]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!isGeoTiffFile(file)) {
      setSelectedFile(null);
      setError('Please choose a GeoTIFF file (.tif, .tiff, .geotiff).');
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!projectId) {
      setError('Select a project first.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (tab === 'upload') {
        if (!selectedFile) {
          setError('Choose a GeoTIFF orthomosaic file to upload.');
          setSaving(false);
          return;
        }
        await onUploadFile(projectId, selectedFile, displayName.trim() || undefined);
      } else {
        const validationError = validateOrthomosaicTileUrl(mosaicUrl);
        if (validationError) {
          setError(validationError);
          setSaving(false);
          return;
        }
        await onSubmitUrl(
          projectId,
          mosaicUrl.trim(),
          displayName.trim() || undefined,
        );
      }
      onClose();
    } catch (err) {
      setError(formatApiError(err, 'Failed to save mosaic basemap.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!projectId || !onRemove) return;
    setSaving(true);
    setError('');
    try {
      await onRemove(projectId);
      onClose();
    } catch (err) {
      setError(formatApiError(err, 'Failed to remove orthomosaic.'));
    } finally {
      setSaving(false);
    }
  };

  const hasExistingOrthomosaic = hasOrthomosaicBasemap(existingConfig);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <UploadFileIcon color="primary" fontSize="small" />
        Drone orthomosaic
      </DialogTitle>
      <DialogContent dividers>
        {projects.length === 0 ? (
          <Alert severity="info">
            Create a project first, then upload an orthomosaic file or paste a tile URL.
          </Alert>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {projects.length > 1 && (
              <FormControl fullWidth margin="dense" sx={{ mb: 1 }}>
                <InputLabel id="ortho-project-label">Project</InputLabel>
                <Select
                  labelId="ortho-project-label"
                  label="Project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {projects.length === 1 && selectedProject && (
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Project: {selectedProject.name}
              </Typography>
            )}

            <Tabs
              value={tab}
              onChange={(_, value: 'upload' | 'url') => setTab(value)}
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab value="upload" label="Upload file" icon={<UploadFileIcon />} iconPosition="start" />
              <Tab value="url" label="Mosaic URL" icon={<LinkIcon />} iconPosition="start" />
            </Tabs>

            {tab === 'upload' ? (
              <Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Upload a georeferenced GeoTIFF orthomosaic. No tile URL needed — the file is stored on the server and shown on the map.
                </Typography>
                {existingConfig?.sourceType === 'file' && existingConfig.fileName && (
                  <Alert
                    severity="success"
                    sx={{ mb: 2 }}
                    action={onRemove ? (
                      <Button
                        color="inherit"
                        size="small"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => { void handleRemove(); }}
                        disabled={saving}
                      >
                        Remove
                      </Button>
                    ) : undefined}
                  >
                    Current file: {existingConfig.fileName}. Upload a new file to replace it.
                  </Alert>
                )}
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadFileIcon />}
                  fullWidth
                  sx={{ justifyContent: 'flex-start', textTransform: 'none', mb: 1 }}
                >
                  {selectedFile ? selectedFile.name : 'Choose GeoTIFF file (.tif)'}
                  <input
                    ref={fileInputRef}
                    hidden
                    type="file"
                    accept=".tif,.tiff,.geotiff,image/tiff"
                    onChange={handleFileChange}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  Max size 300 MB. File must include map coordinates (GeoTIFF).
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Or paste an XYZ tile URL if your orthomosaic is already published as web tiles.
                </Typography>
                <TextField
                  autoFocus
                  fullWidth
                  required
                  label="Mosaic URL"
                  margin="dense"
                  value={mosaicUrl}
                  onChange={(event) => setMosaicUrl(event.target.value)}
                  placeholder="https://tiles.example.com/drone/{z}/{x}/{y}.png"
                  helperText="Must include {z}, {x}, and {y}."
                />
              </Box>
            )}

            <TextField
              fullWidth
              label="Basemap label (optional)"
              margin="dense"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={selectedProject ? `${selectedProject.name} Drone` : 'Drone survey'}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
        <Box>
          {hasExistingOrthomosaic && onRemove && (
            <Button
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => { void handleRemove(); }}
              disabled={saving || projects.length === 0}
            >
              Remove orthomosaic
            </Button>
          )}
        </Box>
        <Box display="flex" gap={1}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => { void handleSubmit(); }}
            disabled={saving || projects.length === 0}
          >
            {saving ? 'Saving…' : tab === 'upload' ? 'Upload & apply' : 'Submit'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
