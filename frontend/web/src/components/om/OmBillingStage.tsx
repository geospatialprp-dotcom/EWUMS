import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  FormControl, Grid, InputLabel, LinearProgress, MenuItem, Select, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import { omApi, projectsApi } from '../../services/api';
import SurfaceCard from '../layout/SurfaceCard';
import KpiStatCard from '../layout/KpiStatCard';
import {
  OM_BILL_STATUSES,
  OM_BILLING_WORKFLOW,
  OM_COLLECTION_WORKFLOW,
  OM_BILLING_CYCLES,
  OM_BILL_DELIVERY_CHANNELS,
  OM_DEMAND_REGISTER_VIEWS,
  OM_ARREAR_BUCKETS,
  OM_ARREAR_ACTIONS,
  OM_ARREAR_VIEWS,
  OM_CONSUMER_CATEGORIES,
  OM_CONNECTION_STATUSES,
  OM_PAYMENT_MODES,
  OM_READING_METHODS,
  OM_METER_CONDITIONS,
  METER_VALIDATION_LABELS,
  EMPTY_READING_FORM,
  EMPTY_GENERATE_FORM,
  computeBillingPeriod,
  workflowStepIndex,
  collectionWorkflowStepIndex,
  previewMeterReadingValidation,
  EMPTY_TARIFF_FORM,
  formatSlabRange,
  billStatusColor,
  formatInr,
} from '../../constants/omBilling';
import { dataTableSx } from '../../utils/pagePresentationStyles';
import { formatCoordinatePair } from '../../utils/coordinateFields';
import { openBillPrintView, openSmsApp, openWhatsAppApp, openEmailApp } from '../../utils/billExport';
import { openReceiptPrintView } from '../../utils/receiptExport';
import { openArrearNoticePrintView } from '../../utils/arrearExport';
import { useCanViewAllDivisions } from '../../utils/divisionAccess';
import BilingualRemarkField from '../forms/BilingualRemarkField';
import { parseBilingualText, serializeBilingualText } from '../../utils/bilingualText';
import OmRevenueGisDashboard from './OmRevenueGisDashboard';
import OmAccountingStage from './OmAccountingStage';
import OmBillingReportsStage from './OmBillingReportsStage';
import OmRevenueKpiDashboard from './OmRevenueKpiDashboard';
import {
  BillingDialogHeader,
  BillingSectionCard,
  BillingWorkflowTracker,
  billingDialogActionsSx,
  billingDialogContentSx,
  billingDialogPaperSx,
  billingHashFromTab,
  billingTabFromHash,
  billingTabsSx,
} from './billingUi';

const EMPTY_ACCOUNT_FORM = {
  fhtcNumber: '',
  consumerName: '',
  mobile: '',
  village: '',
  ward: '',
  consumerCategory: '',
  aadhaarLast4: '',
  latitude: '',
  longitude: '',
  meterNumber: '',
  connectionStatus: 'active',
  tariffId: '',
};

type ProjectOption = { id: string; name: string; projectCode: string };
type ConsumerOption = {
  id: string;
  consumerCode: string;
  fhtcNumber: string;
  consumerName?: string | null;
  village?: string | null;
  ward?: string | null;
  consumerCategory?: string | null;
  meterNumber?: string | null;
  connectionStatus?: string;
  mobile?: string | null;
  aadhaarLast4?: string | null;
  tariffId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gisLocation?: string | null;
  connectionStatusLabel?: string | null;
  consumerCategoryLabel?: string | null;
};

function getSuggestedPreviousReading(
  consumerId: string,
  rows: Array<Record<string, unknown>>,
): number | null {
  const latest = rows
    .filter((r) => r.consumerId === consumerId)
    .sort((a, b) => String(b.readingDate).localeCompare(String(a.readingDate)))[0];
  if (!latest || latest.currentReading == null) return null;
  return Number(latest.currentReading);
}

function getApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}

