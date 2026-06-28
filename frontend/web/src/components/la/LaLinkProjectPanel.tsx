import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import axios from 'axios';
import { featureClassesApi, landAcquisitionApi, projectsApi } from '../../services/api';

type ProjectOption = { id: string; name: string; code?: string };

type Props = {
  caseId: string;
  compact?: boolean;
  onLinked: () => void;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function LaLinkProjectPanel({ caseId, compact = false, onLinked }: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState('');
  const [scaffoldLayers, setScaffoldLayers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setProjects(list
          .filter((p): p is ProjectOption => !!p && typeof p.id === 'string')
          .map((p) => ({ id: p.id, name: p.name ?? 'Untitled project', code: p.code })));
      })
      .catch(() => setProjects([]));
  }, []);

  const handleLink = () => {
    if (!projectId) {
      setError('Select a project to link');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    landAcquisitionApi.linkProject(caseId, { projectId })
      .then(async () => {
        if (scaffoldLayers) {
          await featureClassesApi.scaffoldLaGisLayers(projectId).catch(() => undefined);
        }
        setSuccess('Project linked. You can now run auto-routing and GIS overlay analysis.');
        onLinked();
      })
      .catch((err) => setError(getApiError(err, 'Failed to link project')))
      .finally(() => setBusy(false));
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1.5 }}>{success}</Alert>}

      {!compact && (
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Auto-routing, parcel identification, and clearance detection use GIS layers from the linked
          project&apos;s Feature Class Catalog (roads, forest, revenue parcels, etc.).
        </Typography>
      )}

      <Stack direction={compact ? 'column' : { xs: 'column', sm: 'row' }} spacing={1.5} alignItems={compact ? 'stretch' : 'flex-start'}>
        <TextField
          select
          fullWidth
          size="small"
          label="GIS Project / Scheme"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={busy}
          sx={{ minWidth: compact ? undefined : 280 }}
        >
          <MenuItem value="">Select project…</MenuItem>
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}{p.code ? ` (${p.code})` : ''}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          startIcon={<LinkOutlinedIcon />}
          disabled={!projectId || busy}
          onClick={handleLink}
          sx={{ flexShrink: 0 }}
        >
          Link Project
        </Button>
      </Stack>

      <FormControlLabel
        sx={{ mt: 0.5 }}
        control={(
          <Checkbox
            size="small"
            checked={scaffoldLayers}
            onChange={(e) => setScaffoldLayers(e.target.checked)}
            disabled={busy}
          />
        )}
        label={(
          <Typography variant="caption" color="text.secondary">
            Auto-create LA GIS layer templates in Feature Class Catalog (roads, forest, parcels, etc.)
          </Typography>
        )}
      />
    </Box>
  );
}
