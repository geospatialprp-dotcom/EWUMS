import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, MenuItem, Select,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import {
  OM_CONSUMER_SERVICE_TYPES,
  connectionStatusColor,
  requestStatusColor,
  type OmConsumerServiceType,
} from '../../constants/omConsumerService';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { OmDialogHeader, omDialogActionsSx, omDialogContentSx, omDialogPaperSx } from './omUi';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { parseBilingualText, serializeBilingualText } from '../../utils/bilingualText';
import { formatCoordinatePair } from '../../utils/coordinateFields';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';

type ConsumerRow = {
  id: string;
  consumerCode: string;
  fhtcNumber: string;
  consumerName?: string | null;
  mobile?: string | null;
  village?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  meterNumber?: string | null;
  meterType?: string | null;
  connectionStatus: string;
  connectionStatusLabel?: string;
};

type ServiceRequestRow = {
  id: string;
  requestNo: string;
  requestType: string;
  requestTypeLabel?: string;
  status: string;
  createdAt: string;
  consumerId?: string;
  fhtcNumber?: string | null;
  consumerCode?: string | null;
  consumerName?: string | null;
  mobile?: string | null;
  village?: string | null;
  connectionStatus?: string | null;
  source?: string | null;
};

type ProjectOption = { id: string; name: string; projectCode: string };

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function OmConsumerServiceStage() {
  const canViewAll = useCanViewAllDivisions();
  const [rows, setRows] = useState<ConsumerRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState<ConsumerRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState<ConsumerRow | null>(null);
  const [history, setHistory] = useState<ServiceRequestRow[]>([]);
  const [openRequests, setOpenRequests] = useState<ServiceRequestRow[]>([]);

  const [registerForm, setRegisterForm] = useState({
    fhtcNumber: '',
    consumerName: '',
    mobile: '',
    village: '',
    latitude: '',
    longitude: '',
    meterNumber: '',
    meterType: '',
    connectionStatus: 'active',
  });

  const [serviceForm, setServiceForm] = useState({
    requestType: 'disconnection' as OmConsumerServiceType,
    notes: '',
    newMeterNumber: '',
    newMeterType: '',
    newOwnerName: '',
    newMobile: '',
  });

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.allSettled([
      omApi.listConsumers({
        projectCode: selectedProject?.projectCode,
        status: statusFilter || undefined,
      }),
      omApi.consumerSummary(selectedProject?.id),
      omApi.listOpenConsumerServiceRequests({
        projectId: selectedProject?.id,
        projectCode: selectedProject?.projectCode,
        status: 'requested',
      }),
    ])
      .then((results) => {
        const [listRes, sumRes, openRes] = results;
        if (listRes.status === 'fulfilled') setRows(listRes.value.data ?? []);
        if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data ?? {});
        if (openRes.status === 'fulfilled') setOpenRequests(openRes.value.data ?? []);
        const failed = results.find((r) => r.status === 'rejected');
        if (failed && failed.status === 'rejected') {
          setError(getApiError(failed.reason, 'Failed to load consumer service data'));
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to load consumers')))
      .finally(() => setBusy(false));
  }, [selectedProject, statusFilter]);

  useEffect(() => {
    projectsApi.list()
      .then((res) => {
        const list = (res.data ?? []) as ProjectOption[];
        setProjects(list);
        if (list.length && !selectedProject) setSelectedProject(list[0]);
      })
      .catch(() => setError('Failed to load projects'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRegister = () => {
    if (!registerForm.fhtcNumber.trim()) {
      setError('FHTC number is required');
      return;
    }
    setBusy(true);
    omApi.registerConsumer({
      projectCode: selectedProject?.projectCode,
      fhtcNumber: registerForm.fhtcNumber.trim(),
      consumerName: registerForm.consumerName.trim() || undefined,
      mobile: registerForm.mobile.trim() || undefined,
      village: registerForm.village.trim() || undefined,
      latitude: registerForm.latitude ? Number(registerForm.latitude) : undefined,
      longitude: registerForm.longitude ? Number(registerForm.longitude) : undefined,
      meterNumber: registerForm.meterNumber.trim() || undefined,
      meterType: registerForm.meterType.trim() || undefined,
      connectionStatus: registerForm.connectionStatus,
    })
      .then(() => {
        setRegisterOpen(false);
        setRegisterForm({
          fhtcNumber: '', consumerName: '', mobile: '', village: '',
          latitude: '', longitude: '', meterNumber: '', meterType: '', connectionStatus: 'active',
        });
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to register consumer')))
      .finally(() => setBusy(false));
  };

  const openService = (row: ConsumerRow) => {
    setServiceOpen(row);
    const defaultType = row.connectionStatus === 'disconnected' ? 'reconnection' : 'disconnection';
    setServiceForm({
      requestType: defaultType,
      notes: '',
      newMeterNumber: '',
      newMeterType: '',
      newOwnerName: '',
      newMobile: '',
    });
  };

  const handleServiceRequest = () => {
    if (!serviceOpen) return;
    setBusy(true);
    omApi.createConsumerServiceRequest(serviceOpen.id, {
      requestType: serviceForm.requestType,
      notes: serviceForm.notes.trim() || undefined,
      newMeterNumber: serviceForm.newMeterNumber.trim() || undefined,
      newMeterType: serviceForm.newMeterType.trim() || undefined,
      newOwnerName: serviceForm.newOwnerName.trim() || undefined,
      newMobile: serviceForm.newMobile.trim() || undefined,
    })
      .then(() => {
        setServiceOpen(null);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to create service request')))
      .finally(() => setBusy(false));
  };

  const openHistory = (row: ConsumerRow) => {
    setHistoryOpen(row);
    omApi.listConsumerServiceRequests(row.id)
      .then((res) => setHistory(res.data ?? []))
      .catch((err) => setError(getApiError(err, 'Failed to load service history')));
  };

  const completeRequest = (consumerId: string, requestId: string) => {
    omApi.completeConsumerServiceRequest(consumerId, requestId)
      .then(() => {
        if (historyOpen) openHistory(historyOpen);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to complete request')));
  };

  const completeOpenRequest = (request: ServiceRequestRow) => {
    if (!request.consumerId) return;
    completeRequest(request.consumerId, request.id);
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Total Consumers">
            <Typography variant="h5" fontWeight={700}>{summary.total ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Active">
            <Typography variant="h5" fontWeight={700} color="success.main">{summary.active ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Disconnected">
            <Typography variant="h5" fontWeight={700} color="error.main">{summary.disconnected ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <SurfaceCard title="Open Requests">
            <Typography variant="h5" fontWeight={700} color="warning.main">{summary.openRequests ?? 0}</Typography>
          </SurfaceCard>
        </Grid>
      </Grid>

      {openRequests.length > 0 && (
        <Box mb={2}>
        <SurfaceCard title={`Open Service Requests (${openRequests.length})`}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Portal and office submissions awaiting action. Includes unassigned scheme records from the consumer portal.
          </Typography>
          <TableContainer>
            <Table size="small" sx={dataTableSx()}>
              <TableHead>
                <TableRow>
                  <TableCell>Request</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>FHTC</TableCell>
                  <TableCell>Name / Mobile</TableCell>
                  <TableCell>Village</TableCell>
                  <TableCell>Connection</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {openRequests.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.requestNo}</TableCell>
                    <TableCell>{r.requestTypeLabel ?? r.requestType}</TableCell>
                    <TableCell>{r.fhtcNumber ?? '—'}</TableCell>
                    <TableCell>
                      {r.consumerName ?? '—'}
                      {r.mobile ? ` · ${r.mobile}` : ''}
                    </TableCell>
                    <TableCell>{r.village ?? '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.connectionStatus ?? '—'} color={connectionStatusColor(String(r.connectionStatus ?? ''))} />
                    </TableCell>
                    <TableCell>{r.source === 'consumer_portal' ? 'Portal' : 'Office'}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" onClick={() => completeOpenRequest(r)} disabled={busy}>
                        Complete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SurfaceCard>
        </Box>
      )}

      <SurfaceCard
        header={(
          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" flexWrap="wrap" gap={1}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Consumer Database</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Scheme / Project</InputLabel>
                <Select label="Scheme / Project" value={selectedProject?.id ?? ''}
                  onChange={(e) => setSelectedProject(projects.find((p) => p.id === e.target.value) ?? null)}>
                  {canViewAll && <MenuItem value="">All schemes</MenuItem>}
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="disconnected">Disconnected</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" size="small" startIcon={<AddOutlinedIcon />} onClick={() => setRegisterOpen(true)}>
                Register Consumer
              </Button>
            </Box>
          </Box>
        )}
      >
        <Box display="flex" gap={0.75} mb={2} flexWrap="wrap">
          {OM_CONSUMER_SERVICE_TYPES.map((t) => (
            <Chip key={t.type} size="small" variant="outlined" label={t.label} />
          ))}
        </Box>

        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No consumers registered yet.</Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={dataTableSx()}>
              <TableHead>
                <TableRow>
                  <TableCell>Consumer ID</TableCell>
                  <TableCell>FHTC</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Village</TableCell>
                  <TableCell>Meter</TableCell>
                  <TableCell>GIS</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.consumerCode}</TableCell>
                    <TableCell>{row.fhtcNumber}</TableCell>
                    <TableCell>{row.consumerName ?? '—'}</TableCell>
                    <TableCell>{row.mobile ?? '—'}</TableCell>
                    <TableCell>{row.village ?? '—'}</TableCell>
                    <TableCell>{row.meterNumber ? `${row.meterNumber}${row.meterType ? ` (${row.meterType})` : ''}` : '—'}</TableCell>
                    <TableCell>{formatCoordinatePair(row.latitude, row.longitude)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.connectionStatusLabel ?? row.connectionStatus}
                        color={connectionStatusColor(row.connectionStatus)} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<BuildOutlinedIcon />} onClick={() => openService(row)} sx={{ mr: 0.5 }}>
                        Service
                      </Button>
                      <Button size="small" onClick={() => openHistory(row)}>History</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SurfaceCard>

      <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={9} title="Register Consumer / FHTC" busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <TextField fullWidth label="FHTC Number" margin="dense" required
            value={registerForm.fhtcNumber} onChange={(e) => setRegisterForm({ ...registerForm, fhtcNumber: e.target.value })} />
          <TextField fullWidth label="Consumer Name" margin="dense"
            value={registerForm.consumerName} onChange={(e) => setRegisterForm({ ...registerForm, consumerName: e.target.value })} />
          <TextField fullWidth label="Mobile Number" margin="dense"
            value={registerForm.mobile} onChange={(e) => setRegisterForm({ ...registerForm, mobile: e.target.value })} />
          <TextField fullWidth label="Village" margin="dense"
            value={registerForm.village} onChange={(e) => setRegisterForm({ ...registerForm, village: e.target.value })} />
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <TextField fullWidth label="Latitude" size="small" margin="dense"
                value={registerForm.latitude} onChange={(e) => setRegisterForm({ ...registerForm, latitude: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Longitude" size="small" margin="dense"
                value={registerForm.longitude} onChange={(e) => setRegisterForm({ ...registerForm, longitude: e.target.value })} />
            </Grid>
          </Grid>
          <TextField fullWidth label="Meter Number" margin="dense"
            value={registerForm.meterNumber} onChange={(e) => setRegisterForm({ ...registerForm, meterNumber: e.target.value })} />
          <TextField fullWidth label="Meter Type" margin="dense"
            value={registerForm.meterType} onChange={(e) => setRegisterForm({ ...registerForm, meterType: e.target.value })} />
          <FormControl fullWidth margin="dense">
            <InputLabel>Connection Status</InputLabel>
            <Select label="Connection Status" value={registerForm.connectionStatus}
              onChange={(e) => setRegisterForm({ ...registerForm, connectionStatus: e.target.value })}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="disconnected">Disconnected</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setRegisterOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRegister} disabled={busy}>Register</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(serviceOpen)} onClose={() => setServiceOpen(null)} maxWidth="sm" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={9} title="Service Request" subtitle={serviceOpen?.consumerCode} busy={busy} />
        <DialogContent sx={omDialogContentSx}>
          <FormControl fullWidth margin="dense">
            <InputLabel>Service Type</InputLabel>
            <Select label="Service Type" value={serviceForm.requestType}
              onChange={(e) => setServiceForm({ ...serviceForm, requestType: e.target.value as OmConsumerServiceType })}>
              {OM_CONSUMER_SERVICE_TYPES.map((t) => (
                <MenuItem key={t.type} value={t.type}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {serviceForm.requestType === 'meter_replacement' && (
            <>
              <TextField fullWidth label="New Meter Number" margin="dense"
                value={serviceForm.newMeterNumber} onChange={(e) => setServiceForm({ ...serviceForm, newMeterNumber: e.target.value })} />
              <TextField fullWidth label="New Meter Type" margin="dense"
                value={serviceForm.newMeterType} onChange={(e) => setServiceForm({ ...serviceForm, newMeterType: e.target.value })} />
            </>
          )}
          {serviceForm.requestType === 'ownership_transfer' && (
            <>
              <TextField fullWidth label="New Owner Name" margin="dense"
                value={serviceForm.newOwnerName} onChange={(e) => setServiceForm({ ...serviceForm, newOwnerName: e.target.value })} />
              <TextField fullWidth label="New Mobile" margin="dense"
                value={serviceForm.newMobile} onChange={(e) => setServiceForm({ ...serviceForm, newMobile: e.target.value })} />
            </>
          )}
          <BilingualRemarkField
            label="Notes"
            pdfTitle="Consumer Service Notes"
            value={parseBilingualText(serviceForm.notes)}
            onChange={(v) => setServiceForm({ ...serviceForm, notes: serializeBilingualText(v) })}
            minRows={2}
            margin="dense"
          />
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setServiceOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleServiceRequest} disabled={busy}>Submit Request</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(historyOpen)} onClose={() => setHistoryOpen(null)} maxWidth="md" fullWidth PaperProps={{ sx: omDialogPaperSx }}>
        <OmDialogHeader stage={9} title="Service History" subtitle={historyOpen?.consumerCode} />
        <DialogContent sx={omDialogContentSx}>
          {history.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No service requests yet.</Typography>
          ) : (
            <TableContainer>
              <Table size="small" sx={dataTableSx()}>
                <TableHead>
                  <TableRow>
                    <TableCell>Request</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{h.requestNo}</TableCell>
                      <TableCell>{h.requestTypeLabel ?? h.requestType}</TableCell>
                      <TableCell>
                        <Chip size="small" label={h.status} color={requestStatusColor(h.status)} />
                      </TableCell>
                      <TableCell>{new Date(h.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        {h.status === 'requested' && historyOpen && (
                          <Button size="small" onClick={() => completeRequest(historyOpen.id, h.id)}>Complete</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={omDialogActionsSx}>
          <Button onClick={() => setHistoryOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