export default function OmBillingStage({
  activeTab: externalTab,
  onTabChange,
}: {
  activeTab?: number;
  onTabChange?: (tab: number) => void;
}) {
  const canViewAll = useCanViewAllDivisions();
  const [tab, setTabState] = useState(0);
  const setTab = useCallback((value: number) => {
    setTabState(value);
    onTabChange?.(value);
    window.history.replaceState(null, '', `#${billingHashFromTab(value)}`);
  }, [onTabChange]);

  useEffect(() => {
    if (externalTab != null && externalTab !== tab) {
      setTabState(externalTab);
    }
  }, [externalTab, tab]);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [consumers, setConsumers] = useState<ConsumerOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [summary, setSummary] = useState<Record<string, number | null>>({});
  const [tariffs, setTariffs] = useState<Array<Record<string, unknown>>>([]);
  const [readings, setReadings] = useState<Array<Record<string, unknown>>>([]);
  const [bills, setBills] = useState<Array<Record<string, unknown>>>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [revenueRegister, setRevenueRegister] = useState<Record<string, unknown> | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState({
    periodFrom: computeBillingPeriod('monthly').billingPeriodFrom,
    periodTo: computeBillingPeriod('monthly').billingPeriodTo,
  });
  const [paymentDetailOpen, setPaymentDetailOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Record<string, unknown> | null>(null);
  const [demandRegister, setDemandRegister] = useState<Record<string, unknown> | null>(null);
  const [demandGroupBy, setDemandGroupBy] = useState('village');
  const [demandPeriod, setDemandPeriod] = useState({
    periodFrom: computeBillingPeriod('monthly').billingPeriodFrom,
    periodTo: computeBillingPeriod('monthly').billingPeriodTo,
  });
  const [arrearRegister, setArrearRegister] = useState<Record<string, unknown> | null>(null);
  const [arrearView, setArrearView] = useState('arrear_register');
  const [arrearBucketFilter, setArrearBucketFilter] = useState('');
  const [arrearActionFeedback, setArrearActionFeedback] = useState<{ severity: 'success' | 'warning' | 'error' | 'info'; message: string } | null>(null);
  const [gisRevenue, setGisRevenue] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [tariffOpen, setTariffOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [billDetailOpen, setBillDetailOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Record<string, unknown> | null>(null);
  const [deliveryFeedback, setDeliveryFeedback] = useState<{ severity: 'success' | 'warning' | 'error' | 'info'; message: string } | null>(null);
  const [notificationConfig, setNotificationConfig] = useState<Record<string, unknown> | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<'create' | 'edit'>('create');
  const [editingConsumer, setEditingConsumer] = useState<ConsumerOption | null>(null);

  const [tariffForm, setTariffForm] = useState({ ...EMPTY_TARIFF_FORM });

  const [readingForm, setReadingForm] = useState({ ...EMPTY_READING_FORM });

  const [generateForm, setGenerateForm] = useState({ ...EMPTY_GENERATE_FORM });

  const [accountForm, setAccountForm] = useState({ ...EMPTY_ACCOUNT_FORM });

  const [paymentForm, setPaymentForm] = useState({
    consumerId: '',
    billId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMode: 'upi',
    amount: '',
    transactionRef: '',
  });

  const projectParams = { projectCode: selectedProject?.projectCode };
  const demandParams = {
    ...projectParams,
    groupBy: demandGroupBy,
    periodFrom: demandPeriod.periodFrom,
    periodTo: demandPeriod.periodTo,
  };
  const revenueParams = {
    ...projectParams,
    periodFrom: revenuePeriod.periodFrom,
    periodTo: revenuePeriod.periodTo,
  };
  const arrearParams = {
    ...projectParams,
    bucket: arrearBucketFilter || undefined,
  };

  const load = useCallback(() => {
    setBusy(true);
    setError('');
    const requests = [
      { key: 'summary', call: () => omApi.billingSummary(selectedProject?.id) },
      { key: 'tariffs', call: () => omApi.listBillingTariffs(projectParams) },
      { key: 'readings', call: () => omApi.listMeterReadings(projectParams) },
      { key: 'bills', call: () => omApi.listBills(projectParams) },
      { key: 'payments', call: () => omApi.listBillingPayments(projectParams) },
      { key: 'revenue', call: () => omApi.getRevenueRegister(revenueParams) },
      { key: 'demand', call: () => omApi.getDemandRegister(demandParams) },
      { key: 'arrears', call: () => omApi.getBillingArrears(arrearParams) },
      { key: 'gis', call: () => omApi.getGisRevenue(projectParams) },
      { key: 'accounts', call: () => omApi.listBillingAccounts(projectParams) },
      { key: 'catalog', call: () => omApi.getBillingCatalog() },
    ] as const;

    Promise.allSettled(requests.map((r) => r.call()))
      .then((results) => {
        const failed: string[] = [];
        results.forEach((result, index) => {
          const key = requests[index].key;
          if (result.status === 'rejected') {
            failed.push(key);
            return;
          }
          const data = result.value.data;
          switch (key) {
            case 'summary': setSummary(data ?? {}); break;
            case 'tariffs': setTariffs(data ?? []); break;
            case 'readings': setReadings(data ?? []); break;
            case 'bills': setBills(data ?? []); break;
            case 'payments': setPayments(data ?? []); break;
            case 'revenue': setRevenueRegister((data ?? null) as Record<string, unknown> | null); break;
            case 'demand': setDemandRegister((data ?? null) as Record<string, unknown> | null); break;
            case 'arrears': setArrearRegister((data ?? null) as Record<string, unknown> | null); break;
            case 'gis': setGisRevenue((data ?? null) as Record<string, unknown> | null); break;
            case 'accounts': setConsumers((data ?? []) as ConsumerOption[]); break;
            case 'catalog': setNotificationConfig((data?.notificationConfig ?? null) as Record<string, unknown> | null); break;
            default: break;
          }
        });
        if (failed.length) {
          const migrationHint = failed.includes('readings') || failed.includes('gis')
            ? 'Run migration 045 in backend/api: node scripts/apply-sql-migrations.js 045'
            : failed.includes('payments')
              ? 'Run migration 042 in backend/api: node scripts/apply-sql-migrations.js 042'
              : 'Ensure backend is running on port 3000';
          setError(`Some billing data could not be loaded (${failed.join(', ')}). ${migrationHint}`);
        }
      })
      .catch((err) => setError(getApiError(err, 'Failed to load billing data')))
      .finally(() => setBusy(false));
  }, [selectedProject, demandGroupBy, demandPeriod, revenuePeriod, arrearBucketFilter]);

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

  useEffect(() => {
    if (tab === 5 || tab === 9) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [tab]);

  const openAccountingTab = useCallback(() => {
    setTab(5);
    setTimeout(() => {
      document.getElementById('billing-tab-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [setTab]);

  useEffect(() => {
    const applyHash = () => {
      const mapped = billingTabFromHash(window.location.hash);
      if (mapped == null) return;
      setTabState(mapped);
      onTabChange?.(mapped);
      setTimeout(() => {
        document.getElementById('billing-tab-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [onTabChange]);

  const handleCreateTariff = () => {
    if (!tariffForm.tariffName.trim()) {
      setError('Tariff name is required');
      return;
    }
    const slabs = tariffForm.slabs.map((s) => ({
      fromKl: Number(s.fromKl),
      toKl: s.toKl.trim() ? Number(s.toKl) : null,
      ratePerKl: Number(s.ratePerKl),
    }));
    setBusy(true);
    omApi.createBillingTariff({
      tariffName: tariffForm.tariffName.trim(),
      billingCycle: tariffForm.billingCycle,
      consumerCategory: tariffForm.consumerCategory || undefined,
      fixedCharge: Number(tariffForm.fixedCharge),
      serviceCharge: Number(tariffForm.serviceCharge),
      maintenanceCharge: Number(tariffForm.maintenanceCharge),
      meterRent: Number(tariffForm.meterRent),
      latePenaltyPct: Number(tariffForm.latePenaltyPct),
      reconnectionCharge: Number(tariffForm.reconnectionCharge),
      newConnectionCharge: Number(tariffForm.newConnectionCharge),
      taxPct: Number(tariffForm.taxPct),
      effectiveFrom: tariffForm.effectiveFrom,
      slabs,
      projectCode: selectedProject?.projectCode,
    })
      .then(() => {
        setTariffOpen(false);
        setTariffForm({ ...EMPTY_TARIFF_FORM });
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to create tariff')))
      .finally(() => setBusy(false));
  };

  const updateTariffSlab = (index: number, field: 'fromKl' | 'toKl' | 'ratePerKl', value: string) => {
    setTariffForm((prev) => ({
      ...prev,
      slabs: prev.slabs.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  const effectivePreviousReading = useMemo(() => {
    if (readingForm.previousReading.trim()) return Number(readingForm.previousReading);
    if (readingForm.consumerId) return getSuggestedPreviousReading(readingForm.consumerId, readings);
    return null;
  }, [readingForm.previousReading, readingForm.consumerId, readings]);

  const readingPreview = useMemo(() => {
    const current = readingForm.currentReading.trim() ? Number(readingForm.currentReading) : null;
    return previewMeterReadingValidation(effectivePreviousReading, current, readingForm.meterCondition);
  }, [effectivePreviousReading, readingForm.currentReading, readingForm.meterCondition]);

  const openReadingDialog = () => {
    setReadingForm({ ...EMPTY_READING_FORM, readingDate: new Date().toISOString().slice(0, 10) });
    setReadingOpen(true);
  };

  const handleReadingConsumerChange = (consumerId: string) => {
    const consumer = consumers.find((c) => c.id === consumerId);
    const suggestedPrev = getSuggestedPreviousReading(consumerId, readings);
    setReadingForm((prev) => ({
      ...prev,
      consumerId,
      previousReading: suggestedPrev != null ? String(suggestedPrev) : '',
      latitude: consumer?.latitude != null ? String(consumer.latitude) : prev.latitude,
      longitude: consumer?.longitude != null ? String(consumer.longitude) : prev.longitude,
    }));
  };

  const handleRecordReading = () => {
    if (!readingForm.consumerId || !readingForm.currentReading) {
      setError('Consumer and current reading are required');
      return;
    }
    if (!readingPreview.valid) {
      setError('Invalid meter reading — correct negative or decreasing values before saving');
      return;
    }
    setBusy(true);
    omApi.recordMeterReading(readingForm.consumerId, {
      readingDate: readingForm.readingDate,
      currentReading: Number(readingForm.currentReading),
      readingMethod: readingForm.readingMethod,
      previousReading: readingForm.previousReading.trim()
        ? Number(readingForm.previousReading)
        : undefined,
      latitude: readingForm.latitude.trim() ? Number(readingForm.latitude) : undefined,
      longitude: readingForm.longitude.trim() ? Number(readingForm.longitude) : undefined,
      meterCondition: readingForm.meterCondition,
      photoUrl: readingForm.photoUrl.trim() || undefined,
      notes: readingForm.notes.trim() || undefined,
    })
      .then(() => {
        setReadingOpen(false);
        setReadingForm({ ...EMPTY_READING_FORM, readingDate: new Date().toISOString().slice(0, 10) });
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to record reading')))
      .finally(() => setBusy(false));
  };

  const handleGenerateBills = () => {
    setBusy(true);
    omApi.generateBills({
      ...generateForm,
      dueDate: generateForm.dueDate || generateForm.billingPeriodTo,
      projectCode: selectedProject?.projectCode,
    })
      .then((res) => {
        setGenerateOpen(false);
        setGenerateForm({ ...EMPTY_GENERATE_FORM });
        load();
        if (res.data?.generated === 0) setError('No bills generated — ensure meter readings exist for active consumers.');
      })
      .catch((err) => setError(getApiError(err, 'Failed to generate bills')))
      .finally(() => setBusy(false));
  };

  const handleBillingCycleChange = (cycle: string) => {
    const period = computeBillingPeriod(cycle as 'monthly' | 'quarterly' | 'half_yearly');
    setGenerateForm({
      billingCycle: cycle as 'monthly' | 'quarterly' | 'half_yearly',
      billingPeriodFrom: period.billingPeriodFrom,
      billingPeriodTo: period.billingPeriodTo,
      dueDate: period.dueDate,
    });
  };

  const openGenerateDialog = () => {
    setGenerateForm({ ...EMPTY_GENERATE_FORM });
    setGenerateOpen(true);
  };

  const openBillDetail = (bill: Record<string, unknown>) => {
    setDeliveryFeedback(null);
    setBusy(true);
    omApi.getBill(String(bill.id))
      .then((res) => {
        setSelectedBill(res.data ?? bill);
        setBillDetailOpen(true);
      })
      .catch(() => {
        setSelectedBill(bill);
        setBillDetailOpen(true);
      })
      .finally(() => setBusy(false));
  };

  const formatDeliverySummary = (deliveries: Array<Record<string, unknown>>) => deliveries
    .filter((d) => d.channel !== 'pdf')
    .map((d) => {
      const label = String(d.label ?? d.channel);
      if (d.status === 'sent') return `${label}: sent${d.provider ? ` via ${String(d.provider)}` : ''}`;
      if (d.status === 'handoff') return `${label}: open app & tap Send`;
      if (d.status === 'failed') return `${label}: failed (${String(d.reason ?? 'error')})`;
      return `${label}: ${String(d.status)}`;
    })
    .join(' · ');

  const runHandoffFromDeliveries = (deliveries: Array<Record<string, unknown>>) => {
    const handoffs = deliveries.filter((d) => d.status === 'handoff');
    if (handoffs.length === 1) {
      const d = handoffs[0];
      const message = String(d.message ?? '');
      const dest = String(d.destination ?? '');
      if (d.channel === 'sms') openSmsApp(dest, message);
      else if (d.channel === 'whatsapp') openWhatsAppApp(dest, message);
      else if (d.channel === 'email') openEmailApp(dest, String(selectedBill?.billNo ?? ''), message);
      return;
    }
    const whatsapp = handoffs.find((d) => d.channel === 'whatsapp');
    if (whatsapp) {
      openWhatsAppApp(String(whatsapp.destination ?? ''), String(whatsapp.message ?? ''));
    }
  };

  const handleDeliverBill = (billId: string, channels: string[], billForPdf?: Record<string, unknown>) => {
    const bill = billForPdf ?? selectedBill;
    if (!bill) return;

    setDeliveryFeedback(null);
    setError('');

    setBusy(true);
    omApi.deliverBill(billId, channels)
      .then((res) => {
        const deliveries = (res.data?.deliveries ?? []) as Array<Record<string, unknown>>;
        if (res.data?.notificationConfig) {
          setNotificationConfig(res.data.notificationConfig as Record<string, unknown>);
        }

        if (channels.includes('pdf')) {
          openBillPrintView(bill);
        }

        runHandoffFromDeliveries(deliveries);

        const notifyDeliveries = deliveries.filter((d) => d.channel !== 'pdf');
        const hasSent = notifyDeliveries.some((d) => d.status === 'sent');
        const hasHandoff = notifyDeliveries.some((d) => d.status === 'handoff');
        const hasFailure = notifyDeliveries.some((d) => d.status === 'failed');

        if (notifyDeliveries.length > 0) {
          setDeliveryFeedback({
            severity: hasFailure && !hasSent ? 'error' : hasHandoff && !hasSent ? 'info' : hasFailure ? 'warning' : 'success',
            message: formatDeliverySummary(notifyDeliveries),
          });
        } else if (channels.includes('pdf')) {
          setDeliveryFeedback({ severity: 'success', message: 'Digital Bill PDF opened — use Print → Save as PDF.' });
        }

        load();
        const updatedBill = res.data?.bill as Record<string, unknown> | undefined;
        if (updatedBill && String(selectedBill?.id) === String(billId)) {
          setSelectedBill(updatedBill);
        }
      })
      .catch((err) => {
        const msg = getApiError(err, 'Failed to deliver bill');
        if (channels.includes('pdf')) openBillPrintView(bill);
        setError(msg);
        setDeliveryFeedback({ severity: 'error', message: msg });
      })
      .finally(() => setBusy(false));
  };

  const handleGenerateDemandRegister = () => {
    setBusy(true);
    omApi.getDemandRegister(demandParams)
      .then((res) => setDemandRegister((res.data ?? null) as Record<string, unknown> | null))
      .catch((err) => setError(getApiError(err, 'Failed to generate demand register')))
      .finally(() => setBusy(false));
  };

  const handleGenerateRevenueRegister = () => {
    setBusy(true);
    omApi.getRevenueRegister(revenueParams)
      .then((res) => setRevenueRegister((res.data ?? null) as Record<string, unknown> | null))
      .catch((err) => setError(getApiError(err, 'Failed to generate revenue register')))
      .finally(() => setBusy(false));
  };

  const handleRefreshArrearRegister = () => {
    setBusy(true);
    setArrearActionFeedback(null);
    omApi.getBillingArrears(arrearParams)
      .then((res) => setArrearRegister((res.data ?? null) as Record<string, unknown> | null))
      .catch((err) => setError(getApiError(err, 'Failed to load arrear register')))
      .finally(() => setBusy(false));
  };

  const runArrearHandoff = (notification: Record<string, unknown>) => {
    const message = String(notification.message ?? '');
    const dest = String(notification.destination ?? '');
    if (notification.channel === 'whatsapp') openWhatsAppApp(dest, message);
    else openSmsApp(dest, message);
  };

  const handleArrearAction = (row: Record<string, unknown>, action: string) => {
    const billId = String(row.billId ?? row.id ?? '');
    if (!billId) {
      setError('Bill reference missing for arrear action');
      return;
    }

    setBusy(true);
    setArrearActionFeedback(null);
    setError('');

    omApi.sendArrearAction(billId, action)
      .then((res) => {
        const notification = (res.data?.notification ?? {}) as Record<string, unknown>;
        if (res.data?.notificationConfig) {
          setNotificationConfig(res.data.notificationConfig as Record<string, unknown>);
        }
        if (notification.status === 'handoff') {
          runArrearHandoff(notification);
        }
        if (action === 'demand_notice' || action === 'disconnection_notice') {
          openArrearNoticePrintView(row, action);
        }
        const label = OM_ARREAR_ACTIONS.find((a) => a.code === action)?.label ?? action;
        setArrearActionFeedback({
          severity: notification.status === 'failed' ? 'warning' : 'success',
          message: `${label}: ${notification.status === 'sent' ? 'sent' : notification.status === 'handoff' ? 'app opened — tap Send' : String(notification.reason ?? notification.status)}`,
        });
        handleRefreshArrearRegister();
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to send arrear action')))
      .finally(() => setBusy(false));
  };

  const openPaymentDetail = (payment: Record<string, unknown>) => {
    setSelectedPayment(payment);
    setPaymentDetailOpen(true);
  };

  const demandRows = (demandRegister?.rows ?? []) as Array<Record<string, unknown>>;
  const demandSummary = (demandRegister?.summary ?? {}) as Record<string, number>;
  const revenueRows = (revenueRegister?.rows ?? payments) as Array<Record<string, unknown>>;
  const revenueSummary = (revenueRegister?.summary ?? {}) as Record<string, unknown>;
  const revenueByMode = (revenueSummary.byMode ?? []) as Array<Record<string, unknown>>;
  const arrearSummary = (arrearRegister?.summary ?? {}) as Record<string, unknown>;
  const arrearByBucket = (arrearSummary.byBucket ?? []) as Array<Record<string, unknown>>;
  const arrearRows = (arrearRegister?.rows ?? []) as Array<Record<string, unknown>>;
  const agingRows = (arrearRegister?.agingRows ?? []) as Array<Record<string, unknown>>;
  const defaulterRows = (arrearRegister?.defaulterRows ?? []) as Array<Record<string, unknown>>;

  const handleSaveAccount = () => {
    if (!accountForm.fhtcNumber.trim()) {
      setError('FHTC Number is required');
      return;
    }
    setBusy(true);
    const payload = {
      consumerName: accountForm.consumerName.trim() || undefined,
      mobile: accountForm.mobile.trim() || undefined,
      village: accountForm.village.trim() || undefined,
      ward: accountForm.ward.trim() || undefined,
      consumerCategory: accountForm.consumerCategory || undefined,
      aadhaarLast4: accountForm.aadhaarLast4.trim() || undefined,
      meterNumber: accountForm.meterNumber.trim() || undefined,
      connectionStatus: accountForm.connectionStatus || 'active',
      tariffId: accountForm.tariffId || undefined,
      latitude: accountForm.latitude ? Number(accountForm.latitude) : undefined,
      longitude: accountForm.longitude ? Number(accountForm.longitude) : undefined,
    };
    const createPayload = {
      ...payload,
      fhtcNumber: accountForm.fhtcNumber.trim(),
      projectCode: selectedProject?.projectCode,
    };
    const req = accountMode === 'create'
      ? omApi.createConsumerAccount(createPayload)
      : omApi.linkBillingAccount(editingConsumer!.id, payload);
    req
      .then(() => {
        setAccountDialogOpen(false);
        setEditingConsumer(null);
        load();
      })
      .catch((err) => setError(getApiError(err, accountMode === 'create' ? 'Failed to create account' : 'Failed to update account')))
      .finally(() => setBusy(false));
  };

  const openCreateAccountDialog = () => {
    setAccountMode('create');
    setEditingConsumer(null);
    setAccountForm({ ...EMPTY_ACCOUNT_FORM });
    setAccountDialogOpen(true);
  };

  const openAccountDialog = (consumer: ConsumerOption) => {
    setAccountMode('edit');
    setEditingConsumer(consumer);
    setAccountForm({
      fhtcNumber: consumer.fhtcNumber,
      consumerName: consumer.consumerName ?? '',
      mobile: consumer.mobile ?? '',
      village: consumer.village ?? '',
      ward: consumer.ward ?? '',
      consumerCategory: consumer.consumerCategory ?? '',
      aadhaarLast4: consumer.aadhaarLast4 ?? '',
      latitude: consumer.latitude != null ? String(consumer.latitude) : '',
      longitude: consumer.longitude != null ? String(consumer.longitude) : '',
      meterNumber: consumer.meterNumber ?? '',
      connectionStatus: consumer.connectionStatus ?? 'active',
      tariffId: consumer.tariffId ?? '',
    });
    setAccountDialogOpen(true);
  };

  const handleRecordPayment = () => {
    if (!paymentForm.consumerId || !paymentForm.amount) {
      setError('Consumer and amount are required');
      return;
    }
    setBusy(true);
    omApi.recordBillingPayment({
      consumerId: paymentForm.consumerId,
      billId: paymentForm.billId || undefined,
      paymentDate: paymentForm.paymentDate,
      paymentMode: paymentForm.paymentMode,
      amount: Number(paymentForm.amount),
      transactionRef: paymentForm.transactionRef.trim() || undefined,
    })
      .then((res) => {
        setPaymentOpen(false);
        setPaymentForm({ consumerId: '', billId: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMode: 'upi', amount: '', transactionRef: '' });
        const recorded = (res.data ?? null) as Record<string, unknown> | null;
        if (recorded) openPaymentDetail(recorded);
        load();
      })
      .catch((err) => setError(getApiError(err, 'Failed to record payment')))
      .finally(() => setBusy(false));
  };

  const handleBillAction = (id: string, status: 'approved' | 'issued') => {
    setBusy(true);
    omApi.updateBillStatus(id, status)
      .then(() => load())
      .catch((err) => setError(getApiError(err, 'Failed to update bill')))
      .finally(() => setBusy(false));
  };

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {busy && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <Box
        sx={{
          mb: 2,
          p: 2,
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          bgcolor: '#fff',
          boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
        }}
      >
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Scheme / Project</InputLabel>
            <Select label="Scheme / Project" value={selectedProject?.id ?? ''}
              onChange={(e) => setSelectedProject(projects.find((p) => p.id === e.target.value) ?? null)}>
              {canViewAll && <MenuItem value="">All schemes</MenuItem>}
              {projects.map((p) => <MenuItem key={p.id} value={p.id}>{p.projectCode} — {p.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={9} display="flex" gap={1} flexWrap="wrap" alignItems="center">
          <Button size="small" variant="outlined" startIcon={<AddOutlinedIcon />} onClick={() => setTariffOpen(true)}>Add Tariff</Button>
          <Button size="small" variant="outlined" onClick={openReadingDialog}>Meter Reading</Button>
          <Button size="small" variant="contained" onClick={openGenerateDialog}>Generate Bills</Button>
          <Button size="small" variant="outlined" startIcon={<ReceiptLongOutlinedIcon />} onClick={() => setPaymentOpen(true)}>Record Payment</Button>
          <Button size="small" variant="contained" color="secondary" startIcon={<AccountBalanceOutlinedIcon />} onClick={openAccountingTab}>
            Financial Accounting
          </Button>
          <Button size="small" variant="outlined" component={RouterLink} to="/mobile-billing" startIcon={<PhoneAndroidOutlinedIcon />}>
            Mobile Billing
          </Button>
        </Grid>
      </Grid>
      </Box>

      <Box
        ref={tabsRef}
        sx={{
          mb: 0,
          overflowX: 'auto',
          bgcolor: '#fff',
          borderRadius: '12px 12px 0 0',
          border: '1px solid #e2e8f0',
          borderBottom: 'none',
          px: 1,
          pt: 0.5,
        }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={billingTabsSx}>
          <Tab label={`Consumer Accounts (${consumers.length})`} />
          <Tab label={`Tariffs (${tariffs.length})`} />
          <Tab label={`Meter Readings (${readings.length})`} />
          <Tab label={`Bills (${bills.length})`} />
          <Tab label={`Revenue Collection (${payments.length})`} />
          <Tab label="Financial Accounting" sx={{
            fontWeight: tab === 5 ? 700 : 500,
            color: tab === 5 ? 'secondary.main' : 'text.secondary',
            bgcolor: tab === 5 ? 'action.selected' : undefined,
            borderRadius: tab === 5 ? 1 : 0,
          }} />
          <Tab label="Demand Register" />
          <Tab label={`Arrear & Defaulters (${String(arrearSummary.totalUnpaidBills ?? 0)})`} />
          <Tab label="GIS Revenue" />
          <Tab label="Reports" />
        </Tabs>
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 12px 12px', p: 2, mb: 2 }}>
      {tab === 5 && (
        <Box id="billing-tab-panel" sx={{ mb: 2 }}>
          <OmAccountingStage consumers={consumers} onRefresh={load} />
        </Box>
      )}

      {tab !== 5 && (
      <Box mb={2}>
        <OmRevenueKpiDashboard
          summary={summary as Record<string, unknown>}
          projectCode={selectedProject?.projectCode}
        />
      </Box>
      )}

      {tab !== 5 && (
      <Box mb={2}>
        <BillingSectionCard title="Bill generation workflow" phase="billing">
          <BillingWorkflowTracker type="billing" />
        </BillingSectionCard>
      </Box>
      )}

      <Box id={tab !== 5 ? 'billing-tab-panel' : undefined}>
      {tab === 0 && (
        <SurfaceCard
          header={(
            <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>Consumer Account Register</Typography>
              <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreateAccountDialog}>
                Create Account
              </Button>
            </Box>
          )}
        >
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Consumer ID</TableCell>
                  <TableCell>FHTC</TableCell>
                  <TableCell>Household Head</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Village / Ward</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>GIS</TableCell>
                  <TableCell>Meter</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {consumers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography variant="body2" color="text.secondary" py={2}>
                        No consumer accounts yet. Click Create Account to register a unique billing account.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {consumers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.consumerCode}</TableCell>
                    <TableCell>{c.fhtcNumber}</TableCell>
                    <TableCell>{c.consumerName ?? '—'}</TableCell>
                    <TableCell>{c.mobile ?? '—'}</TableCell>
                    <TableCell>{[c.village, c.ward].filter(Boolean).join(' / ') || '—'}</TableCell>
                    <TableCell>{c.consumerCategoryLabel ?? c.consumerCategory?.toUpperCase() ?? '—'}</TableCell>
                    <TableCell>{c.gisLocation ?? (c.latitude != null ? formatCoordinatePair(c.latitude, c.longitude) : '—')}</TableCell>
                    <TableCell>{c.meterNumber ?? 'Unmetered'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={c.connectionStatusLabel ?? c.connectionStatus ?? 'active'} />
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => openAccountDialog(c)}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SurfaceCard>
      )}

      {tab === 1 && (
        <SurfaceCard title="Tariff Register">
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Cycle</TableCell>
                <TableCell>Fixed Charges</TableCell>
                <TableCell>Volumetric Slabs</TableCell>
                <TableCell>Additional Charges</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tariffs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No tariffs configured. Click Add Tariff to create a water tariff structure.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {tariffs.map((t) => (
                <TableRow key={String(t.id)}>
                  <TableCell>{String(t.tariffCode)}</TableCell>
                  <TableCell>{String(t.tariffName)}</TableCell>
                  <TableCell>{String(t.billingCycle)}</TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">Fixed: {formatInr(t.fixedCharge as number)}</Typography>
                    <Typography variant="caption" display="block">Service: {formatInr(t.serviceCharge as number)}</Typography>
                    <Typography variant="caption" display="block">Maint: {formatInr(t.maintenanceCharge as number)}</Typography>
                  </TableCell>
                  <TableCell>
                    {(Array.isArray(t.slabSummary) ? t.slabSummary as string[] : []).map((line) => (
                      <Typography key={line} variant="caption" display="block">{line}</Typography>
                    ))}
                    {!Array.isArray(t.slabSummary) && Array.isArray(t.slabs) && (t.slabs as Array<{ fromKl: number; toKl: number | null; ratePerKl: number }>).map((s) => (
                      <Typography key={`${s.fromKl}-${s.ratePerKl}`} variant="caption" display="block">
                        {formatSlabRange(s.fromKl, s.toKl)} @ ₹{s.ratePerKl}/KL
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">Meter rent: {formatInr(t.meterRent as number)}</Typography>
                    <Typography variant="caption" display="block">Late penalty: {String(t.latePenaltyPct)}%</Typography>
                    <Typography variant="caption" display="block">Reconnection: {formatInr(t.reconnectionCharge as number)}</Typography>
                    <Typography variant="caption" display="block">New connection: {formatInr(t.newConnectionCharge as number)}</Typography>
                  </TableCell>
                  <TableCell><Chip size="small" label={String(t.status)} color={t.status === 'active' ? 'success' : 'default'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </SurfaceCard>
      )}

      {tab === 2 && (
        <SurfaceCard title="Meter Reading Register">
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Consumer</TableCell>
                <TableCell>Previous</TableCell>
                <TableCell>Current</TableCell>
                <TableCell>Consumption (KL)</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Condition</TableCell>
                <TableCell>GPS</TableCell>
                <TableCell>Validation</TableCell>
                <TableCell>Photo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {readings.map((r) => {
                const flags = (r.validationFlags ?? {}) as Record<string, boolean>;
                const alerts = Array.isArray(r.validationAlerts)
                  ? (r.validationAlerts as string[])
                  : Object.entries(flags)
                    .filter(([, v]) => v)
                    .map(([k]) => METER_VALIDATION_LABELS[k] ?? k);
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>{String(r.readingDate)}</TableCell>
                    <TableCell>{String(r.consumerCode ?? r.fhtcNumber)}</TableCell>
                    <TableCell>{r.previousReading ?? '—'}</TableCell>
                    <TableCell>{String(r.currentReading)}</TableCell>
                    <TableCell>{String(r.consumptionKl ?? '—')}</TableCell>
                    <TableCell>{String(r.readingMethodLabel ?? r.readingMethod)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={String(r.meterConditionLabel ?? r.meterCondition ?? '—')}
                        color={r.meterCondition === 'tampered' ? 'error' : r.meterCondition === 'damaged' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{String(r.gisLocation ?? formatCoordinatePair(r.latitude as number | null, r.longitude as number | null) ?? '—')}</TableCell>
                    <TableCell>
                      {Boolean(r.isAbnormal) && <Chip size="small" color="warning" label="Abnormal" sx={{ mr: 0.5, mb: 0.5 }} />}
                      {alerts.map((a) => (
                        <Chip key={a} size="small" variant="outlined" color="warning" label={a} sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                      {!Boolean(r.isAbnormal) && alerts.length === 0 && (
                        <Chip size="small" color="success" variant="outlined" label="Valid" />
                      )}
                    </TableCell>
                    <TableCell>
                      {r.photoUrl
                        ? <Button size="small" href={String(r.photoUrl)} target="_blank" rel="noreferrer">View</Button>
                        : <Typography variant="caption" color="text.secondary">Not captured</Typography>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </TableContainer>
        </SurfaceCard>
      )}

      {tab === 3 && (
        <SurfaceCard title="Billing Register">
          <TableContainer>
            <Table size="small" sx={dataTableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Bill No</TableCell>
                <TableCell>Consumer</TableCell>
                <TableCell>Cycle</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Consumption</TableCell>
                <TableCell>Water</TableCell>
                <TableCell>Fixed</TableCell>
                <TableCell>Tax / Penalty</TableCell>
                <TableCell>Arrears</TableCell>
                <TableCell>Total Demand</TableCell>
                <TableCell>Balance</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bills.map((b) => (
                <TableRow key={String(b.id)}>
                  <TableCell>{String(b.billNo)}</TableCell>
                  <TableCell>{String(b.consumerCode ?? b.fhtcNumber)}</TableCell>
                  <TableCell>{String(b.billingCycleLabel ?? b.billingCycle ?? 'Monthly')}</TableCell>
                  <TableCell>{String(b.billingPeriodFrom)} → {String(b.billingPeriodTo)}</TableCell>
                  <TableCell>{String(b.consumptionKl)} KL</TableCell>
                  <TableCell>{formatInr(b.waterCharge as number)}</TableCell>
                  <TableCell>{formatInr((b.fixedChargesTotal ?? b.fixedCharge) as number)}</TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">Tax: {formatInr(b.taxAmount as number)}</Typography>
                    <Typography variant="caption" display="block">Penalty: {formatInr(b.penaltyAmount as number)}</Typography>
                  </TableCell>
                  <TableCell>{formatInr(b.arrearsAmount as number)}</TableCell>
                  <TableCell>{formatInr(b.totalAmount as number)}</TableCell>
                  <TableCell>{formatInr(b.balanceAmount as number)}</TableCell>
                  <TableCell><Chip size="small" label={String(b.statusLabel ?? b.status)} color={billStatusColor(String(b.status))} /></TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => openBillDetail(b)}>View</Button>
                    {b.status === 'generated' && (
                      <Button size="small" onClick={() => handleBillAction(String(b.id), 'approved')}>Approve</Button>
                    )}
                    {(b.status === 'approved' || b.status === 'generated') && (
                      <Button size="small" onClick={() => handleBillAction(String(b.id), 'issued')}>Issue</Button>
                    )}
                    {['generated', 'approved', 'issued', 'paid', 'partial', 'overdue'].includes(String(b.status)) && (
                      <Button size="small" onClick={() => openBillDetail(b)}>Deliver</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </SurfaceCard>
      )}

      {tab === 4 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <SurfaceCard title="Revenue Collection Management">
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>Collection Workflow</Typography>
                <Box display="flex" gap={0.75} flexWrap="wrap" alignItems="center">
                  {OM_COLLECTION_WORKFLOW.map((step, idx) => (
                    <Box key={step.step} display="flex" alignItems="center" gap={0.75}>
                      <Chip size="small" color="primary" variant="outlined" label={step.label} />
                      {idx < OM_COLLECTION_WORKFLOW.length - 1 && (
                        <Typography variant="caption" color="text.secondary">→</Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box mb={2} display="flex" gap={0.75} flexWrap="wrap">
                {OM_PAYMENT_MODES.map((m) => (
                  <Chip key={m.code} size="small" variant="outlined" label={m.label} />
                ))}
              </Box>
              <Grid container spacing={2} mb={2}>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField fullWidth size="small" label="Period From" type="date" InputLabelProps={{ shrink: true }}
                    value={revenuePeriod.periodFrom}
                    onChange={(e) => setRevenuePeriod({ ...revenuePeriod, periodFrom: e.target.value })} />
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField fullWidth size="small" label="Period To" type="date" InputLabelProps={{ shrink: true }}
                    value={revenuePeriod.periodTo}
                    onChange={(e) => setRevenuePeriod({ ...revenuePeriod, periodTo: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6} md={4} display="flex" gap={1} alignItems="center">
                  <Button variant="contained" onClick={handleGenerateRevenueRegister}>Generate Revenue Register</Button>
                  <Typography variant="caption" color="text.secondary">
                    {revenueRegister?.generatedAt
                      ? `Generated ${String(revenueRegister.generatedAt).slice(0, 19).replace('T', ' ')}`
                      : 'Receipt · Acknowledgement · Revenue Register'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container spacing={2} mb={2}>
                {[
                  { label: 'Total Receipts', value: String(revenueSummary.totalReceipts ?? payments.length), tone: 'blue' as const },
                  { label: 'Total Collection', value: formatInr(Number(revenueSummary.totalCollection ?? summary.monthlyCollection ?? 0)), tone: 'teal' as const },
                  { label: 'Payment Modes', value: revenueByMode.length || OM_PAYMENT_MODES.length, tone: 'violet' as const },
                ].map((k) => (
                  <Grid item xs={6} sm={4} md={2} key={k.label}>
                    <KpiStatCard label={k.label} value={k.value} tone={k.tone} />
                  </Grid>
                ))}
              </Grid>
              {revenueByMode.length > 0 && (
                <Box mb={2} display="flex" gap={1} flexWrap="wrap">
                  {revenueByMode.map((m) => (
                    <Chip
                      key={String(m.paymentMode)}
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={`${String(m.paymentModeLabel ?? m.paymentMode)}: ${formatInr(Number(m.amount ?? 0))} (${String(m.count ?? 0)})`}
                    />
                  ))}
                </Box>
              )}
            </SurfaceCard>
          </Grid>
          <Grid item xs={12}>
            <SurfaceCard title="Collection Register">
              <TableContainer>
                <Table size="small" sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Receipt No.</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Consumer</TableCell>
                      <TableCell>Payment Mode</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Bill</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((p) => {
                      const notification = (p.notification ?? {}) as Record<string, unknown>;
                      const notifyStatus = String(notification.status ?? 'recorded');
                      return (
                        <TableRow key={String(p.id)}>
                          <TableCell>{String(p.receiptNo)}</TableCell>
                          <TableCell>{String(p.paymentDate)}</TableCell>
                          <TableCell>{String(p.consumerCode)} — {String(p.fhtcNumber ?? '')}</TableCell>
                          <TableCell>{String(p.paymentModeLabel ?? p.paymentMode)}</TableCell>
                          <TableCell>{formatInr(p.amount as number)}</TableCell>
                          <TableCell>{String(p.billNo ?? '—')}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={notifyStatus === 'sent' ? 'Notified' : notifyStatus === 'failed' ? 'Pending notify' : 'Recorded'}
                              color={notifyStatus === 'sent' ? 'success' : notifyStatus === 'failed' ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Button size="small" onClick={() => openPaymentDetail(p)}>Receipt</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!payments.length && (
                      <TableRow>
                        <TableCell colSpan={8} align="center">No payments recorded — click Record Payment to start collection</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </SurfaceCard>
          </Grid>
          {revenueRows.length > 0 && revenueRegister && (
            <Grid item xs={12}>
              <SurfaceCard title="Revenue Register">
                <TableContainer>
                  <Table size="small" sx={dataTableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Receipt No.</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Consumer</TableCell>
                        <TableCell>Village</TableCell>
                        <TableCell>Mode</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Transaction Ref</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {revenueRows.map((p) => (
                        <TableRow key={String(p.id ?? p.receiptNo)}>
                          <TableCell>{String(p.receiptNo)}</TableCell>
                          <TableCell>{String(p.paymentDate)}</TableCell>
                          <TableCell>{String(p.consumerCode)}</TableCell>
                          <TableCell>{String(p.village ?? '—')}</TableCell>
                          <TableCell>{String(p.paymentModeLabel ?? p.paymentMode)}</TableCell>
                          <TableCell>{formatInr(p.amount as number)}</TableCell>
                          <TableCell>{String(p.transactionRef ?? '—')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </SurfaceCard>
            </Grid>
          )}
        </Grid>
      )}

      {tab === 6 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <SurfaceCard title="Demand Register Management">
              <Grid container spacing={2} mb={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Report View</InputLabel>
                    <Select label="Report View" value={demandGroupBy}
                      onChange={(e) => setDemandGroupBy(e.target.value)}>
                      {OM_DEMAND_REGISTER_VIEWS.map((v) => (
                        <MenuItem key={v.code} value={v.code}>{v.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField fullWidth size="small" label="Period From" type="date" InputLabelProps={{ shrink: true }}
                    value={demandPeriod.periodFrom}
                    onChange={(e) => setDemandPeriod({ ...demandPeriod, periodFrom: e.target.value })} />
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField fullWidth size="small" label="Period To" type="date" InputLabelProps={{ shrink: true }}
                    value={demandPeriod.periodTo}
                    onChange={(e) => setDemandPeriod({ ...demandPeriod, periodTo: e.target.value })} />
                </Grid>
                <Grid item xs={12} sm={6} md={5} display="flex" gap={1} alignItems="center">
                  <Button variant="contained" onClick={handleGenerateDemandRegister}>Generate Demand Register</Button>
                  <Typography variant="caption" color="text.secondary">
                    Auto-generated from bills &amp; payments
                    {demandRegister?.generatedAt ? ` · ${String(demandRegister.generatedAt).slice(0, 19).replace('T', ' ')}` : ''}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container spacing={2} mb={2}>
                {[
                  { label: 'Opening Demand', value: formatInr(demandSummary.openingDemand), tone: 'blue' as const },
                  { label: 'Current Demand', value: formatInr(demandSummary.currentDemand), tone: 'violet' as const },
                  { label: 'Collection', value: formatInr(demandSummary.collection), tone: 'teal' as const },
                  { label: 'Balance', value: formatInr(demandSummary.balance), tone: 'amber' as const },
                  { label: 'Arrears', value: formatInr(demandSummary.arrears), tone: 'rose' as const },
                ].map((k) => (
                  <Grid item xs={6} sm={4} md={2} key={k.label}>
                    <KpiStatCard label={k.label} value={k.value} tone={k.tone} />
                  </Grid>
                ))}
              </Grid>
              <TableContainer>
                <Table size="small" sx={dataTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{String(demandRegister?.groupByLabel ?? 'Group')}</TableCell>
                      <TableCell>Opening Demand</TableCell>
                      <TableCell>Current Demand</TableCell>
                      <TableCell>Collection</TableCell>
                      <TableCell>Balance</TableCell>
                      <TableCell>Arrears</TableCell>
                      <TableCell>Bills</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {demandRows.map((d) => (
                      <TableRow key={String(d.key ?? d.label)}>
                        <TableCell>{String(d.label)}</TableCell>
                        <TableCell>{formatInr(d.openingDemand as number)}</TableCell>
                        <TableCell>{formatInr(d.currentDemand as number)}</TableCell>
                        <TableCell>{formatInr(d.collection as number)}</TableCell>
                        <TableCell>{formatInr(d.balance as number)}</TableCell>
                        <TableCell>{formatInr(d.arrears as number)}</TableCell>
                        <TableCell>{String(d.billCount ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                    {!demandRows.length && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">No demand data — generate bills and click Generate Demand Register</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </SurfaceCard>
          </Grid>
        </Grid>
      )}

      {tab === 7 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <SurfaceCard title="Arrear & Defaulter Management">
              {arrearActionFeedback && (
                <Alert severity={arrearActionFeedback.severity} sx={{ mb: 2 }} onClose={() => setArrearActionFeedback(null)}>
                  {arrearActionFeedback.message}
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" mb={2}>
                Track unpaid bills, aging categories, and recovery actions for defaulters.
              </Typography>
              <Grid container spacing={2} mb={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Report View</InputLabel>
                    <Select label="Report View" value={arrearView} onChange={(e) => setArrearView(e.target.value)}>
                      {OM_ARREAR_VIEWS.map((v) => (
                        <MenuItem key={v.code} value={v.code}>{v.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Aging Category</InputLabel>
                    <Select label="Aging Category" value={arrearBucketFilter}
                      onChange={(e) => setArrearBucketFilter(e.target.value)}>
                      <MenuItem value="">All categories</MenuItem>
                      {OM_ARREAR_BUCKETS.map((b) => (
                        <MenuItem key={b.code} value={b.code}>{b.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3} display="flex" alignItems="center">
                  <Button variant="contained" onClick={handleRefreshArrearRegister}>Generate Register</Button>
                </Grid>
              </Grid>
              <Grid container spacing={2} mb={2}>
                {[
                  { label: 'Unpaid Bills', value: String(arrearSummary.totalUnpaidBills ?? 0), tone: 'rose' as const },
                  { label: 'Total Arrears', value: formatInr(Number(arrearSummary.totalArrearAmount ?? summary.outstandingArrears ?? 0)), tone: 'amber' as const },
                  { label: 'Defaulters', value: String(arrearSummary.defaulterCount ?? summary.defaulterCount ?? 0), tone: 'rose' as const },
                  { label: 'Consumers in Arrears', value: String(arrearSummary.consumerCount ?? 0), tone: 'violet' as const },
                ].map((k) => (
                  <Grid item xs={6} sm={3} key={k.label}>
                    <KpiStatCard label={k.label} value={k.value} tone={k.tone} />
                  </Grid>
                ))}
              </Grid>
              <Box mb={2} display="flex" gap={0.75} flexWrap="wrap">
                {OM_ARREAR_BUCKETS.map((b) => {
                  const bucketData = arrearByBucket.find((x) => x.code === b.code);
                  return (
                    <Chip
                      key={b.code}
                      size="small"
                      color={arrearBucketFilter === b.code ? 'primary' : 'default'}
                      variant={arrearBucketFilter === b.code ? 'filled' : 'outlined'}
                      label={`${b.label}: ${formatInr(Number(bucketData?.amount ?? 0))} (${String(bucketData?.count ?? 0)})`}
                      onClick={() => setArrearBucketFilter(arrearBucketFilter === b.code ? '' : b.code)}
                    />
                  );
                })}
              </Box>
            </SurfaceCard>
          </Grid>
          <Grid item xs={12}>
            <SurfaceCard title={OM_ARREAR_VIEWS.find((v) => v.code === arrearView)?.label ?? 'Arrear Register'}>
              {arrearView === 'arrear_register' && (
                <TableContainer>
                  <Table size="small" sx={dataTableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Bill</TableCell>
                        <TableCell>Consumer</TableCell>
                        <TableCell>Balance</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell>Days Overdue</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {arrearRows.map((a) => (
                        <TableRow key={String(a.id)}>
                          <TableCell>{String(a.billNo)}</TableCell>
                          <TableCell>{String(a.consumerCode)} — {String(a.fhtcNumber ?? '')}</TableCell>
                          <TableCell>{formatInr(a.balanceAmount as number)}</TableCell>
                          <TableCell>{String(a.dueDate ?? '—')}</TableCell>
                          <TableCell>{String(a.daysOverdue ?? 0)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={String(a.arrearBucketLabel ?? '—')} variant="outlined" color={a.isDefaulter ? 'error' : 'default'} />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={0.5} flexWrap="wrap">
                              {OM_ARREAR_ACTIONS.map((act) => (
                                <Button key={act.code} size="small" onClick={() => handleArrearAction(a, act.code)}>
                                  {act.label}
                                </Button>
                              ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!arrearRows.length && (
                        <TableRow>
                          <TableCell colSpan={7} align="center">No unpaid bills in selected category</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {arrearView === 'consumer_aging' && (
                <TableContainer>
                  <Table size="small" sx={dataTableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Consumer</TableCell>
                        <TableCell>Village</TableCell>
                        <TableCell>Total Arrear</TableCell>
                        <TableCell>Oldest Due</TableCell>
                        <TableCell>Max Days</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Bills</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {agingRows.map((a) => {
                        const bills = (a.bills ?? []) as Array<Record<string, unknown>>;
                        const primaryBill = bills[0] ?? a;
                        return (
                          <TableRow key={String(a.consumerId)}>
                            <TableCell>{String(a.consumerCode)} — {String(a.fhtcNumber ?? '')}</TableCell>
                            <TableCell>{String(a.village ?? '—')}</TableCell>
                            <TableCell>{formatInr(a.totalArrear as number)}</TableCell>
                            <TableCell>{String(a.oldestDueDate ?? '—')}</TableCell>
                            <TableCell>{String(a.maxDaysOverdue ?? 0)}</TableCell>
                            <TableCell>
                              <Chip size="small" label={String(a.arrearBucketLabel ?? '—')} variant="outlined" color={a.isDefaulter ? 'error' : 'default'} />
                            </TableCell>
                            <TableCell>{String(a.billCount ?? bills.length)}</TableCell>
                            <TableCell>
                              <Box display="flex" gap={0.5} flexWrap="wrap">
                                {OM_ARREAR_ACTIONS.slice(0, 2).map((act) => (
                                  <Button key={act.code} size="small" onClick={() => handleArrearAction(primaryBill, act.code)}>
                                    {act.label}
                                  </Button>
                                ))}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!agingRows.length && (
                        <TableRow>
                          <TableCell colSpan={8} align="center">No consumer aging data</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {arrearView === 'defaulter_list' && (
                <TableContainer>
                  <Table size="small" sx={dataTableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Consumer</TableCell>
                        <TableCell>Mobile</TableCell>
                        <TableCell>Total Arrear</TableCell>
                        <TableCell>Max Days Overdue</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Unpaid Bills</TableCell>
                        <TableCell>Recovery Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {defaulterRows.map((a) => {
                        const bills = (a.bills ?? []) as Array<Record<string, unknown>>;
                        const primaryBill = bills[0] ?? a;
                        return (
                          <TableRow key={String(a.consumerId)}>
                            <TableCell>{String(a.consumerCode)} — {String(a.fhtcNumber ?? '')}</TableCell>
                            <TableCell>{String(a.mobile ?? '—')}</TableCell>
                            <TableCell>{formatInr(a.totalArrear as number)}</TableCell>
                            <TableCell>{String(a.maxDaysOverdue ?? 0)}</TableCell>
                            <TableCell>
                              <Chip size="small" color="error" variant="outlined" label={String(a.arrearBucketLabel ?? '—')} />
                            </TableCell>
                            <TableCell>{String(a.billCount ?? bills.length)}</TableCell>
                            <TableCell>
                              <Box display="flex" gap={0.5} flexWrap="wrap">
                                {OM_ARREAR_ACTIONS.map((act) => (
                                  <Button key={act.code} size="small" color={act.code.includes('disconnection') ? 'error' : 'inherit'}
                                    onClick={() => handleArrearAction(primaryBill, act.code)}>
                                    {act.label}
                                  </Button>
                                ))}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!defaulterRows.length && (
                        <TableRow>
                          <TableCell colSpan={7} align="center">No defaulters (30+ days overdue)</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </SurfaceCard>
          </Grid>
        </Grid>
      )}

      {tab === 8 && (
        <OmRevenueGisDashboard data={gisRevenue} />
      )}

      {tab === 9 && (
        <OmBillingReportsStage projectParams={projectParams} />
      )}

      </Box>
      </Box>

      <Dialog open={accountDialogOpen} onClose={() => setAccountDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: billingDialogPaperSx }}>
        <BillingDialogHeader
          title={accountMode === 'create' ? 'Create Consumer Account' : 'Edit Consumer Account'}
          subtitle={accountMode === 'edit' ? editingConsumer?.consumerCode : undefined}
          phase="billing"
          busy={busy}
        />
        <DialogContent sx={billingDialogContentSx}>
          {accountMode === 'edit' && editingConsumer && (
            <Typography variant="body2" color="text.secondary" mb={2}>
              Consumer ID: {editingConsumer.consumerCode}
            </Typography>
          )}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" required label="FHTC Number" value={accountForm.fhtcNumber}
                disabled={accountMode === 'edit'}
                onChange={(e) => setAccountForm({ ...accountForm, fhtcNumber: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Household Head Name" value={accountForm.consumerName}
                onChange={(e) => setAccountForm({ ...accountForm, consumerName: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Mobile Number" value={accountForm.mobile}
                onChange={(e) => setAccountForm({ ...accountForm, mobile: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Aadhaar (last 4 digits, optional)" value={accountForm.aadhaarLast4}
                inputProps={{ maxLength: 4 }}
                onChange={(e) => setAccountForm({ ...accountForm, aadhaarLast4: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Village" value={accountForm.village}
                onChange={(e) => setAccountForm({ ...accountForm, village: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Ward" value={accountForm.ward}
                onChange={(e) => setAccountForm({ ...accountForm, ward: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select label="Category" value={accountForm.consumerCategory}
                  onChange={(e) => setAccountForm({ ...accountForm, consumerCategory: e.target.value })}>
                  <MenuItem value="">Not set</MenuItem>
                  {OM_CONSUMER_CATEGORIES.map((c) => (
                    <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Connection Status</InputLabel>
                <Select label="Connection Status" value={accountForm.connectionStatus}
                  onChange={(e) => setAccountForm({ ...accountForm, connectionStatus: e.target.value })}>
                  {OM_CONNECTION_STATUSES.map((s) => (
                    <MenuItem key={s.code} value={s.code}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Meter Number" value={accountForm.meterNumber}
                onChange={(e) => setAccountForm({ ...accountForm, meterNumber: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Tariff</InputLabel>
                <Select label="Tariff" value={accountForm.tariffId}
                  onChange={(e) => setAccountForm({ ...accountForm, tariffId: e.target.value })}>
                  <MenuItem value="">Default tariff</MenuItem>
                  {tariffs.map((t) => (
                    <MenuItem key={String(t.id)} value={String(t.id)}>{String(t.tariffName)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Latitude (GIS)" value={accountForm.latitude}
                onChange={(e) => setAccountForm({ ...accountForm, latitude: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Longitude (GIS)" value={accountForm.longitude}
                onChange={(e) => setAccountForm({ ...accountForm, longitude: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={billingDialogActionsSx}>
          <Button onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAccount}>
            {accountMode === 'create' ? 'Create Account' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tariffOpen} onClose={() => setTariffOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: billingDialogPaperSx }}>
        <BillingDialogHeader title="Configure Water Tariff" phase="billing" busy={busy} />
        <DialogContent sx={billingDialogContentSx}>
          <Typography variant="subtitle2" fontWeight={700} mt={1} mb={1}>Basic Details</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Tariff Name" value={tariffForm.tariffName}
                onChange={(e) => setTariffForm({ ...tariffForm, tariffName: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Billing Cycle</InputLabel>
                <Select label="Billing Cycle" value={tariffForm.billingCycle}
                  onChange={(e) => setTariffForm({ ...tariffForm, billingCycle: e.target.value })}>
                  {OM_BILLING_CYCLES.map((c) => (
                    <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select label="Category" value={tariffForm.consumerCategory}
                  onChange={(e) => setTariffForm({ ...tariffForm, consumerCategory: e.target.value })}>
                  <MenuItem value="">All categories</MenuItem>
                  {OM_CONSUMER_CATEGORIES.map((c) => (
                    <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Effective From" type="date" InputLabelProps={{ shrink: true }}
                value={tariffForm.effectiveFrom} onChange={(e) => setTariffForm({ ...tariffForm, effectiveFrom: e.target.value })} />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" fontWeight={700} mt={2} mb={1}>Fixed Charges (₹)</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Monthly Fixed Charge" value={tariffForm.fixedCharge}
                onChange={(e) => setTariffForm({ ...tariffForm, fixedCharge: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Service Charge" value={tariffForm.serviceCharge}
                onChange={(e) => setTariffForm({ ...tariffForm, serviceCharge: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Maintenance Charge" value={tariffForm.maintenanceCharge}
                onChange={(e) => setTariffForm({ ...tariffForm, maintenanceCharge: e.target.value })} />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" fontWeight={700} mt={2} mb={1}>Meter-Based Tariff — Slab Wise Consumption</Typography>
          <Table size="small" sx={dataTableSx}>
            <TableHead>
              <TableRow>
                <TableCell>From (KL)</TableCell>
                <TableCell>To (KL)</TableCell>
                <TableCell>Rate (₹/KL)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tariffForm.slabs.map((slab, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField fullWidth size="small" value={slab.fromKl}
                      onChange={(e) => updateTariffSlab(idx, 'fromKl', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField fullWidth size="small" placeholder="Above (leave empty)"
                      value={slab.toKl}
                      onChange={(e) => updateTariffSlab(idx, 'toKl', e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField fullWidth size="small" value={slab.ratePerKl}
                      onChange={(e) => updateTariffSlab(idx, 'ratePerKl', e.target.value)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            Example: 0–10 KL @ ₹5/KL · 10–20 KL @ ₹8/KL · Above 20 KL @ ₹12/KL (leave To empty for open-ended slab)
          </Typography>

          <Typography variant="subtitle2" fontWeight={700} mt={2} mb={1}>Additional Charges</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Meter Rent (₹)" value={tariffForm.meterRent}
                onChange={(e) => setTariffForm({ ...tariffForm, meterRent: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Late Payment Penalty (%)" value={tariffForm.latePenaltyPct}
                onChange={(e) => setTariffForm({ ...tariffForm, latePenaltyPct: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Reconnection Charges (₹)" value={tariffForm.reconnectionCharge}
                onChange={(e) => setTariffForm({ ...tariffForm, reconnectionCharge: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="New Connection Charges (₹)" value={tariffForm.newConnectionCharge}
                onChange={(e) => setTariffForm({ ...tariffForm, newConnectionCharge: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={billingDialogActionsSx}>
          <Button onClick={() => setTariffOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTariff}>Save Tariff</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={readingOpen} onClose={() => setReadingOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: billingDialogPaperSx }}>
        <BillingDialogHeader title="Record Meter Reading" phase="billing" busy={busy} />
        <DialogContent sx={billingDialogContentSx}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Consumer</InputLabel>
                <Select label="Consumer" value={readingForm.consumerId}
                  onChange={(e) => handleReadingConsumerChange(e.target.value)}>
                  {consumers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.consumerCode} — {c.fhtcNumber}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Reading Method</InputLabel>
                <Select label="Reading Method" value={readingForm.readingMethod}
                  onChange={(e) => setReadingForm({ ...readingForm, readingMethod: e.target.value })}>
                  {OM_READING_METHODS.map((m) => <MenuItem key={m.code} value={m.code}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Reading Date" type="date" InputLabelProps={{ shrink: true }}
                value={readingForm.readingDate} onChange={(e) => setReadingForm({ ...readingForm, readingDate: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Previous Reading (KL)" value={readingForm.previousReading}
                helperText={!readingForm.previousReading.trim() && effectivePreviousReading != null ? `Auto: ${effectivePreviousReading}` : 'Override if needed'}
                onChange={(e) => setReadingForm({ ...readingForm, previousReading: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Current Reading (KL)" value={readingForm.currentReading}
                onChange={(e) => setReadingForm({ ...readingForm, currentReading: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Consumption (KL)" value={readingPreview.consumption ?? ''} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="GPS Latitude" value={readingForm.latitude}
                onChange={(e) => setReadingForm({ ...readingForm, latitude: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="GPS Longitude" value={readingForm.longitude}
                onChange={(e) => setReadingForm({ ...readingForm, longitude: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Meter Condition</InputLabel>
                <Select label="Meter Condition" value={readingForm.meterCondition}
                  onChange={(e) => setReadingForm({ ...readingForm, meterCondition: e.target.value })}>
                  {OM_METER_CONDITIONS.map((m) => <MenuItem key={m.code} value={m.code}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Meter Photo URL" value={readingForm.photoUrl}
                onChange={(e) => setReadingForm({ ...readingForm, photoUrl: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <BilingualRemarkField
                label="Notes"
                pdfTitle="Meter Reading Notes"
                value={parseBilingualText(readingForm.notes)}
                onChange={(v) => setReadingForm({ ...readingForm, notes: serializeBilingualText(v) })}
                minRows={2}
              />
            </Grid>
            {(readingPreview.alerts.length > 0 || readingPreview.isAbnormal) && (
              <Grid item xs={12}>
                <Alert severity={readingPreview.valid ? 'warning' : 'error'}>
                  <Typography variant="subtitle2" gutterBottom>Validation</Typography>
                  {readingPreview.alerts.map((a) => (
                    <Typography key={a} variant="body2">• {a}</Typography>
                  ))}
                  {readingPreview.valid && readingPreview.isAbnormal && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>Reading can be saved but will be flagged as abnormal.</Typography>
                  )}
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={billingDialogActionsSx}>
          <Button onClick={() => setReadingOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordReading} disabled={!readingPreview.valid}>Save Reading</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: billingDialogPaperSx }}>
        <BillingDialogHeader title="Generate Bills — Automatic Billing Cycle" phase="billing" busy={busy} />
        <DialogContent sx={billingDialogContentSx}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Billing Cycle</InputLabel>
                <Select label="Billing Cycle" value={generateForm.billingCycle}
                  onChange={(e) => handleBillingCycleChange(e.target.value)}>
                  {OM_BILLING_CYCLES.map((c) => <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Period From" type="date" InputLabelProps={{ shrink: true }}
                value={generateForm.billingPeriodFrom}
                onChange={(e) => setGenerateForm({ ...generateForm, billingPeriodFrom: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth size="small" label="Period To" type="date" InputLabelProps={{ shrink: true }}
                value={generateForm.billingPeriodTo}
                onChange={(e) => setGenerateForm({ ...generateForm, billingPeriodTo: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Due Date" type="date" InputLabelProps={{ shrink: true }}
                value={generateForm.dueDate}
                onChange={(e) => setGenerateForm({ ...generateForm, dueDate: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Billing Process</Typography>
              <Box display="flex" gap={0.75} flexWrap="wrap" alignItems="center">
                {OM_BILLING_WORKFLOW.map((step, idx) => (
                  <Box key={step.step} display="flex" alignItems="center" gap={0.75}>
                    <Chip size="small" color="primary" variant="outlined" label={step.label} />
                    {idx < OM_BILLING_WORKFLOW.length - 1 && (
                      <Typography variant="caption" color="text.secondary">→</Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={billingDialogActionsSx}>
          <Button onClick={() => setGenerateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleGenerateBills}>Generate Bills</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={billDetailOpen} onClose={() => setBillDetailOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: billingDialogPaperSx }}>
        <BillingDialogHeader
          title="Bill Details"
          subtitle={String(selectedBill?.billNo ?? '')}
          phase="billing"
          busy={busy}
        />
        <DialogContent sx={billingDialogContentSx}>
          {selectedBill && (() => {
            const components = (selectedBill.billComponents ?? {}) as Record<string, unknown>;
            const consumer = (components.consumerDetails ?? {}) as Record<string, unknown>;
            const activeStep = workflowStepIndex(String(selectedBill.workflowStep));
            return (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12}>
                  <Box display="flex" gap={0.75} flexWrap="wrap" alignItems="center" mb={1}>
                    {OM_BILLING_WORKFLOW.map((step, idx) => (
                      <Chip
                        key={step.step}
                        size="small"
                        label={step.label}
                        color={idx <= activeStep ? 'primary' : 'default'}
                        variant={idx <= activeStep ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Consumer Details</Typography>
                  <Typography variant="body2">ID: {String(consumer.consumerCode ?? selectedBill.consumerCode ?? '—')}</Typography>
                  <Typography variant="body2">FHTC: {String(consumer.fhtcNumber ?? selectedBill.fhtcNumber ?? '—')}</Typography>
                  <Typography variant="body2">Name: {String(consumer.consumerName ?? selectedBill.consumerName ?? '—')}</Typography>
                  <Typography variant="body2">Village: {String(consumer.village ?? selectedBill.village ?? '—')}</Typography>
                  <Typography variant="body2">Mobile: {String(consumer.mobile ?? selectedBill.mobile ?? '—')}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Billing Period</Typography>
                  <Typography variant="body2">Cycle: {String(selectedBill.billingCycleLabel ?? selectedBill.billingCycle ?? '—')}</Typography>
                  <Typography variant="body2">From: {String(selectedBill.billingPeriodFrom)}</Typography>
                  <Typography variant="body2">To: {String(selectedBill.billingPeriodTo)}</Typography>
                  <Typography variant="body2">Due: {String(selectedBill.dueDate ?? '—')}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Table size="small" sx={dataTableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Component</TableCell><TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[
                        ['Previous Reading (KL)', String(components.previousReading ?? selectedBill.previousReading ?? '—')],
                        ['Current Reading (KL)', String(components.currentReading ?? selectedBill.currentReading ?? '—')],
                        ['Consumption (KL)', String(components.consumptionKl ?? selectedBill.consumptionKl ?? '—')],
                        ['Water Charges', formatInr(Number(components.waterCharges ?? selectedBill.waterCharge ?? 0))],
                        ['Fixed Charges', formatInr(Number(components.fixedCharges ?? selectedBill.fixedChargesTotal ?? 0))],
                        ['Taxes', formatInr(Number(components.taxes ?? selectedBill.taxAmount ?? 0))],
                        ['Penalty', formatInr(Number(components.penalty ?? selectedBill.penaltyAmount ?? 0))],
                        ['Outstanding Arrears', formatInr(Number(components.outstandingArrears ?? selectedBill.arrearsAmount ?? 0))],
                        ['Total Demand', formatInr(Number(components.totalDemand ?? selectedBill.totalAmount ?? 0))],
                      ].map(([label, value]) => (
                        <TableRow key={String(label)}>
                          <TableCell>{label}</TableCell>
                          <TableCell align="right">{value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Deliver Bill</Typography>
                  <Alert severity={notificationConfig?.mode === 'live' ? 'success' : 'info'} sx={{ mb: 1 }}>
                    {notificationConfig?.mode === 'live' ? (
                      <>
                        <strong>Live gateway mode.</strong>
                        {' SMS: '}{notificationConfig?.sms && (notificationConfig.sms as Record<string, unknown>).configured
                          ? String((notificationConfig.sms as Record<string, unknown>).provider) : 'not configured'}
                        {' · WhatsApp: '}{notificationConfig?.whatsapp && (notificationConfig.whatsapp as Record<string, unknown>).configured
                          ? String((notificationConfig.whatsapp as Record<string, unknown>).provider) : 'not configured'}
                        {' · Email: '}{notificationConfig?.email && (notificationConfig.email as Record<string, unknown>).configured
                          ? String((notificationConfig.email as Record<string, unknown>).provider) : 'not configured'}
                      </>
                    ) : (
                      <>
                        <strong>Handoff mode.</strong> Messages open your device apps — tap Send to deliver.
                        Set <code>BILL_NOTIFY_MODE=live</code> and gateway keys in <code>backend/api/.env</code> for automatic SMS/WhatsApp/Email.
                      </>
                    )}
                  </Alert>
                  {deliveryFeedback && (
                    <Alert severity={deliveryFeedback.severity} sx={{ mb: 1 }} onClose={() => setDeliveryFeedback(null)}>
                      {deliveryFeedback.message}
                    </Alert>
                  )}
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {OM_BILL_DELIVERY_CHANNELS.map((ch) => (
                      <Button
                        key={ch.code}
                        size="small"
                        variant="outlined"
                        disabled={busy}
                        onClick={() => handleDeliverBill(String(selectedBill.id), [ch.code], selectedBill)}
                      >
                        {ch.label}
                      </Button>
                    ))}
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busy}
                      onClick={() => handleDeliverBill(
                        String(selectedBill.id),
                        OM_BILL_DELIVERY_CHANNELS.map((c) => c.code),
                        selectedBill,
                      )}
                    >
                      Send All
                    </Button>
                  </Box>
                  {Array.isArray(selectedBill.notifications) && (selectedBill.notifications as unknown[]).length > 0 && (
                    <Box mt={1}>
                      {(selectedBill.notifications as Array<Record<string, unknown>>).slice(-4).map((n) => (
                        <Typography key={`${n.channel}-${n.sentAt}`} variant="caption" display="block" color="text.secondary">
                          {String(n.label ?? n.channel)} — {n.status === 'handoff' ? 'handoff' : String(n.status)}
                          {n.provider ? ` via ${String(n.provider)}` : ''}
                          {n.destination ? ` → ${String(n.destination)}` : ''}
                          {n.note ? ` (${String(n.note)})` : ''}
                          {n.reason ? ` — ${String(n.reason)}` : ''}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Grid>
              </Grid>
            );
          })()}
        </DialogContent>
        <DialogActions sx={billingDialogActionsSx}>
          <Button onClick={() => setBillDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentOpen} onClose={() => setPaymentOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: billingDialogPaperSx }}>
        <BillingDialogHeader title="Record Payment" phase="collection" busy={busy} />
        <DialogContent sx={billingDialogContentSx}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Consumer</InputLabel>
                <Select label="Consumer" value={paymentForm.consumerId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, consumerId: e.target.value })}>
                  {consumers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.consumerCode} — {c.fhtcNumber}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Bill (optional)</InputLabel>
                <Select label="Bill (optional)" value={paymentForm.billId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, billId: e.target.value })}>
                  <MenuItem value="">General payment</MenuItem>
                  {bills.filter((b) => (b.balanceAmount as number) > 0).map((b) => (
                    <MenuItem key={String(b.id)} value={String(b.id)}>{String(b.billNo)} — {formatInr(b.balanceAmount as number)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Payment Date" type="date" InputLabelProps={{ shrink: true }}
              value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" label="Amount (₹)" value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Mode</InputLabel>
                <Select label="Payment Mode" value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}>
                  {OM_PAYMENT_MODES.map((m) => <MenuItem key={m.code} value={m.code}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Transaction Reference (optional)"
                value={paymentForm.transactionRef}
                onChange={(e) => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Collection Process</Typography>
              <BillingWorkflowTracker type="collection" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={billingDialogActionsSx}>
          <Button onClick={() => setPaymentOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordPayment}>Record Payment</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentDetailOpen} onClose={() => setPaymentDetailOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: billingDialogPaperSx }}>
        <BillingDialogHeader
          title="Payment Acknowledgement"
          subtitle={String(selectedPayment?.receiptNo ?? '')}
          phase="collection"
          busy={busy}
        />
        <DialogContent sx={billingDialogContentSx}>
          {selectedPayment && (() => {
            const ack = (selectedPayment.acknowledgement ?? {}) as Record<string, unknown>;
            const ledger = (selectedPayment.ledgerUpdate ?? {}) as Record<string, unknown>;
            const demand = (selectedPayment.demandAdjustment ?? {}) as Record<string, unknown>;
            const notification = (selectedPayment.notification ?? {}) as Record<string, unknown>;
            const activeStep = collectionWorkflowStepIndex(String(selectedPayment.workflowStep));
            return (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12}>
                  <Box display="flex" gap={0.75} flexWrap="wrap" alignItems="center" mb={1}>
                    {OM_COLLECTION_WORKFLOW.map((step, idx) => (
                      <Chip
                        key={step.step}
                        size="small"
                        label={step.label}
                        color={idx <= activeStep ? 'primary' : 'default'}
                        variant={idx <= activeStep ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Receipt Details</Typography>
                  <Typography variant="body2">Receipt No.: {String(selectedPayment.receiptNo ?? '—')}</Typography>
                  <Typography variant="body2">Date: {String(selectedPayment.paymentDate ?? '—')}</Typography>
                  <Typography variant="body2">Amount: {formatInr(Number(selectedPayment.amount ?? 0))}</Typography>
                  <Typography variant="body2">Mode: {String(selectedPayment.paymentModeLabel ?? selectedPayment.paymentMode ?? '—')}</Typography>
                  <Typography variant="body2">Transaction Ref: {String(selectedPayment.transactionRef ?? '—')}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Consumer</Typography>
                  <Typography variant="body2">Code: {String(selectedPayment.consumerCode ?? '—')}</Typography>
                  <Typography variant="body2">FHTC: {String(selectedPayment.fhtcNumber ?? '—')}</Typography>
                  <Typography variant="body2">Name: {String(selectedPayment.consumerName ?? '—')}</Typography>
                  <Typography variant="body2">Bill: {String(selectedPayment.billNo ?? ledger.billNo ?? 'General payment')}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Alert severity="success" sx={{ py: 0.5 }}>
                    {String(ack.message ?? `Payment acknowledgement for receipt ${String(selectedPayment.receiptNo ?? '')}`)}
                  </Alert>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Ledger Update</Typography>
                  {ledger.billNo ? (
                    <>
                      <Typography variant="body2">Bill: {String(ledger.billNo)}</Typography>
                      <Typography variant="body2">Balance: {formatInr(Number(ledger.balanceBefore ?? 0))} → {formatInr(Number(ledger.balanceAfter ?? 0))}</Typography>
                      <Typography variant="body2">Status: {String(ledger.billStatus ?? 'updated')}</Typography>
                    </>
                  ) : (
                    <Typography variant="body2">General payment recorded in collection ledger</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Demand Adjustment</Typography>
                  <Typography variant="body2">Applied: {formatInr(Number(demand.appliedAmount ?? selectedPayment.amount ?? 0))}</Typography>
                  {demand.balanceBefore != null && (
                    <Typography variant="body2">Bill balance: {formatInr(Number(demand.balanceBefore))} → {formatInr(Number(demand.balanceAfter ?? 0))}</Typography>
                  )}
                  <Typography variant="body2">{String(demand.note ?? 'Demand register updated')}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Consumer Notification</Typography>
                  <Chip
                    size="small"
                    label={String(notification.status ?? 'recorded')}
                    color={notification.status === 'sent' ? 'success' : notification.status === 'failed' ? 'warning' : 'default'}
                    variant="outlined"
                    sx={{ mr: 1 }}
                  />
                  {notification.destination != null && (
                    <Typography component="span" variant="body2" color="text.secondary">
                      {String(notification.destination)}
                      {notification.provider ? ` via ${String(notification.provider)}` : ''}
                    </Typography>
                  )}
                  {notification.note && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {String(notification.note)}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            );
          })()}
        </DialogContent>
        <DialogActions sx={billingDialogActionsSx}>
          <Button onClick={() => selectedPayment && openReceiptPrintView(selectedPayment)} startIcon={<DownloadOutlinedIcon />}>
            Print Receipt
          </Button>
          <Button onClick={() => setPaymentDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
