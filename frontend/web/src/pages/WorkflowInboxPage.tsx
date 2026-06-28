import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, MenuItem, Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SendIcon from '@mui/icons-material/Send';
import axios from 'axios';
import { workflowsApi, WorkflowInboxItem } from '../services/api';
import { useDivisionScope, useDivisionScopeKey } from '../context/DivisionContext';
import { useAuth } from '../context/AuthContext';
import { divisionScopeSubtitle } from '../utils/divisionAccess';
import { isSuperAdmin, SUPER_ADMIN_VIEW_ONLY_MESSAGE } from '../utils/operationalAccess';
import BilingualRemarkField from '../components/forms/BilingualRemarkField';
import { useBilingualRemark } from '../hooks/useBilingualRemark';
import PageShell from '../components/layout/PageShell';
import PageHeader from '../components/layout/PageHeader';
import KpiStatCard from '../components/layout/KpiStatCard';
import SurfaceCard from '../components/layout/SurfaceCard';
import { dataTableSx, styledTabsSx, surfaceCardSx } from '../utils/pagePresentationStyles';
function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401) return 'Your session has expired. Please sign in again.';
    const msg = err.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (!err.response) return 'Cannot connect to backend API. Ensure the API is running on port 3000.';
  }
  return 'Workflow request failed.';
}

