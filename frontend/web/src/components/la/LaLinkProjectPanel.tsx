import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import { featureClassesApi, landAcquisitionApi, projectsApi } from '../../services/api';

const DPR_GIS_WORKSPACE_STATUS = 'dpr_gis_workspace';

type SchemeOption = {
  /** Select value — project UUID or `dpr:<proposalId>` */
  selectId: string;
  projectId: string | null;
  dprProposalId?: string | null;
  label: string;
  status?: string;
};

type Props = {
  caseId: string;
  compact?: boolean;
  /** Already linked GIS project on this LA case (from parent detail) */
  linkedProjectId?: string | null;
  linkedProjectName?: string | null;
  linkedProjectCode?: string | null;
  linkedProjectStatus?: string | null;
  dprProposalId?: string | null;
  /** When true, auto-select and link if exactly one scheme is available */
  autoLinkSingleOption?: boolean;
  onLinked: () => void;
  /** Fired when routing-schemes resolves a linked project (incl. auto-provision) */
  onRoutingResolved?: (linkedProjectId: string | null) => void;
};

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

function normalizeProject(raw: unknown): SchemeOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const id = typeof p.id === 'string' ? p.id : '';
  if (!id) return null;
  const code = typeof p.projectCode === 'string'
    ? p.projectCode
    : typeof p.code === 'string'
      ? p.code
      : '';
  const name = typeof p.name === 'string' && p.name.trim() ? p.name : 'Untitled project';
  const status = typeof p.status === 'string' ? p.status : undefined;
  const planning = status === DPR_GIS_WORKSPACE_STATUS ? ' · DPR planning' : '';
  return {
    selectId: id,
    projectId: id,
    label: `${name}${code ? ` (${code})` : ''}${planning}`,
    status,
  };
}

