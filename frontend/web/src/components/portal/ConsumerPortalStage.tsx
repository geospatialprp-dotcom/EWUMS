import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, Grid, InputLabel, LinearProgress, MenuItem, Select, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import axios from 'axios';
import { consumerPortalApi } from '../../services/portalApi';
import { useConsumerPortal } from '../../context/ConsumerPortalContext';
import SurfaceCard from '../layout/SurfaceCard';
import KpiStatCard from '../layout/KpiStatCard';
import { OM_COMPLAINT_TYPES } from '../../constants/omComplaints';
import { formatInr, billStatusColor } from '../../constants/omBilling';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { openBillPrintView } from '../../utils/billExport';
import { openReceiptPrintView } from '../../utils/receiptExport';

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

const PORTAL_FEATURES = [
  'View Bills',
  'Download Receipts',
  'Payment History',
  'Register Complaints',
  'Apply New Connection',
  'Track Applications',
  'Update Mobile Number',
];

export default function ConsumerPortalStage() {
  const { consumer, logout } = useConsumerPortal();
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [bills, setBills] = useState<Array<Record<string, unknown>>>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [complaints, setComplaints] = useState<Array<Record<string, unknown>>>([]);
  const [applications, setApplications] = useState<Array<Record<string, unknown>>>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);

  const [complaintForm, setComplaintForm] = useState({
    complaintType: OM_COMPLAINT_TYPES[0].code,
    description: '',
    priority: 'medium',
  });
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);

  const [connectionForm, setConnectionForm] = useState({
    fhtcNumber: '',
    mobile: '',
    consumerName: '',
    village: '',
    ward: '',
    consumerCategory: 'apl',
    notes: '',
  });
  const [connectionOpen, setConnectionOpen] = useState(false);

  const [trackForm, setTrackForm] = useState({ requestNo: '', fhtcNumber: '', mobile: '' });
  const [trackResult, setTrackResult] = useState<Record<string, unknown> | null>(null);

  const [mobileForm, setMobileForm] = useState({ mobile: '' });
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    eventType: string;
    readAt?: string | null;
  }>>([]);

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.allSettled([
      consumerPortalApi.getProfile(),
      consumerPortalApi.listBills(),
      consumerPortalApi.listPayments(),
      consumerPortalApi.listComplaints(),
      consumerPortalApi.listApplications(),
      consumerPortalApi.listNotifications(),
    ])
      .then((results) => {
        const [prof, billRes, payRes, compRes, appRes, notifRes] = results;
        if (prof.status === 'fulfilled') setProfile(prof.value.data ?? null);
        if (billRes.status === 'fulfilled') setBills(billRes.value.data ?? []);
        if (payRes.status === 'fulfilled') setPayments(payRes.value.data ?? []);
        if (compRes.status === 'fulfilled') setComplaints(compRes.value.data ?? []);
        if (appRes.status === 'fulfilled') setApplications(appRes.value.data ?? []);
        if (notifRes.status === 'fulfilled') {
          setNotifications(notifRes.value.data?.items ?? []);
        }
        if (prof.status === 'fulfilled' && prof.value.data?.mobile) {
          setMobileForm({ mobile: String(prof.value.data.mobile) });
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to load portal data')))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleViewBill = (bill: Record<string, unknown>) => {
    setBusy(true);
    consumerPortalApi.getBill(String(bill.id))
      .then((res) => openBillPrintView((res.data ?? bill) as Record<string, unknown>))
      .catch(() => openBillPrintView(bill))
      .finally(() => setBusy(false));
  };

  const handleDownloadReceipt = (payment: Record<string, unknown>) => {
    setBusy(true);
    consumerPortalApi.getPayment(String(payment.id))
      .then((res) => openReceiptPrintView((res.data ?? payment) as Record<string, unknown>))
      .catch(() => openReceiptPrintView(payment))
      .finally(() => setBusy(false));
  };

  const handleRegisterComplaint = () => {
    if (complaintSubmitting) return;
    setComplaintSubmitting(true);
    setError('');
    consumerPortalApi.registerComplaint(complaintForm)
      .then((res) => {
        setComplaintOpen(false);
        setComplaintForm({ complaintType: OM_COMPLAINT_TYPES[0].code, description: '', priority: 'medium' });
        setSuccess(`Complaint registered: ${String(res.data?.complaintNo ?? '')}`);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to register complaint')))
      .finally(() => setComplaintSubmitting(false));
  };

  const handleApplyConnection = () => {
    if (!connectionForm.fhtcNumber.trim() || !connectionForm.mobile.trim()) {
      setError('FHTC number and mobile are required');
      setSuccess('');
      return;
    }
    setBusy(true);
    consumerPortalApi.applyNewConnection(connectionForm)
      .then((res) => {
        const appNo = String(res.data?.application?.requestNo ?? '');
        const fhtc = String(res.data?.consumer?.fhtcNumber ?? connectionForm.fhtcNumber.trim());
        const mobile = connectionForm.mobile.trim();
        setConnectionOpen(false);
        setConnectionForm({ fhtcNumber: '', mobile: '', consumerName: '', village: '', ward: '', consumerCategory: 'apl', notes: '' });
        setTrackForm({ requestNo: appNo, fhtcNumber: fhtc, mobile });
        setTrackResult(null);
        setError('');
        setSuccess(String(res.data?.message ?? `Application ${appNo} submitted`));
        setTab(4);
        load();
      })
      .catch((err) => { setSuccess(''); setError(getApiError(err, 'Failed to submit application')); })
      .finally(() => setBusy(false));
  };

  const openTrackForApplication = (application: Record<string, unknown>) => {
    setTrackForm({
      requestNo: String(application.requestNo ?? ''),
      fhtcNumber: String(application.fhtcNumber ?? ''),
      mobile: String(application.mobile ?? ''),
    });
    setTrackResult(null);
    setError('');
    setSuccess('');
    setTab(4);
  };

  const handleTrackApplication = () => {
    if (!trackForm.requestNo.trim()) {
      setError('Application number is required');
      setSuccess('');
      return;
    }
    if (!trackForm.fhtcNumber.trim() || !trackForm.mobile.trim()) {
      setError('FHTC number and mobile used when submitting the application are required');
      setSuccess('');
      return;
    }
    setBusy(true);
    setTrackResult(null);
    setError('');
    setSuccess('');
    const payload = {
      requestNo: trackForm.requestNo.trim(),
      fhtcNumber: trackForm.fhtcNumber.trim(),
      mobile: trackForm.mobile.trim(),
    };
    consumerPortalApi.trackApplication(payload)
      .then((res) => setTrackResult((res.data ?? null) as Record<string, unknown> | null))
      .catch((err) => { setSuccess(''); setError(getApiError(err, 'Application not found')); })
      .finally(() => setBusy(false));
  };

  const handleUpdateMobile = () => {
    if (!mobileForm.mobile.trim()) {
      setError('Mobile number is required');
      return;
    }
    setBusy(true);
    consumerPortalApi.updateMobile(mobileForm.mobile.trim())
      .then(() => {
        setSuccess('Mobile number updated successfully');
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to update mobile')))
      .finally(() => setBusy(false));
  };

  const outstanding = bills.reduce((s, b) => s + Number(b.balanceAmount ?? 0), 0);
  const unreadNotifications = notifications.filter((n) => !n.readAt);

  const dismissNotification = (id: string) => {
    consumerPortalApi.markNotificationRead(id)
      .then(() => setNotifications((prev) => prev.map((n) => (
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n
      ))))
      .catch(() => undefined);
  };

  return (
    <>
      {unreadNotifications.slice(0, 3).map((n) => (
        <Alert
          key={n.id}
          severity={n.eventType.includes('arrear') || n.eventType.includes('due') ? 'warning' : 'info'}
          sx={{ mb: 1 }}
          onClose={() => dismissNotification(n.id)}
        >
          <strong>{n.title}</strong> — {n.message}
        </Alert>
      ))}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {busy && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} md={8}>
          <SurfaceCard title="My Connection">
            <Typography variant="body2">Consumer: {consumer?.consumerCode} — {consumer?.fhtcNumber}</Typography>
            <Typography variant="body2">Name: {String(profile?.consumerName ?? consumer?.consumerName ?? '—')}</Typography>
            <Typography variant="body2">Village: {String(profile?.village ?? consumer?.village ?? '—')}</Typography>
            <Typography variant="body2">Mobile: {String(profile?.mobile ?? consumer?.mobile ?? '—')}</Typography>
            <Chip size="small" sx={{ mt: 1 }} label={`Status: ${String(profile?.connectionStatus ?? consumer?.connectionStatus ?? '—')}`} />
          </SurfaceCard>
        </Grid>
        <Grid item xs={12} md={4} display="flex" alignItems="stretch">
          <Box display="flex" flexDirection="column" gap={1} width="100%">
            <Button variant="outlined" onClick={() => setComplaintOpen(true)}>Register Complaint</Button>
            <Button variant="outlined" onClick={() => setConnectionOpen(true)}>Apply New Connection</Button>
            <Button variant="text" color="inherit" onClick={logout}>Logout</Button>
          </Box>
        </Grid>
      </Grid>

      <Box mb={2} display="flex" gap={0.75} flexWrap="wrap">
        {PORTAL_FEATURES.map((f) => <Chip key={f} size="small" variant="outlined" label={f} />)}
      </Box>

      <Grid container spacing={2} mb={2}>
        {[
          { label: 'My Bills', value: bills.length, tone: 'blue' as const },
          { label: 'Outstanding', value: formatInr(outstanding), tone: 'rose' as const },
          { label: 'Payments', value: payments.length, tone: 'teal' as const },
          { label: 'Complaints', value: complaints.length, tone: 'amber' as const },
        ].map((k) => (
          <Grid item xs={6} sm={3} key={k.label}>
            <KpiStatCard label={k.label} value={k.value} tone={k.tone} />
          </Grid>
        ))}
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`My Bills (${bills.length})`} />
        <Tab label={`Payment History (${payments.length})`} />
        <Tab label={`Complaints (${complaints.length})`} />
        <Tab label={`Applications (${applications.length})`} />
        <Tab label="Track Application" />
        <Tab label="Update Mobile" />
      </Tabs>

      {tab === 0 && (
        <SurfaceCard title="View Bills">
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Bill No.</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Balance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.map((b) => (
                  <TableRow key={String(b.id)}>
                    <TableCell>{String(b.billNo)}</TableCell>
                    <TableCell>{String(b.billingPeriodFrom)} — {String(b.billingPeriodTo)}</TableCell>
                    <TableCell>{formatInr(b.totalAmount as number)}</TableCell>
                    <TableCell>{formatInr(b.balanceAmount as number)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={String(b.statusLabel ?? b.status)} color={billStatusColor(String(b.status))} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={() => handleViewBill(b)}>
                        Download Bill
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!bills.length && (
                  <TableRow><TableCell colSpan={6} align="center">No bills available</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </SurfaceCard>
      )}

      {tab === 1 && (
        <SurfaceCard title="Payment History & Receipts">
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Receipt No.</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Bill</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={String(p.id)}>
                    <TableCell>{String(p.receiptNo)}</TableCell>
                    <TableCell>{String(p.paymentDate)}</TableCell>
                    <TableCell>{String(p.paymentModeLabel ?? p.paymentMode)}</TableCell>
                    <TableCell>{formatInr(p.amount as number)}</TableCell>
                    <TableCell>{String(p.billNo ?? '—')}</TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<DownloadOutlinedIcon />} onClick={() => handleDownloadReceipt(p)}>
                        Download Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!payments.length && (
                  <TableRow><TableCell colSpan={6} align="center">No payments recorded</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </SurfaceCard>
      )}

      {tab === 2 && (
        <SurfaceCard title="My Complaints">
          <Box mb={2}>
            <Button variant="contained" onClick={() => setComplaintOpen(true)}>Register Complaint</Button>
          </Box>
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Complaint No.</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {complaints.map((c) => (
                  <TableRow key={String(c.id)}>
                    <TableCell>{String(c.complaintNo)}</TableCell>
                    <TableCell>{String(c.complaintTypeLabel ?? c.complaintType)}</TableCell>
                    <TableCell><Chip size="small" label={String(c.statusLabel ?? c.status)} variant="outlined" /></TableCell>
                    <TableCell>{String(c.createdAt ?? '').slice(0, 10)}</TableCell>
                  </TableRow>
                ))}
                {!complaints.length && (
                  <TableRow><TableCell colSpan={4} align="center">No complaints registered</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </SurfaceCard>
      )}

      {tab === 3 && (
        <SurfaceCard title="My Applications">
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Application No.</TableCell>
                  <TableCell>FHTC</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {applications.map((a) => (
                  <TableRow key={String(a.id)}>
                    <TableCell>{String(a.requestNo)}</TableCell>
                    <TableCell>{String(a.fhtcNumber ?? '—')}</TableCell>
                    <TableCell>{String(a.mobile ?? '—')}</TableCell>
                    <TableCell>{String(a.requestTypeLabel ?? a.requestType)}</TableCell>
                    <TableCell><Chip size="small" label={String(a.status)} color={a.status === 'completed' ? 'success' : 'warning'} variant="outlined" /></TableCell>
                    <TableCell>{String(a.createdAt ?? '').slice(0, 10)}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => openTrackForApplication(a)}>Track</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!applications.length && (
                  <TableRow><TableCell colSpan={7} align="center">No applications — use Apply New Connection</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </SurfaceCard>
      )}

      {tab === 4 && (
        <SurfaceCard title="Track Application">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the application number to track status. For applications on a different FHTC, also enter that FHTC and mobile number.
          </Typography>
          <Grid container spacing={2} mb={2}>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Application No." value={trackForm.requestNo}
                onChange={(e) => setTrackForm({ ...trackForm, requestNo: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="FHTC Number" value={trackForm.fhtcNumber}
                onChange={(e) => setTrackForm({ ...trackForm, fhtcNumber: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Mobile" value={trackForm.mobile}
                onChange={(e) => setTrackForm({ ...trackForm, mobile: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" onClick={handleTrackApplication}>Track Status</Button>
            </Grid>
          </Grid>
          {trackResult && (
            <Alert severity="info">
              <Typography variant="body2"><strong>{String(trackResult.requestNo)}</strong> — {String(trackResult.requestTypeLabel)}</Typography>
              <Typography variant="body2">Status: {String(trackResult.status)} · Connection: {String(trackResult.connectionStatus)}</Typography>
              <Typography variant="body2">Submitted: {String(trackResult.createdAt ?? '').slice(0, 10)}</Typography>
            </Alert>
          )}
        </SurfaceCard>
      )}

      {tab === 5 && (
        <SurfaceCard title="Update Mobile Number">
          <Grid container spacing={2} maxWidth={480}>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="New Mobile Number" value={mobileForm.mobile}
                onChange={(e) => setMobileForm({ mobile: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" onClick={handleUpdateMobile}>Update Mobile</Button>
            </Grid>
          </Grid>
        </SurfaceCard>
      )}

      <Dialog open={complaintOpen} onClose={() => !complaintSubmitting && setComplaintOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register Complaint</DialogTitle>
        <DialogContent>
          {complaintSubmitting && <LinearProgress sx={{ mb: 1 }} />}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Complaint Type</InputLabel>
                <Select label="Complaint Type" value={complaintForm.complaintType}
                  onChange={(e) => setComplaintForm({ ...complaintForm, complaintType: e.target.value as typeof complaintForm.complaintType })}>
                  {OM_COMPLAINT_TYPES.map((t) => <MenuItem key={t.code} value={t.code}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={3} size="small" label="Description"
                value={complaintForm.description}
                onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComplaintOpen(false)} disabled={complaintSubmitting}>Cancel</Button>
          <Button variant="contained" onClick={handleRegisterComplaint} disabled={complaintSubmitting}>
            {complaintSubmitting ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={connectionOpen} onClose={() => setConnectionOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply New Connection</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the new FHTC number for the connection being applied. Use a different FHTC than your existing account for an additional connection.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" required label="FHTC Number" value={connectionForm.fhtcNumber}
                onChange={(e) => setConnectionForm({ ...connectionForm, fhtcNumber: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" required label="Mobile" value={connectionForm.mobile}
                onChange={(e) => setConnectionForm({ ...connectionForm, mobile: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Applicant Name" value={connectionForm.consumerName}
                onChange={(e) => setConnectionForm({ ...connectionForm, consumerName: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Village" value={connectionForm.village}
                onChange={(e) => setConnectionForm({ ...connectionForm, village: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Ward" value={connectionForm.ward}
                onChange={(e) => setConnectionForm({ ...connectionForm, ward: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={2} size="small" label="Notes" value={connectionForm.notes}
                onChange={(e) => setConnectionForm({ ...connectionForm, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectionOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleApplyConnection}>Submit Application</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