export default function WorkflowInboxPage() {
  const { user } = useAuth();
  const { activeDivision } = useDivisionScope();
  const divisionScopeKey = useDivisionScopeKey();
  const canViewAllDivisions = user?.canViewAllDivisions ?? false;
  const superAdminViewOnly = isSuperAdmin(user?.roles);
  const scopeSubtitle = divisionScopeSubtitle(canViewAllDivisions, activeDivision);
  const [tab, setTab] = useState(0);
  const [inbox, setInbox] = useState<WorkflowInboxItem[]>([]);
  const [submissions, setSubmissions] = useState<Array<{
    id: string; title: string; resourceType: string; status: string;
    submittedAt: string; tasks: Array<{ stepName: string; status: string }>;
  }>>([]);
  const [definitions, setDefinitions] = useState<Array<{ code: string; name: string; resourceType: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionDialog, setActionDialog] = useState<{ taskId: string; title: string } | null>(null);
  const [submitDialog, setSubmitDialog] = useState(false);
  const { value: comments, setValue: setComments, serialized: serializedComments, reset: resetComments } = useBilingualRemark('');
  const [submitForm, setSubmitForm] = useState({ definitionCode: '', title: '', payload: '' });
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [inboxRes, submissionsRes, definitionsRes] = await Promise.all([
        workflowsApi.inbox(),
        workflowsApi.submissions(),
        workflowsApi.definitions(),
      ]);
      setInbox(inboxRes.data);
      setSubmissions(submissionsRes.data);
      setDefinitions(definitionsRes.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [divisionScopeKey]);

  const handleAct = async (action: 'approve' | 'reject') => {
    if (!actionDialog) return;
    setActionError('');
    try {
      await workflowsApi.actOnTask(actionDialog.taskId, { action, comments: serializedComments });
      setActionDialog(null);
      resetComments('');
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleSubmit = async () => {
    if (!submitForm.definitionCode || !submitForm.title.trim()) {
      setActionError('Workflow type and title are required.');
      return;
    }
    setActionError('');
    try {
      let payload = {};
      if (submitForm.payload.trim()) {
        payload = JSON.parse(submitForm.payload);
      }
      await workflowsApi.submit({
        definitionCode: submitForm.definitionCode,
        title: submitForm.title.trim(),
        payload,
      });
      setSubmitDialog(false);
      setSubmitForm({ definitionCode: '', title: '', payload: '' });
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const statusColor = (status: string) => {
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'error';
    if (status === 'pending') return 'warning';
    return 'default';
  };

  if (loading) {
    return <PageShell loading loadingLabel="Loading workflow center…" />;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Approvals"
        title="Workflow Center"
        subtitle={scopeSubtitle}
        accent="violet"
        actions={superAdminViewOnly ? undefined : (
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => { setActionError(''); setSubmitDialog(true); }}
            disabled={definitions.length === 0}
            sx={{ boxShadow: 2 }}
          >
            Submit Request
          </Button>
        )}
      />

      {superAdminViewOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>{SUPER_ADMIN_VIEW_ONLY_MESSAGE}</Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} md={3}>
          <KpiStatCard label="Pending Tasks" value={inbox.length} tone="amber" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiStatCard label="My Submissions" value={submissions.length} tone="blue" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiStatCard label="Workflow Types" value={definitions.length} tone="violet" />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiStatCard
            label="Approved"
            value={submissions.filter((s) => s.status === 'approved').length}
            tone="teal"
          />
        </Grid>
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={styledTabsSx()}>        <Tab label={`Inbox (${inbox.length})`} />
        <Tab label="My Submissions" />
        <Tab label="Workflow Definitions" />
      </Tabs>

      {tab === 0 && (
        <SurfaceCard title="Inbox" flush>
          <Table sx={dataTableSx()}>            <TableHead>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Step</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inbox.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No pending tasks for your role.
                  </TableCell>
                </TableRow>
              ) : inbox.map((item) => (
                <TableRow key={item.taskId} hover>
                  <TableCell>{item.instance.title}</TableCell>
                  <TableCell><Chip label={item.instance.resourceType} size="small" /></TableCell>
                  <TableCell>{item.stepName}</TableCell>
                  <TableCell>{new Date(item.instance.submittedAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    {superAdminViewOnly ? (
                      <Typography variant="caption" color="text.secondary">View only</Typography>
                    ) : (
                      <Button size="small" color="success" startIcon={<CheckCircleIcon />}
                        onClick={() => { setActionError(''); setActionDialog({ taskId: item.taskId, title: item.instance.title }); }}>
                        Review
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceCard>
      )}

      {tab === 1 && (
        <SurfaceCard title="My Submissions" flush>
          <Table sx={dataTableSx()}>            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {submissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">You have not submitted any workflow requests yet.</TableCell>
                </TableRow>
              ) : submissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.title}</TableCell>
                  <TableCell><Chip label={s.resourceType} size="small" /></TableCell>
                  <TableCell><Chip label={s.status} size="small" color={statusColor(s.status) as 'success'} /></TableCell>
                  <TableCell>{new Date(s.submittedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceCard>
      )}

      {tab === 2 && (
        <Grid container spacing={2}>
          {definitions.length === 0 ? (
            <Grid item xs={12}>
              <Typography color="text.secondary">No workflow definitions configured.</Typography>
            </Grid>
          ) : definitions.map((d) => (
            <Grid item xs={12} md={6} key={d.code}>
              <Box sx={{ ...surfaceCardSx(), p: 2.5 }}>
                <Typography variant="h6" fontWeight={700}>{d.name}</Typography>
                <Chip label={d.resourceType} size="small" sx={{ mt: 1 }} />
                <Typography variant="caption" display="block" mt={1} color="text.secondary">
                  Code: {d.code}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
      <Dialog open={!!actionDialog} onClose={() => setActionDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Review: {actionDialog?.title}</DialogTitle>
        <DialogContent>
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          <BilingualRemarkField
            label="Comments"
            pdfTitle="Workflow Review Comments"
            pdfSubtitle={actionDialog?.title}
            value={comments}
            onChange={setComments}
            minRows={3}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button color="error" startIcon={<CancelIcon />} onClick={() => handleAct('reject')}>Reject</Button>
          <Button variant="contained" color="success" startIcon={<CheckCircleIcon />}
            onClick={() => handleAct('approve')}>Approve</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={submitDialog} onClose={() => setSubmitDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Workflow Request</DialogTitle>
        <DialogContent>
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          <TextField select fullWidth label="Workflow Type" margin="dense" required
            value={submitForm.definitionCode}
            onChange={(e) => setSubmitForm({ ...submitForm, definitionCode: e.target.value })}>
            {definitions.map((d) => (
              <MenuItem key={d.code} value={d.code}>{d.name}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Title" margin="dense" required value={submitForm.title}
            onChange={(e) => setSubmitForm({ ...submitForm, title: e.target.value })} />
          <TextField fullWidth multiline rows={3} label="Payload (JSON, optional)" margin="dense"
            value={submitForm.payload} onChange={(e) => setSubmitForm({ ...submitForm, payload: e.target.value })}
            placeholder='{"assetCode":"PL-003","name":"New Pipeline"}' />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}