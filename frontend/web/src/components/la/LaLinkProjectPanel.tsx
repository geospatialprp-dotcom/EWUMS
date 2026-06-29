import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { featureClassesApi, landAcquisitionApi, projectsApi } from '../../services/api';

const DPR_GIS_WORKSPACE_STATUS = 'dpr_gis_workspace';

type ProjectOption = {
  id: string;
  name: string;
  code?: string;
  status?: string;
};

type Props = {
  caseId: string;
  compact?: boolean;
  /** Already linked GIS project on this LA case */
  linkedProjectId?: string | null;
  linkedProjectName?: string | null;
  linkedProjectCode?: string | null;
  linkedProjectStatus?: string | null;
  dprProposalId?: string | null;
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

function normalizeProject(raw: unknown): ProjectOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const id = typeof p.id === 'string' ? p.id : '';
  if (!id) return null;
  const code = typeof p.projectCode === 'string'
    ? p.projectCode
    : typeof p.code === 'string'
      ? p.code
      : undefined;
  return {
    id,
    name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Untitled project',
    code,
    status: typeof p.status === 'string' ? p.status : undefined,
  };
}

function formatProjectLabel(p: ProjectOption): string {
  const planning = p.status === DPR_GIS_WORKSPACE_STATUS ? ' · DPR planning' : '';
  return `${p.name}${p.code ? ` (${p.code})` : ''}${planning}`;
}

export default function LaLinkProjectPanel({
  caseId,
  compact = false,
  linkedProjectId,
  linkedProjectName,
  linkedProjectCode,
  linkedProjectStatus,
  dprProposalId,
  onLinked,
}: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [scaffoldLayers, setScaffoldLayers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAlreadyLinked = Boolean(linkedProjectId);

  useEffect(() => {
    setProjectsLoaded(false);
    projectsApi.list()
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setProjects(
          list
            .map((p) => normalizeProject(p))
            .filter((p): p is ProjectOption => p != null),
        );
      })
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoaded(true));
  }, []);

  useEffect(() => {
    if (linkedProjectId) {
      setSelectedId(linkedProjectId);
    }
  }, [linkedProjectId]);

  const projectOptions = useMemo(() => {
    const byId = new Map<string, ProjectOption>();
    for (const p of projects) byId.set(p.id, p);

    if (linkedProjectId && !byId.has(linkedProjectId)) {
      byId.set(linkedProjectId, {
        id: linkedProjectId,
        name: linkedProjectName?.trim() || 'Linked scheme',
        code: linkedProjectCode ?? undefined,
        status: linkedProjectStatus ?? undefined,
      });
    }

    const list = Array.from(byId.values());
    list.sort((a, b) => {
      if (a.id === linkedProjectId) return -1;
      if (b.id === linkedProjectId) return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [projects, linkedProjectId, linkedProjectName, linkedProjectCode, linkedProjectStatus]);

  const selectedOption = useMemo(
    () => projectOptions.find((p) => p.id === selectedId) ?? null,
    [projectOptions, selectedId],
  );

  const selectValue = useMemo(() => {
    if (!selectedId) return '';
    if (projectOptions.some((p) => p.id === selectedId)) return selectedId;
    if (linkedProjectId && selectedId === linkedProjectId) return linkedProjectId;
    return '';
  }, [selectedId, projectOptions, linkedProjectId]);

  const handleLink = () => {
    if (isAlreadyLinked) return;
    if (!selectedId) {
      setError('Select a project to link');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    landAcquisitionApi.linkProject(caseId, { projectId: selectedId })
      .then(async () => {
        if (scaffoldLayers) {
          await featureClassesApi.scaffoldLaGisLayers(selectedId).catch(() => undefined);
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
          {dprProposalId && !isAlreadyLinked
            ? ' DPR planning workspaces are included for schemes not yet registered as construction projects.'
            : ''}
        </Typography>
      )}

      <Stack direction={compact ? 'column' : { xs: 'column', sm: 'row' }} spacing={1.5} alignItems={compact ? 'stretch' : 'flex-start'}>
        <TextField
          select
          fullWidth
          size="small"
          label="GIS Project / Scheme"
          value={selectValue}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={busy || isAlreadyLinked}
          sx={{ minWidth: compact ? undefined : 280 }}
          SelectProps={{
            displayEmpty: true,
            renderValue: (value) => {
              if (!value) {
                return projectsLoaded ? 'Select project…' : 'Loading projects…';
              }
              const opt = projectOptions.find((p) => p.id === value);
              if (opt) return formatProjectLabel(opt);
              if (linkedProjectId === value && linkedProjectName) {
                return formatProjectLabel({
                  id: value,
                  name: linkedProjectName,
                  code: linkedProjectCode ?? undefined,
                  status: linkedProjectStatus ?? undefined,
                });
              }
              return selectedOption ? formatProjectLabel(selectedOption) : 'Select project…';
            },
          }}
        >
          {!isAlreadyLinked && (
            <MenuItem value="">
              <em>{projectsLoaded ? 'Select project…' : 'Loading projects…'}</em>
            </MenuItem>
          )}
          {projectOptions.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {formatProjectLabel(p)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant={isAlreadyLinked ? 'outlined' : 'contained'}
          color={isAlreadyLinked ? 'success' : 'primary'}
          startIcon={isAlreadyLinked ? <CheckCircleOutlineIcon /> : <LinkOutlinedIcon />}
          disabled={isAlreadyLinked || !selectedId || busy || !projectsLoaded}
          onClick={handleLink}
          sx={{ flexShrink: 0 }}
        >
          {isAlreadyLinked ? 'Linked' : 'Link Project'}
        </Button>
      </Stack>

      {!isAlreadyLinked && (
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
      )}
    </Box>
  );
}
