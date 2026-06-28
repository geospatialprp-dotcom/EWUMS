import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Badge, Box, Button, Chip, Container, FormControl, InputLabel,
  LinearProgress, MenuItem, Select, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import axios from 'axios';
import { omApi } from '../../services/api';
import { MOBILE_BILLING_FEATURES, MOBILE_FIELD_PAYMENT_MODES, isMobileGatewayPaymentMode } from '../../constants/mobileBilling';
import { OM_METER_CONDITIONS, formatInr } from '../../constants/omBilling';
import { openReceiptPrintView } from '../../utils/receiptExport';
import {
  captureGps, createOfflineId, enqueueOfflineItem, formatObservationDate, formatObservationTimestamp, isOnline,
  loadOfflineQueue, observationCaptureMeta, readFileAsDataUrl, removeOfflineItem,
  type MobileOfflineQueueItem,
} from '../../utils/mobileBillingOffline';
import {
  MobileActionCard,
  MobileCaptureTile,
  MobileFieldChipRow,
  MobileFieldHeader,
  MobileFieldSection,
  MobileKpiTile,
  MobilePaymentModeChip,
  mobileBottomNavSx,
  mobileFieldInputSx,
  mobileFieldPrimaryButtonSx,
  mobileFieldShellSx,
} from './mobileBillingUi';
import SignaturePad, { type ConsumerConsentMode } from './SignaturePad';
import DemoPaymentGatewayDialog from './DemoPaymentGatewayDialog';
import { openPaymentGatewayCheckout, type PaymentGatewayOrder } from '../../utils/paymentGateway';
type ConsumerOption = {
  id: string;
  consumerCode: string;
  fhtcNumber?: string;
  consumerName?: string | null;
  village?: string | null;
  meterNumber?: string | null;
  mobile?: string | null;
};

type BillOption = {
  id: string;
  billNo: string;
  balanceAmount: number;
  totalAmount: number;
};

function normalizeConsumerSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function consumerMatchesSearch(consumer: ConsumerOption, query: string): boolean {
  const q = normalizeConsumerSearch(query);
  if (!q) return true;
  return [
    consumer.consumerCode,
    consumer.fhtcNumber,
    consumer.consumerName,
    consumer.village,
    consumer.meterNumber,
    consumer.mobile,
    consumer.id,
  ]
    .filter(Boolean)
    .some((v) => normalizeConsumerSearch(String(v)).includes(q));
}

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function MobileBillingApp() {
  const [tab, setTab] = useState(0);
  const [online, setOnline] = useState(isOnline());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [consumers, setConsumers] = useState<ConsumerOption[]>([]);
  const [bills, setBills] = useState<BillOption[]>([]);
  const [queue, setQueue] = useState<MobileOfflineQueueItem[]>(loadOfflineQueue());
  const [lastReceipt, setLastReceipt] = useState<Record<string, unknown> | null>(null);
  const [readingConsumerSearch, setReadingConsumerSearch] = useState('');
  const [paymentConsumerSearch, setPaymentConsumerSearch] = useState('');
  const [gatewayConfig, setGatewayConfig] = useState<{ demo?: boolean; merchantName?: string } | null>(null);

  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [signature, setSignature] = useState('');
  const [consentMode, setConsentMode] = useState<ConsumerConsentMode>('signature');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [readingForm, setReadingForm] = useState({
    consumerId: '',
    currentReading: '',
    previousReading: '',
    meterCondition: 'normal',
    notes: '',
  });
  const [readingObservationAt, setReadingObservationAt] = useState(() => new Date());

  const [paymentForm, setPaymentForm] = useState({
    consumerId: '',
    billId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMode: 'cash',
    amount: '',
    transactionRef: '',
    notes: '',
  });

  const consumerBills = useMemo(
    () => bills.filter((b) => b.id && paymentForm.consumerId),
    [bills, paymentForm.consumerId],
  );

  const filterConsumers = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return consumers;
    return consumers.filter((c) => consumerMatchesSearch(c, trimmed));
  }, [consumers]);

  const filteredReadingConsumers = useMemo(
    () => filterConsumers(readingConsumerSearch),
    [filterConsumers, readingConsumerSearch],
  );

  const filteredPaymentConsumers = useMemo(
    () => filterConsumers(paymentConsumerSearch),
    [filterConsumers, paymentConsumerSearch],
  );

  const refreshQueue = useCallback(() => setQueue(loadOfflineQueue()), []);

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    Promise.allSettled([
      omApi.getMobileBillingSummary(),
      omApi.listBillingAccounts(),
    ])
      .then(([sumRes, accRes]) => {
        if (sumRes.status === 'fulfilled') setSummary((sumRes.value.data ?? {}) as Record<string, number>);
        if (accRes.status === 'fulfilled') setConsumers((accRes.value.data ?? []) as ConsumerOption[]);
      })
      .catch((err) => setError(getApiError(err, 'Failed to load mobile billing data')))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    omApi.getMobilePaymentGatewayConfig()
      .then((res) => setGatewayConfig(res.data ?? null))
      .catch(() => setGatewayConfig({ demo: true }));
  }, []);

  useEffect(() => {
    if (tab === 1) {
      setReadingObservationAt(new Date());
    }
  }, [tab]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!paymentForm.consumerId) {
      setBills([]);
      return;
    }
    omApi.listBills({ consumerId: paymentForm.consumerId, status: 'issued' })
      .then((res) => {
        const rows = (res.data ?? []) as Array<Record<string, unknown>>;
        setBills(rows.map((b) => ({
          id: String(b.id),
          billNo: String(b.billNo),
          balanceAmount: Number(b.balanceAmount ?? 0),
          totalAmount: Number(b.totalAmount ?? 0),
        })));
      })
      .catch(() => setBills([]));
  }, [paymentForm.consumerId]);

  const captureLocation = async () => {
    setBusy(true);
    const pos = await captureGps();
    setGps(pos);
    if (!pos) setError('Could not capture GPS. Enable location permission.');
    setBusy(false);
  };

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(await readFileAsDataUrl(file));
  };

  const uploadPhotoIfNeeded = async (): Promise<string | undefined> => {
    if (!photoFile || !online) return photoPreview || undefined;
    const form = new FormData();
    form.append('photo', photoFile);
    const res = await omApi.uploadMobileMeterPhoto(form);
    return String(res.data?.photoUrl ?? '');
  };

  const consentPayload = signature
    ? {
        consumerSignature: signature,
        consumerConsentType: (consentMode === 'thumb' ? 'thumb_impression' : 'signature') as 'thumb_impression' | 'signature',
      }
    : {};

  const submitReading = async () => {
    if (!readingForm.consumerId || !readingForm.currentReading) {
      setError('Consumer and current reading are required');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');

    const consumer = consumers.find((c) => c.id === readingForm.consumerId);
    const offlineId = createOfflineId('reading');
    const { readingDate, capturedAt } = observationCaptureMeta();
    const payload = {
      readingDate,
      currentReading: Number(readingForm.currentReading),
      previousReading: readingForm.previousReading ? Number(readingForm.previousReading) : undefined,
      meterCondition: readingForm.meterCondition,
      notes: readingForm.notes || undefined,
      latitude: gps?.latitude,
      longitude: gps?.longitude,
      ...consentPayload,
      offlineId,
      capturedAt,
    };

    try {
      if (!online) {
        enqueueOfflineItem({
          offlineId,
          type: 'meter_reading',
          consumerId: readingForm.consumerId,
          consumerLabel: consumer?.consumerCode ?? readingForm.consumerId,
          capturedAt: payload.capturedAt,
          payload,
          photoDataUrl: photoPreview || undefined,
        });
        refreshQueue();
        setSuccess('Reading saved offline. Sync when back online.');
        setTab(3);
        return;
      }

      const photoUrl = await uploadPhotoIfNeeded();
      await omApi.recordMobileMeterReading(readingForm.consumerId, { ...payload, photoUrl });
      setSuccess('Meter reading captured successfully.');
      setReadingForm({
        consumerId: '',
        currentReading: '',
        previousReading: '',
        meterCondition: 'normal',
        notes: '',
      });
      setReadingObservationAt(new Date());
      setSignature('');
      setReadingConsumerSearch('');
      setPhotoPreview('');
      setPhotoFile(null);
      load();
    } catch (err) {
      setError(getApiError(err, 'Failed to save meter reading'));
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async () => {
    if (!paymentForm.consumerId || !paymentForm.amount) {
      setError('Consumer and amount are required');
      return;
    }

    const usesGateway = isMobileGatewayPaymentMode(paymentForm.paymentMode);
    if (usesGateway) {
      await submitGatewayPayment();
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    const consumer = consumers.find((c) => c.id === paymentForm.consumerId);
    const offlineId = createOfflineId('payment');
    const payload = {
      consumerId: paymentForm.consumerId,
      billId: paymentForm.billId || undefined,
      paymentDate: paymentForm.paymentDate,
      paymentMode: paymentForm.paymentMode,
      amount: Number(paymentForm.amount),
      transactionRef: paymentForm.transactionRef || undefined,
      notes: paymentForm.notes || undefined,
      latitude: gps?.latitude,
      longitude: gps?.longitude,
      ...consentPayload,
      offlineId,
      capturedAt: new Date().toISOString(),
    };

    try {
      if (!online) {
        enqueueOfflineItem({
          offlineId,
          type: 'payment',
          consumerId: paymentForm.consumerId,
          consumerLabel: consumer?.consumerCode ?? paymentForm.consumerId,
          capturedAt: payload.capturedAt,
          payload,
        });
        refreshQueue();
        setSuccess('Payment saved offline. Sync when back online.');
        setTab(3);
        return;
      }

      const res = await omApi.recordMobilePayment(payload);
      const payment = (res.data ?? {}) as Record<string, unknown>;
      setLastReceipt(payment);
      setSuccess(`Payment recorded. Receipt ${String(payment.receiptNo ?? '')} generated.`);
      openReceiptPrintView(payment);
      setPaymentForm({
        consumerId: '',
        billId: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMode: 'cash',
        amount: '',
        transactionRef: '',
        notes: '',
      });
      setSignature('');
      setPaymentConsumerSearch('');
      load();
    } catch (err) {
      setError(getApiError(err, 'Failed to record payment'));
    } finally {
      setBusy(false);
    }
  };

  const submitGatewayPayment = async () => {
    if (!paymentForm.consumerId || !paymentForm.amount) {
      setError('Consumer and amount are required');
      return;
    }
    if (!online) {
      setError('UPI and QR payments need an internet connection. Use cash, POS, or CSC when offline.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    const consumer = consumers.find((c) => c.id === paymentForm.consumerId);
    const consumerLabel = [consumer?.consumerCode, consumer?.fhtcNumber, consumer?.consumerName].filter(Boolean).join(' · ');
    const offlineId = createOfflineId('payment');
    const amount = Number(paymentForm.amount);

    try {
      const orderRes = await omApi.createMobilePaymentGatewayOrder({
        consumerId: paymentForm.consumerId,
        billId: paymentForm.billId || undefined,
        paymentMode: paymentForm.paymentMode,
        amount,
        consumerLabel,
      });
      const order = {
        ...(orderRes.data as PaymentGatewayOrder),
        merchantName: gatewayConfig?.merchantName ?? (orderRes.data as PaymentGatewayOrder).merchantName,
        consumerLabel,
      };

      const gatewayResult = await openPaymentGatewayCheckout(order, consumerLabel);

      const verifyRes = await omApi.verifyMobilePaymentGateway({
        consumerId: paymentForm.consumerId,
        billId: paymentForm.billId || undefined,
        paymentDate: paymentForm.paymentDate,
        paymentMode: paymentForm.paymentMode,
        amount,
        transactionRef: gatewayResult.razorpayPaymentId,
        notes: paymentForm.notes || undefined,
        latitude: gps?.latitude,
        longitude: gps?.longitude,
        ...consentPayload,
        offlineId,
        capturedAt: new Date().toISOString(),
        razorpayOrderId: gatewayResult.razorpayOrderId,
        razorpayPaymentId: gatewayResult.razorpayPaymentId,
        razorpaySignature: gatewayResult.razorpaySignature,
      });

      const payment = (verifyRes.data ?? {}) as Record<string, unknown>;
      setLastReceipt(payment);
      setSuccess(`Payment received via gateway. Receipt ${String(payment.receiptNo ?? '')} generated.`);
      openReceiptPrintView(payment);
      setPaymentForm({
        consumerId: '',
        billId: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMode: 'cash',
        amount: '',
        transactionRef: '',
        notes: '',
      });
      setSignature('');
      setPaymentConsumerSearch('');
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : getApiError(err, 'Payment gateway failed');
      if (!message.toLowerCase().includes('cancel')) {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const usesGatewayPayment = isMobileGatewayPaymentMode(paymentForm.paymentMode);

  const syncQueue = async () => {
    const pending = loadOfflineQueue();
    if (!pending.length) {
      setSuccess('No offline items to sync.');
      return;
    }
    if (!online) {
      setError('You are offline. Connect to the internet to sync.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const items = await Promise.all(pending.map(async (item) => {
        let payload = { ...item.payload };
        if (item.type === 'meter_reading' && item.photoDataUrl && !payload.photoUrl) {
          const blob = await fetch(item.photoDataUrl).then((r) => r.blob());
          const file = new File([blob], 'meter-photo.jpg', { type: blob.type || 'image/jpeg' });
          const form = new FormData();
          form.append('photo', file);
          const upload = await omApi.uploadMobileMeterPhoto(form);
          payload = { ...payload, photoUrl: upload.data?.photoUrl };
        }
        return {
          offlineId: item.offlineId,
          type: item.type,
          consumerId: item.consumerId,
          capturedAt: item.capturedAt,
          payload,
        };
      }));

      const res = await omApi.syncMobileBillingBatch({ items });
      const data = res.data as { synced?: number; failed?: number; results?: Array<{ offlineId: string; status: string }> };
      (data.results ?? []).forEach((r) => {
        if (r.status === 'synced') removeOfflineItem(r.offlineId);
      });
      refreshQueue();
      setSuccess(`Synced ${data.synced ?? 0} item(s). ${data.failed ? `${data.failed} failed.` : ''}`);
      load();
    } catch (err) {
      setError(getApiError(err, 'Offline sync failed'));
    } finally {
      setBusy(false);
    }
  };

  const renderConsumerSelect = (
    value: string,
    onChange: (id: string) => void,
    searchValue: string,
    onSearchChange: (value: string) => void,
    filteredOptions: ConsumerOption[],
  ) => {
    const selected = consumers.find((c) => c.id === value) ?? null;

    return (
      <Autocomplete
        fullWidth
        options={filteredOptions}
        value={selected}
        onChange={(_, option) => {
          onChange(option?.id ?? '');
          onSearchChange(
            option
              ? [option.consumerCode, option.fhtcNumber, option.consumerName].filter(Boolean).join(' · ')
              : '',
          );
        }}
        inputValue={searchValue}
        onInputChange={(_, next, reason) => {
          if (reason === 'input' || reason === 'clear') {
            onSearchChange(next);
          }
          if (reason === 'clear') {
            onChange('');
          }
        }}
        filterOptions={(options) => options}
        isOptionEqualToValue={(option, current) => option.id === current.id}
        getOptionLabel={(option) =>
          [option.consumerCode, option.fhtcNumber, option.consumerName].filter(Boolean).join(' · ')}
        noOptionsText={
          searchValue.trim()
            ? `No consumer found for "${searchValue.trim()}"`
            : consumers.length
              ? 'Type consumer code, FHTC, village, or meter number'
              : 'No consumers loaded'
        }
        openOnFocus
        clearOnBlur={false}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id} sx={{ py: 1.25 }}>
            <Box>
              <Typography variant="body2" fontWeight={700}>{option.consumerCode}</Typography>
              <Typography variant="caption" color="text.secondary">
                {[option.fhtcNumber, option.consumerName, option.village, option.meterNumber]
                  .filter(Boolean)
                  .join(' · ') || 'No details'}
              </Typography>
            </Box>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search & select consumer"
            placeholder="e.g. CON22, FHTC, village, meter…"
            sx={mobileFieldInputSx}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <SearchOutlinedIcon sx={{ color: '#94a3b8', ml: 0.5, mr: 0.5 }} />
                  {params.InputProps.startAdornment}
                </>
              ),
            }}
          />
        )}
      />
    );
  };
  return (
    <Box sx={mobileFieldShellSx}>
      <MobileFieldHeader
        title="Mobile Billing"
        subtitle="Meter reading · field collection · GPS & photo evidence · offline sync"
        online={online}
        queueCount={queue.length}
      />

      <Container maxWidth="sm" sx={{ px: 2, mt: -1.5 }}>
        <Box sx={{ borderRadius: 3, bgcolor: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.08)', p: 0.25, mb: 2 }}>
          {busy && <LinearProgress sx={{ borderRadius: '12px 12px 0 0' }} />}
          <Box p={1.5}>
            {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
          </Box>
        </Box>

        {tab === 0 && (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.25}>
              <MobileKpiTile label="Consumers" value={summary.consumers ?? consumers.length} phase="home" />
              <MobileKpiTile label="Pending Bills" value={summary.pendingBills ?? 0} phase="payment" />
              <MobileKpiTile label="Field Readings" value={summary.mobileReadings ?? 0} phase="reading" />
              <MobileKpiTile label="Offline Queue" value={queue.length} phase="sync" />
            </Box>

            <MobileActionCard
              title="Capture Meter Reading"
              subtitle="Reading, photo, GPS and signature or thumb consent"
              phase="reading"
              icon={<PhotoCameraOutlinedIcon />}
              onClick={() => setTab(1)}
            />
            <MobileActionCard
              title="Collect Payment"
              subtitle="Cash, UPI, QR, POS or CSC with instant receipt"
              phase="payment"
              icon={<ReceiptLongOutlinedIcon />}
              onClick={() => setTab(2)}
            />
            <MobileActionCard
              title="Sync Offline Queue"
              subtitle={queue.length ? `${queue.length} capture(s) waiting to upload` : 'All field captures are synced'}
              phase="sync"
              icon={<SyncOutlinedIcon />}
              badge={queue.length ? String(queue.length) : undefined}
              onClick={() => setTab(3)}
            />

            <MobileFieldSection title="Field capabilities" subtitle="Designed for village-level revenue staff" phase="home">
              <MobileFieldChipRow>
                {MOBILE_BILLING_FEATURES.map((f) => (
                  <Chip key={f.code} size="small" label={f.label} variant="outlined" sx={{ fontWeight: 600 }} />
                ))}
              </MobileFieldChipRow>
            </MobileFieldSection>

            {lastReceipt && (
              <MobileFieldSection title="Last receipt" phase="payment">
                <Typography variant="body1" fontWeight={700} sx={{ color: '#0f172a' }}>
                  {String(lastReceipt.receiptNo)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {formatInr(Number(lastReceipt.amount ?? 0))}
                </Typography>
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ mt: 1.5, minHeight: 48, borderRadius: 2.5, fontWeight: 700 }}
                  startIcon={<ReceiptLongOutlinedIcon />}
                  onClick={() => openReceiptPrintView(lastReceipt)}
                >
                  Print Receipt
                </Button>
              </MobileFieldSection>
            )}
          </Box>
        )}

        {tab === 1 && (
          <MobileFieldSection title="Meter reading" subtitle="Capture reading with site evidence" phase="reading">
            {renderConsumerSelect(
              readingForm.consumerId,
              (id) => setReadingForm({ ...readingForm, consumerId: id }),
              readingConsumerSearch,
              setReadingConsumerSearch,
              filteredReadingConsumers,
            )}
            <TextField
              fullWidth
              label="Observation date"
              value={formatObservationDate(readingObservationAt)}
              InputProps={{ readOnly: true }}
              helperText={`Taken on site · ${formatObservationTimestamp(readingObservationAt)} (set automatically when you save)`}
              sx={mobileFieldInputSx}
            />
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5}>
              <TextField
                fullWidth label="Previous" sx={mobileFieldInputSx}
                value={readingForm.previousReading} onChange={(e) => setReadingForm({ ...readingForm, previousReading: e.target.value })}
              />
              <TextField
                fullWidth required label="Current" sx={mobileFieldInputSx}
                value={readingForm.currentReading} onChange={(e) => setReadingForm({ ...readingForm, currentReading: e.target.value })}
              />
            </Box>
            <FormControl fullWidth sx={mobileFieldInputSx}>
              <InputLabel>Meter Condition</InputLabel>
              <Select label="Meter Condition" value={readingForm.meterCondition}
                onChange={(e) => setReadingForm({ ...readingForm, meterCondition: e.target.value })}>
                {OM_METER_CONDITIONS.map((m) => <MenuItem key={m.code} value={m.code}>{m.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              fullWidth label="Field notes" multiline rows={2} sx={mobileFieldInputSx}
              value={readingForm.notes} onChange={(e) => setReadingForm({ ...readingForm, notes: e.target.value })}
            />

            <MobileCaptureTile
              label="GPS location"
              value={gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : 'Tap to capture site coordinates'}
              icon={<MyLocationOutlinedIcon />}
              onClick={captureLocation}
              active={!!gps}
            />

            <MobileCaptureTile
              label={photoPreview ? 'Meter photo captured' : 'Meter photo'}
              value={photoPreview ? 'Photo ready — tap to change' : 'Tap to open camera or gallery'}
              icon={<PhotoCameraOutlinedIcon />}
              onClick={() => document.getElementById('mobile-meter-photo-input')?.click()}
              active={!!photoPreview}
            />
            <input
              id="mobile-meter-photo-input"
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
            />
            {photoPreview && (
              <Box
                component="img"
                src={photoPreview}
                alt="Meter"
                sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 2.5, mb: 2, border: '1px solid #e2e8f0' }}
              />
            )}

            <SignaturePad
              value={signature}
              onChange={setSignature}
              mode={consentMode}
              onModeChange={setConsentMode}
            />
            <Button
              fullWidth
              variant="contained"
              sx={{ ...mobileFieldPrimaryButtonSx('reading'), mt: 2 }}
              onClick={submitReading}
              disabled={busy}
            >
              Save Meter Reading
            </Button>
          </MobileFieldSection>
        )}

        {tab === 2 && (
          <MobileFieldSection title="Collect payment" subtitle="Issue receipt at doorstep or collection camp" phase="payment">
            {renderConsumerSelect(
              paymentForm.consumerId,
              (id) => setPaymentForm({ ...paymentForm, consumerId: id, billId: '', amount: '' }),
              paymentConsumerSearch,
              setPaymentConsumerSearch,
              filteredPaymentConsumers,
            )}
            <FormControl fullWidth sx={mobileFieldInputSx}>
              <InputLabel>Bill (optional)</InputLabel>
              <Select label="Bill (optional)" value={paymentForm.billId}
                onChange={(e) => {
                  const bill = consumerBills.find((b) => b.id === e.target.value);
                  setPaymentForm({
                    ...paymentForm,
                    billId: e.target.value,
                    amount: bill ? String(bill.balanceAmount) : paymentForm.amount,
                  });
                }}>
                <MenuItem value="">General payment</MenuItem>
                {consumerBills.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.billNo} — {formatInr(b.balanceAmount)} due</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth type="date" label="Payment Date" InputLabelProps={{ shrink: true }} sx={mobileFieldInputSx}
              value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
            />

            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 1 }}>
              Payment mode
            </Typography>
            <MobileFieldChipRow>
              {MOBILE_FIELD_PAYMENT_MODES.map((m) => (
                <MobilePaymentModeChip
                  key={m.code}
                  label={m.label}
                  selected={paymentForm.paymentMode === m.code}
                  onClick={() => setPaymentForm({ ...paymentForm, paymentMode: m.code, transactionRef: '' })}
                />
              ))}
            </MobileFieldChipRow>

            {usesGatewayPayment && (
              <Box
                sx={{
                  mt: 2,
                  p: 1.75,
                  borderRadius: 2.5,
                  bgcolor: '#fffbeb',
                  border: '1px solid #fcd34d',
                }}
              >
                <Chip
                  size="small"
                  label={gatewayConfig?.demo ? 'Demo gateway active' : 'Razorpay gateway'}
                  sx={{ mb: 1, fontWeight: 700, bgcolor: '#fef3c7', color: '#92400e' }}
                />
                <Typography variant="body2" fontWeight={700} sx={{ color: '#92400e' }}>
                  {paymentForm.paymentMode === 'qr_code' ? 'QR payment checkout' : 'UPI / digital payment checkout'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.35 }}>
                  Payment is verified through the gateway before the receipt is issued.
                </Typography>
                {paymentForm.amount && (
                  <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 0.75, color: '#b45309' }}>
                    Collect {formatInr(Number(paymentForm.amount))}
                  </Typography>
                )}
              </Box>
            )}

            <TextField
              fullWidth required label="Amount (₹)" sx={{ ...mobileFieldInputSx, mt: 2 }}
              value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
            {!usesGatewayPayment && (
              <TextField
                fullWidth label="Transaction reference" sx={mobileFieldInputSx}
                value={paymentForm.transactionRef} onChange={(e) => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })}
              />
            )}

            <MobileCaptureTile
              label="GPS location"
              value={gps ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : 'Tap to capture collection point'}
              icon={<MyLocationOutlinedIcon />}
              onClick={captureLocation}
              active={!!gps}
            />

            <SignaturePad
              value={signature}
              onChange={setSignature}
              mode={consentMode}
              onModeChange={setConsentMode}
            />
            <Button
              fullWidth
              variant="contained"
              sx={{ ...mobileFieldPrimaryButtonSx('payment'), mt: 2 }}
              onClick={submitPayment}
              disabled={busy || (usesGatewayPayment && !online)}
            >
              {usesGatewayPayment
                ? (paymentForm.paymentMode === 'qr_code' ? 'Pay via QR Gateway' : 'Pay via UPI Gateway')
                : 'Collect & Generate Receipt'}
            </Button>
          </MobileFieldSection>
        )}

        {tab === 3 && (
          <MobileFieldSection title="Offline queue" subtitle="Captures saved without network — sync when online" phase="sync">
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={1} mb={2}>
              <Chip
                size="small"
                icon={online ? <CloudDoneOutlinedIcon /> : <CloudOffOutlinedIcon />}
                label={online ? 'Ready to sync' : 'Waiting for network'}
                color={online ? 'success' : 'warning'}
                variant="outlined"
                sx={{ fontWeight: 700 }}
              />
              <Button
                size="small"
                variant="contained"
                startIcon={<SyncOutlinedIcon />}
                onClick={syncQueue}
                disabled={busy || !queue.length || !online}
                sx={{ minHeight: 42, borderRadius: 2, fontWeight: 700 }}
              >
                Sync All
              </Button>
            </Box>
            {!queue.length && (
              <Box sx={{ py: 3, textAlign: 'center', borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  No offline captures waiting to sync.
                </Typography>
              </Box>
            )}
            {queue.map((item) => (
              <Box
                key={item.offlineId}
                sx={{
                  p: 1.75,
                  mb: 1.25,
                  borderRadius: 2.5,
                  border: '1px solid #e2e8f0',
                  bgcolor: '#f8fafc',
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {item.type === 'meter_reading' ? 'Meter Reading' : 'Payment'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{item.consumerLabel}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.capturedAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Chip size="small" label="Pending" sx={{ fontWeight: 700, bgcolor: '#fff7ed', color: '#9a3412' }} />
                </Box>
                <Button
                  size="small"
                  color="error"
                  sx={{ mt: 1, fontWeight: 700 }}
                  onClick={() => { removeOfflineItem(item.offlineId); refreshQueue(); }}
                >
                  Remove
                </Button>
              </Box>
            ))}
          </MobileFieldSection>
        )}
      </Container>

      <Box sx={mobileBottomNavSx}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab icon={<HomeOutlinedIcon />} label="Home" />
          <Tab icon={<PhotoCameraOutlinedIcon />} label="Reading" />
          <Tab icon={<ReceiptLongOutlinedIcon />} label="Payment" />
          <Tab
            icon={(
              <Badge color="warning" badgeContent={queue.length || undefined} overlap="circular">
                <SyncOutlinedIcon />
              </Badge>
            )}
            label="Queue"
          />
        </Tabs>
      </Box>

      <DemoPaymentGatewayDialog />
    </Box>
  );
}