export default function LaLinkProjectPanel({
  caseId,
  compact = false,
  linkedProjectId,
  linkedProjectName,
  linkedProjectCode,
  linkedProjectStatus,
  dprProposalId,
  autoLinkSingleOption = false,
  onLinked,
  onRoutingResolved,
}: Props) {
  const [schemeOptions, setSchemeOptions] = useState<SchemeOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [routingLinkedProjectId, setRoutingLinkedProjectId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [scaffoldLayers, setScaffoldLayers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const autoLinkAttemptedRef = useRef(false);
  const parentRefreshRequestedRef = useRef(false);
  const onLinkedRef = useRef(onLinked);
  const onRoutingResolvedRef = useRef(onRoutingResolved);

  useEffect(() => {
    onLinkedRef.current = onLinked;
    onRoutingResolvedRef.current = onRoutingResolved;
  });

  const effectiveLinkedProjectId = linkedProjectId ?? routingLinkedProjectId;
  const isAlreadyLinked = Boolean(effectiveLinkedProjectId);

  useEffect(() => {
    setOptionsLoaded(false);
    setRoutingLinkedProjectId(null);
    autoLinkAttemptedRef.current = false;
    parentRefreshRequestedRef.current = false;

    Promise.all([
      landAcquisitionApi.getRoutingSchemes(caseId).catch(() => ({ data: null })),
      projectsApi.list().catch(() => ({ data: [] as unknown[] })),
    ])
      .then(([schemesRes, projectsRes]) => {
        const bySelectId = new Map<string, SchemeOption>();

        const routing = schemesRes.data;
        const routingLinked = routing?.linkedProjectId ?? null;
        setRoutingLinkedProjectId(routingLinked);
        onRoutingResolvedRef.current?.(routingLinked);

        if (routingLinked && !linkedProjectId && !parentRefreshRequestedRef.current) {
          parentRefreshRequestedRef.current = true;
          onLinkedRef.current();
        }

        for (const scheme of routing?.schemes ?? []) {
          bySelectId.set(scheme.id, {
            selectId: scheme.id,
            projectId: scheme.projectId,
            dprProposalId: scheme.kind === 'dpr_scheme' && scheme.id.startsWith('dpr:')
              ? scheme.id.slice(4)
              : null,
            label: scheme.label,
            status: scheme.projectStatus,
          });
        }

        const projects = Array.isArray(projectsRes.data) ? projectsRes.data : [];
        for (const raw of projects) {
          const opt = normalizeProject(raw);
          if (!opt) continue;
          if (!bySelectId.has(opt.selectId)) {
            bySelectId.set(opt.selectId, opt);
          }
        }

        const effectiveLinked = routingLinked ?? linkedProjectId;
        if (effectiveLinked && !bySelectId.has(effectiveLinked)) {
          const code = linkedProjectCode ?? '';
          const planning = linkedProjectStatus === DPR_GIS_WORKSPACE_STATUS ? ' · DPR planning' : '';
          bySelectId.set(effectiveLinked, {
            selectId: effectiveLinked,
            projectId: effectiveLinked,
            label: `${linkedProjectName?.trim() || 'Linked scheme'}${code ? ` (${code})` : ''}${planning}`,
            status: linkedProjectStatus ?? undefined,
          });
        }

        const list = Array.from(bySelectId.values());
        list.sort((a, b) => {
          if (a.selectId === effectiveLinked) return -1;
          if (b.selectId === effectiveLinked) return 1;
          return a.label.localeCompare(b.label);
        });
        setSchemeOptions(list);

        const preselect = routingLinked ?? linkedProjectId ?? '';
        if (preselect) {
          setSelectedId(preselect);
        } else if (dprProposalId) {
          const dprKey = `dpr:${dprProposalId}`;
          if (bySelectId.has(dprKey)) setSelectedId(dprKey);
        } else if (list.length === 1) {
          setSelectedId(list[0].selectId);
        }
      })
      .catch(() => setSchemeOptions([]))
      .finally(() => setOptionsLoaded(true));
  }, [
    caseId,
    linkedProjectId,
    linkedProjectName,
    linkedProjectCode,
    linkedProjectStatus,
    dprProposalId,
  ]);

  useEffect(() => {
    if (linkedProjectId) {
      setSelectedId(linkedProjectId);
      setRoutingLinkedProjectId(linkedProjectId);
    }
  }, [linkedProjectId]);

  const selectValue = useMemo(() => {
    if (!selectedId) return '';
    if (schemeOptions.some((o) => o.selectId === selectedId)) return selectedId;
    if (effectiveLinkedProjectId && selectedId === effectiveLinkedProjectId) return effectiveLinkedProjectId;
    return '';
  }, [selectedId, schemeOptions, effectiveLinkedProjectId]);

  const selectedOption = useMemo(
    () => schemeOptions.find((o) => o.selectId === selectValue) ?? null,
    [schemeOptions, selectValue],
  );

  const performLink = useCallback((option: SchemeOption) => {
    setBusy(true);
    setError('');
    setSuccess('');

    const linkPayload = option.projectId
      ? { projectId: option.projectId }
      : option.dprProposalId
        ? { dprProposalId: option.dprProposalId }
        : { projectId: option.selectId };

    landAcquisitionApi.linkProject(caseId, linkPayload)
      .then(async (res) => {
        const linkedId = (res.data as { projectId?: string })?.projectId ?? option.projectId;
        if (linkedId) {
          setRoutingLinkedProjectId(linkedId);
          onRoutingResolvedRef.current?.(linkedId);
        }
        if (scaffoldLayers && linkedId) {
          await featureClassesApi.scaffoldLaGisLayers(linkedId).catch(() => undefined);
        }
        setSuccess('Project linked. You can now run auto-routing and GIS overlay analysis.');
        onLinkedRef.current();
      })
      .catch((err) => setError(getApiError(err, 'Failed to link project')))
      .finally(() => setBusy(false));
  }, [caseId, scaffoldLayers]);

  useEffect(() => {
    if (!autoLinkSingleOption || !optionsLoaded || isAlreadyLinked || busy) return;
    if (autoLinkAttemptedRef.current) return;
    if (schemeOptions.length !== 1) return;

    const only = schemeOptions[0];
    autoLinkAttemptedRef.current = true;
    setSelectedId(only.selectId);
    performLink(only);
  }, [autoLinkSingleOption, optionsLoaded, isAlreadyLinked, busy, schemeOptions, performLink]);

  const handleLink = () => {
    if (isAlreadyLinked) return;
    if (!selectedId) {
      setError('Select a project to link');
      return;
    }
    const option = schemeOptions.find((o) => o.selectId === selectedId);
    if (!option) {
      setError('Select a valid project or DPR scheme');
      return;
    }
    performLink(option);
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
                return optionsLoaded ? 'Select project…' : 'Loading projects…';
              }
              const opt = schemeOptions.find((o) => o.selectId === value);
              if (opt) return opt.label;
              if (effectiveLinkedProjectId === value && linkedProjectName) {
                const code = linkedProjectCode ? ` (${linkedProjectCode})` : '';
                const planning = linkedProjectStatus === DPR_GIS_WORKSPACE_STATUS ? ' · DPR planning' : '';
                return `${linkedProjectName}${code}${planning}`;
              }
              return selectedOption?.label ?? 'Select project…';
            },
          }}
        >
          {!isAlreadyLinked && (
            <MenuItem value="">
              <em>{optionsLoaded ? 'Select project…' : 'Loading projects…'}</em>
            </MenuItem>
          )}
          {schemeOptions.map((o) => (
            <MenuItem key={o.selectId} value={o.selectId}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant={isAlreadyLinked ? 'outlined' : 'contained'}
          color={isAlreadyLinked ? 'success' : 'primary'}
          startIcon={isAlreadyLinked ? <CheckCircleOutlineIcon /> : <LinkOutlinedIcon />}
          disabled={isAlreadyLinked || !selectedId || busy || !optionsLoaded}
          onClick={handleLink}
          sx={{ flexShrink: 0 }}
        >
          {isAlreadyLinked ? 'Linked' : busy && autoLinkSingleOption ? 'Linking…' : 'Link Project'}
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
