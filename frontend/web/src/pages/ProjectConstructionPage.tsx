import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, Grid, IconButton, LinearProgress, Link, List, ListItem,
  ListItemIcon, ListItemText, MenuItem, Stack, Tab, Tabs, TextField, Typography, Table, TableBody,
  TableCell, TableRow,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CancelIcon from '@mui/icons-material/Cancel';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { constructionApi, projectsApi, type SchemeType } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConstructionTableHead from '../components/construction/ConstructionTableHead';
import ConstructionStyledTableHead from '../components/construction/ConstructionStyledTableHead';
import {
  constructionSectionBarSx,
  constructionTableShellSx,
  constructionTableTheme,
  constructionWorkflowChipSx,
} from '../utils/constructionTableStyles';
import {
  buildDprPayload, defaultDprHeader, dprActivitySummary, DPR_UNITS,
  emptyDprActivityRow, type DprActivityRow, type DprHeaderForm,
} from '../utils/dprForm';
import DprPhotoGallery from '../components/construction/DprPhotoGallery';
import BoqReconciliationPanel from '../components/construction/BoqReconciliationPanel';
import RaBillPanel from '../components/construction/RaBillPanel';
import FinalBillPanel from '../components/construction/FinalBillPanel';
import ConstructionDashboardPanel from '../components/construction/ConstructionDashboardPanel';
import ConstructionReportsPanel from '../components/construction/ConstructionReportsPanel';
import PageShell from '../components/layout/PageShell';
import { canPerformOperational, hasOperationalRole, isSuperAdmin } from '../utils/operationalAccess';
import PageHeader from '../components/layout/PageHeader';
import { styledTabsSx } from '../utils/pagePresentationStyles';
import GisIntegrationPanel from '../components/construction/GisIntegrationPanel';
import BilingualRemarkField from '../components/forms/BilingualRemarkField';
import { EMPTY_BILINGUAL } from '../hooks/useBilingualRemark';
import { hasBilingualContent, serializeBilingualText, parseBilingualText, type BilingualText } from '../utils/bilingualText';
import {
  buildMbPayload, calcMbQuantity, defaultMbHeader, emptyMbEntryRow,
  mbEntrySummary, MB_UNITS, type MbEntryRow, type MbHeaderForm,
} from '../utils/mbForm';
import {
  aeChecksComplete, buildAeVerificationComments, buildEeVerificationComments,
  eeChecksComplete, type AeVerificationChecks, type EeVerificationChecks,
} from '../utils/mbVerification';
import { parseBoqExcel, type ParsedBoqRow } from '../utils/boqExcelImport';
import {
  BOQ_EXCEL_SECTION_LABELS, BOQ_EXCEL_SECTION_ORDER, BOQ_TABLE_COLUMNS, COMPONENT_LABELS,
  CONSTRUCTION_PIPELINE, DPR_WORKFLOW_SEQUENCE, dprWorkflowStepLabel, MB_WORKFLOW_SEQUENCE,
  mbPendingVerifier, mbWorkflowStepLabel,
  PROJECT_COMPONENT_ORDER, STATUS_APPROVER, STATUS_COLORS, WORKFLOW_DONE_STATUSES, WORKFLOW_STAGES,
  type ProjectComponent,
} from '../constants/construction';

type PendingBoqUpload = {
  file: File;
  fileName: string;
  rows: ParsedBoqRow[];
};

type PlanningFormState = {
  approvedDprUrl: string;
  adminApprovalRef: string;
  technicalSanctionRef: string;
  boqUploadUrl: string;
  l1ContractorBoqUploadUrl: string;
  contractorPoUploadUrl: string;
  drawingUploadUrl: string;
  gisAlignmentApproved: boolean;
};

function serializePlanningForm(form: PlanningFormState): string {
  return JSON.stringify(form);
}

function parsedBoqRowsToDisplayItems(rows: ParsedBoqRow[]): Array<Record<string, unknown>> {
  return rows.map((row, index) => ({
    id: `pending-${index}`,
    itemCode: row.itemCode,
    description: row.description,
    unit: row.unit,
    contractQty: row.contractQty,
    rate: row.rate,
    contractAmount: row.amount > 0
      ? row.amount
      : Math.round(row.contractQty * row.rate * 100) / 100,
    component: row.component ?? 'other',
    sortOrder: row.sortOrder,
  }));
}

function boqLineAmount(item: Record<string, unknown>): number {
  const stored = Number(item.contractAmount);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return Number(item.contractQty) * Number(item.rate);
}

function boqDisplaySerial(item: Record<string, unknown>, idx: number): string {
  const code = String(item.itemCode ?? '');
  const dash = code.lastIndexOf('-');
  if (dash >= 0 && dash < code.length - 1) {
    return code.slice(dash + 1);
  }
  return String(Number(item.sortOrder) || idx + 1);
}

function buildBoqSections(items: Array<Record<string, unknown>>) {
  const byComponent: Record<string, Array<Record<string, unknown>>> = {};
  for (const item of items) {
    const comp = String(item.component ?? 'other');
    if (!byComponent[comp]) byComponent[comp] = [];
    byComponent[comp].push(item);
  }
  for (const key of Object.keys(byComponent)) {
    byComponent[key].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  }

  const ordered: Array<{ key: string; label: string; sectionNumber: number; items: Array<Record<string, unknown>> }> = [];
  const used = new Set<string>();
  const addSection = (comp: string, sectionNumber: number) => {
    const sectionItems = byComponent[comp];
    if (!sectionItems?.length || used.has(comp)) return;
    used.add(comp);
    ordered.push({
      key: comp,
      label: BOQ_EXCEL_SECTION_LABELS[comp as ProjectComponent]
        ?? COMPONENT_LABELS[comp as ProjectComponent]
        ?? comp.replace(/_/g, ' '),
      sectionNumber,
      items: sectionItems,
    });
  };

  let n = 0;
  for (const comp of BOQ_EXCEL_SECTION_ORDER) {
    if (!byComponent[comp]?.length) continue;
    n += 1;
    addSection(comp, n);
  }
  for (const comp of PROJECT_COMPONENT_ORDER) {
    if (BOQ_EXCEL_SECTION_ORDER.includes(comp)) continue;
    if (!byComponent[comp]?.length) continue;
    n += 1;
    addSection(comp, n);
  }
  for (const [key, sectionItems] of Object.entries(byComponent)) {
    if (used.has(key) || !sectionItems.length) continue;
    n += 1;
    ordered.push({
      key,
      label: key === 'other' ? 'BOQ Items (from Excel)' : key.replace(/_/g, ' '),
      sectionNumber: n,
      items: sectionItems,
    });
  }
  return ordered;
}

function BoqTablesCard({
  title, items,
}: {
  title: string;
  items: Array<Record<string, unknown>>;
}) {
  const sections = useMemo(() => buildBoqSections(items), [items]);
  const grandTotal = useMemo(() => items.reduce((sum, item) => sum + boqLineAmount(item), 0), [items]);

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>{title}</Typography>
        {!items.length && (
          <Typography variant="body2" color="text.secondary">No items.</Typography>
        )}
        {sections.map((section) => {
          const sectionTotal = section.items.reduce((sum, item) => sum + boqLineAmount(item), 0);
          return (
            <Box key={section.key} mb={3}>
              <Typography
                variant="subtitle2" fontWeight={700}
                sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 2, py: 1, borderRadius: 1 }}
              >
                {section.sectionNumber}. {section.label}
              </Typography>
              <Table size="small" sx={{ mt: 0, ...constructionTableShellSx('boq') }}>
                <ConstructionStyledTableHead stage="boq">
                  {BOQ_TABLE_COLUMNS.map((col) => (
                    <TableCell
                      key={col}
                      align={col === 'QTY' || col.includes('Rate') || col.includes('Amount') ? 'right' : 'left'}
                    >
                      {col}
                    </TableCell>
                  ))}
                </ConstructionStyledTableHead>
                <TableBody>
                  {section.items.map((item, idx) => {
                    const qty = Number(item.contractQty);
                    const rate = Number(item.rate);
                    const amount = boqLineAmount(item);
                    return (
                      <TableRow key={String(item.id)} hover>
                        <TableCell>{boqDisplaySerial(item, idx)}</TableCell>
                        <TableCell>{String(item.description)}</TableCell>
                        <TableCell align="right">{qty.toLocaleString()}</TableCell>
                        <TableCell>{String(item.unit)}</TableCell>
                        <TableCell align="right">₹{rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell align="right">₹{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="body2" fontWeight={700}>Total Amount with Tax</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700}>
                        ₹{sectionTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          );
        })}
        {items.length > 0 && (
          <Box display="flex" justifyContent="flex-end" mt={1} px={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              Grand Total Amount with Tax: ₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

type TabKey = 'dashboard' | 'planning' | 'dpr' | 'mb' | 'reconciliation' | 'ra-bills' | 'final' | 'gis' | 'reports';

const CONSTRUCTION_TAB_KEYS = new Set<string>([
  'dashboard', 'planning', 'dpr', 'mb', 'reconciliation', 'ra-bills', 'final', 'gis', 'reports',
]);

function StatusChip({ status, label }: { status: string; label?: string }) {
  return (
    <Chip
      size="small"
      label={label ?? status.replace(/_/g, ' ')}
      color={STATUS_COLORS[status] ?? 'default'}
    />
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <Box mb={1.5}>
      <Box display="flex" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{value}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={Math.min(100, value)} sx={{ height: 8, borderRadius: 1 }} />
    </Box>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function planningUploadPath(kind: string, fileName: string) {
  return `/uploads/planning/${kind}/${fileName}`;
}

function UploadedFileLink({ fileName, file }: { fileName: string; file?: File | null }) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setDownloadUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setDownloadUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!fileName) return null;

  if (downloadUrl) {
    return (
      <Link
        href={downloadUrl}
        download={fileName}
        underline="hover"
        color="success.main"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.8125rem', fontWeight: 600 }}
      >
        <DownloadIcon sx={{ fontSize: 16 }} />
        {fileName}
      </Link>
    );
  }

  return <Chip size="small" color="success" variant="outlined" label={fileName} />;
}

function PlanningFileField({
  label, value, file, disabled, onPick,
}: {
  label: string; value: string; file?: File | null; disabled?: boolean;
  onPick: (file: File) => void;
}) {
  const fileName = value ? value.split('/').pop() ?? value : '';
  return (
    <Box>
      <Typography variant="body2" fontWeight={600} gutterBottom>{label}</Typography>
      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
        <Button variant="outlined" component="label" size="small" startIcon={<UploadFileIcon />} disabled={disabled}>
          Choose file
          <input
            hidden type="file" accept=".pdf,.xlsx,.xls,.dwg,.dxf,.zip,.png,.jpg,.jpeg"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) onPick(picked);
              e.target.value = '';
            }}
          />
        </Button>
        {fileName ? (
          <UploadedFileLink fileName={fileName} file={file} />
        ) : (
          <Typography variant="caption" color="text.secondary">No file selected</Typography>
        )}
      </Box>
    </Box>
  );
}

function BoqUploadField({
  label, fileName, file, disabled, importing, onUpload,
}: {
  label: string; fileName: string; file?: File | null; disabled?: boolean; importing?: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  return (
    <Box>
      <Typography variant="body2" fontWeight={600} gutterBottom>{label}</Typography>
      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
        <Button
          variant="outlined" component="label" size="small" startIcon={<UploadFileIcon />}
          disabled={disabled || importing}
        >
          {importing ? 'Importing…' : fileName ? 'Replace Excel file' : 'Choose Excel file'}
          <input
            hidden type="file" accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void onUpload(picked);
              e.target.value = '';
            }}
          />
        </Button>
        {fileName ? (
          <UploadedFileLink fileName={fileName} file={file} />
        ) : (
          <Typography variant="caption" color="text.secondary">No file imported yet</Typography>
        )}
        {fileName && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            You can replace the Excel file any time before Save Planning.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function GpsCaptureButton({
  disabled, loading, onCapture,
}: {
  disabled?: boolean; loading?: boolean; onCapture: () => void;
}) {
  return (
    <Button
      size="small" variant="outlined" startIcon={<MyLocationIcon />}
      disabled={disabled || loading} onClick={onCapture}
    >
      {loading ? 'Getting GPS…' : 'Capture GPS'}
    </Button>
  );
}

function DprPhotoPicker({
  photos, disabled, onAdd, onRemove,
}: {
  photos: File[]; disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
        <Button variant="outlined" component="label" size="small" startIcon={<PhotoCameraIcon />} disabled={disabled}>
          Add geo-tagged photos
          <input
            hidden type="file" accept="image/*" multiple capture="environment"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) onAdd(picked);
              e.target.value = '';
            }}
          />
        </Button>
        <Typography variant="caption" color="text.secondary">
          Site Engineer uploads photographs from site (camera/GPS enabled on mobile)
        </Typography>
      </Box>
      {photos.length > 0 && (
        <Box display="flex" flexDirection="column" gap={0.5} mt={1}>
          {photos.map((photo, idx) => (
            <Box key={`${photo.name}-${idx}`} display="flex" alignItems="center" gap={1}>
              <UploadedFileLink fileName={photo.name} file={photo} />
              {!disabled && (
                <IconButton size="small" color="error" onClick={() => onRemove(idx)} aria-label="Remove photo">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function ProjectConstructionPage() {
  const { projectId = '' } = useParams();
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const roles = user?.roles ?? [];

  const [tab, setTab] = useState<TabKey>('dashboard');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [boqImporting, setBoqImporting] = useState(false);
  const [boqFileName, setBoqFileName] = useState('');
  const [l1BoqImporting, setL1BoqImporting] = useState(false);
  const [l1BoqFileName, setL1BoqFileName] = useState('');
  const [planningLocalFiles, setPlanningLocalFiles] = useState<{
    dpr?: File;
    drawing?: File;
    boq?: File;
    l1Boq?: File;
    contractorPo?: File;
  }>({});
  const [pendingGovBoq, setPendingGovBoq] = useState<PendingBoqUpload | null>(null);
  const [pendingL1BoqUpload, setPendingL1BoqUpload] = useState<PendingBoqUpload | null>(null);
  const [savedPlanningSnapshot, setSavedPlanningSnapshot] = useState<string | null>(null);
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [boq, setBoq] = useState<Array<Record<string, unknown>>>([]);
  const [l1Boq, setL1Boq] = useState<Array<Record<string, unknown>>>([]);
  const billingBoq = useMemo(
    () => (l1Boq.length > 0 ? l1Boq : boq),
    [l1Boq, boq],
  );
  const ratesFromL1Boq = l1Boq.length > 0;
  const [dprs, setDprs] = useState<Array<Record<string, unknown>>>([]);
  const [mbs, setMbs] = useState<Array<Record<string, unknown>>>([]);
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [raBills, setRaBills] = useState<Array<Record<string, unknown>>>([]);
  const [workPackages, setWorkPackages] = useState<Array<Record<string, unknown>>>([]);
  const [workPlanning, setWorkPlanning] = useState<Record<string, unknown> | null>(null);
  const [reconciliation, setReconciliation] = useState<Record<string, unknown> | null>(null);
  const [completion, setCompletion] = useState<Record<string, unknown> | null>(null);

  const [dprDialog, setDprDialog] = useState(false);
  const [dprDetailOpen, setDprDetailOpen] = useState(false);
  const [dprDetail, setDprDetail] = useState<Record<string, unknown> | null>(null);
  const [editingDprId, setEditingDprId] = useState<string | null>(null);
  const [dprHeaderForm, setDprHeaderForm] = useState<DprHeaderForm>(defaultDprHeader());
  const [dprActivityRows, setDprActivityRows] = useState<DprActivityRow[]>([emptyDprActivityRow()]);
  const [dprPhotos, setDprPhotos] = useState<File[]>([]);
  const [gpsCapturingKey, setGpsCapturingKey] = useState<string | null>(null);
  const [mbDialog, setMbDialog] = useState(false);
  const [mbDetailOpen, setMbDetailOpen] = useState(false);
  const [mbDetail, setMbDetail] = useState<Record<string, unknown> | null>(null);
  const [editingMbId, setEditingMbId] = useState<string | null>(null);
  const [mbHeaderForm, setMbHeaderForm] = useState<MbHeaderForm>(defaultMbHeader());
  const [mbEntryRows, setMbEntryRows] = useState<MbEntryRow[]>([emptyMbEntryRow()]);
  const [mbPhotos, setMbPhotos] = useState<File[]>([]);
  const [mbGpsCapturingKey, setMbGpsCapturingKey] = useState<string | null>(null);
  const [mbVerifyDialog, setMbVerifyDialog] = useState<{ mbId: string; role: 'ae' | 'ee' } | null>(null);
  const [aeVerifyForm, setAeVerifyForm] = useState<AeVerificationChecks>({
    mbEntriesOk: false, siteConditionsOk: false, quantitiesOk: false, drawingsOk: false, comments: '',
  });
  const [eeVerifyForm, setEeVerifyForm] = useState<EeVerificationChecks>({
    technicalOk: false, quantityApprovalOk: false, financialOk: false, comments: '',
  });
  const [aeRemarks, setAeRemarks] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [eeRemarks, setEeRemarks] = useState<BilingualText>(EMPTY_BILINGUAL);
  const [wpDialog, setWpDialog] = useState(false);
  const [docDialog, setDocDialog] = useState<{ resourceType: string; resourceId: string } | null>(null);

  const [planningForm, setPlanningForm] = useState<PlanningFormState>({
    approvedDprUrl: '',
    adminApprovalRef: '',
    technicalSanctionRef: '',
    boqUploadUrl: '',
    l1ContractorBoqUploadUrl: '',
    contractorPoUploadUrl: '',
    drawingUploadUrl: '',
    gisAlignmentApproved: false,
  });
  const [wpForm, setWpForm] = useState({
    packageCode: '', name: '', component: 'gravity_main' as ProjectComponent,
    schemeType: 'gravity' as SchemeType, contractorName: '', chainageFrom: '', chainageTo: '',
  });
  const [contractorDrafts, setContractorDrafts] = useState<Record<string, string>>({});
  const [docForm, setDocForm] = useState({ docType: 'site_photo', fileName: '', fileUrl: '' });

  const displayGovBoq = useMemo(
    () => (pendingGovBoq ? parsedBoqRowsToDisplayItems(pendingGovBoq.rows) : boq),
    [pendingGovBoq, boq],
  );
  const displayL1Boq = useMemo(
    () => (pendingL1BoqUpload ? parsedBoqRowsToDisplayItems(pendingL1BoqUpload.rows) : l1Boq),
    [pendingL1BoqUpload, l1Boq],
  );

  const planningDirty = useMemo(() => {
    if (pendingGovBoq || pendingL1BoqUpload) return true;
    if (!savedPlanningSnapshot) return false;
    return serializePlanningForm(planningForm) !== savedPlanningSnapshot;
  }, [planningForm, pendingGovBoq, pendingL1BoqUpload, savedPlanningSnapshot]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!planningDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [planningDirty]);

  const planningDraftStorageKey = projectId ? `construction-planning-draft:${projectId}` : null;

  useEffect(() => {
    if (!planningDraftStorageKey || !planningDirty) {
      if (planningDraftStorageKey) sessionStorage.removeItem(planningDraftStorageKey);
      return;
    }
    sessionStorage.setItem(planningDraftStorageKey, JSON.stringify({
      planningForm,
      boqFileName,
      l1BoqFileName,
      hasPendingGovBoq: Boolean(pendingGovBoq),
      hasPendingL1Boq: Boolean(pendingL1BoqUpload),
    }));
  }, [
    planningDraftStorageKey, planningDirty, planningForm, boqFileName, l1BoqFileName,
    pendingGovBoq, pendingL1BoqUpload,
  ]);
  const canSubmit = !isSuperAdmin(roles) && (hasPermission('construction:submit') || roles.includes('contractor'));
  const canApprove = !isSuperAdmin(roles) && (hasPermission('construction:approve') || roles.some((r) => ['je', 'ae', 'ee', 'accounts'].includes(r)));
  const canMeasure = !isSuperAdmin(roles) && (hasPermission('construction:measure') || roles.includes('je') || roles.includes('contractor'));
  const canUpdate = canPerformOperational(roles, hasPermission, 'construction:update');
  const canCreate = canPerformOperational(roles, hasPermission, 'construction:create') || (!isSuperAdmin(roles) && roles.includes('ee'));
  const canCreateDpr = canCreate || (!isSuperAdmin(roles) && roles.includes('contractor'));
  const canCreateMb = canMeasure || (!isSuperAdmin(roles) && roles.includes('je'));
  const canAdminPlanning = hasOperationalRole(roles, ['se', 'ce', 'cgm', 'md', 'ee']);
  const canGenerateRa = !isSuperAdmin(roles) && roles.includes('contractor');

  const fetchOptional = async <T,>(request: Promise<{ data: T }>, fallback: T): Promise<T> => {
    try {
      const { data } = await request;
      return data;
    } catch {
      return fallback;
    }
  };

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [
        projectRes, overviewRes, boqRes, l1BoqRes, dprRes, mbRes, invRes,
        raData, wpData, planningData, reconData, completionData,
      ] = await Promise.all([
        projectsApi.get(projectId),
        constructionApi.overview(projectId),
        constructionApi.boq(projectId, { boqSource: 'government' }),
        fetchOptional(constructionApi.boq(projectId, { boqSource: 'l1_contractor' }), []),
        constructionApi.listDprs(projectId),
        constructionApi.listMbs(projectId),
        constructionApi.listInvoices(projectId),
        fetchOptional(constructionApi.listRaBills(projectId), []),
        fetchOptional(constructionApi.workPackages(projectId), []),
        fetchOptional(constructionApi.workPlanning(projectId), null),
        fetchOptional(constructionApi.boqReconciliation(projectId), null),
        fetchOptional(constructionApi.completion(projectId), null),
      ]);
      setProjectName(projectRes.data.name);
      setOverview(overviewRes.data);
      setBoq(boqRes.data);
      setL1Boq(l1BoqRes as Array<Record<string, unknown>>);
      setDprs(dprRes.data);
      setMbs(mbRes.data);
      setInvoices(invRes.data);
      setRaBills(raData as Array<Record<string, unknown>>);
      setWorkPackages(wpData as Array<Record<string, unknown>>);
      setWorkPlanning(planningData as Record<string, unknown> | null);
      setPlanningLocalFiles({});
      setReconciliation(reconData as Record<string, unknown> | null);
      setCompletion(completionData as Record<string, unknown> | null);
      if (planningData) {
        const pd = planningData as Record<string, unknown>;
        const uploadUrl = String(pd.boqUploadUrl ?? '');
        const l1UploadUrl = String(pd.l1ContractorBoqUploadUrl ?? '');
        const loadedForm: PlanningFormState = {
          approvedDprUrl: String(pd.approvedDprUrl ?? ''),
          adminApprovalRef: String(pd.adminApprovalRef ?? ''),
          technicalSanctionRef: String(pd.technicalSanctionRef ?? ''),
          boqUploadUrl: uploadUrl,
          l1ContractorBoqUploadUrl: l1UploadUrl,
          contractorPoUploadUrl: String(pd.contractorPoUploadUrl ?? ''),
          drawingUploadUrl: String(pd.drawingUploadUrl ?? ''),
          gisAlignmentApproved: Boolean(pd.gisAlignmentApproved),
        };
        setPlanningForm(loadedForm);
        setSavedPlanningSnapshot(serializePlanningForm(loadedForm));
        setBoqFileName(uploadUrl ? uploadUrl.split('/').pop() ?? '' : '');
        setL1BoqFileName(l1UploadUrl ? l1UploadUrl.split('/').pop() ?? '' : '');
      } else {
        setSavedPlanningSnapshot(serializePlanningForm(planningForm));
      }

      const draftKey = `construction-planning-draft:${projectId}`;
      const draftRaw = sessionStorage.getItem(draftKey);
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw) as {
            planningForm?: PlanningFormState;
            boqFileName?: string;
            l1BoqFileName?: string;
            hasPendingGovBoq?: boolean;
            hasPendingL1Boq?: boolean;
          };
          if (draft.planningForm) {
            setPlanningForm(draft.planningForm);
          }
          if (draft.boqFileName) setBoqFileName(draft.boqFileName);
          if (draft.l1BoqFileName) setL1BoqFileName(draft.l1BoqFileName);
          if (draft.hasPendingGovBoq || draft.hasPendingL1Boq) {
            setSuccess('Unsaved planning draft restored. Re-select BOQ Excel file(s) to replace staged imports, then click Save Planning.');
          }
        } catch {
          sessionStorage.removeItem(draftKey);
        }
      }
      const wpList = wpData as Array<Record<string, unknown>>;
      setContractorDrafts(Object.fromEntries(
        wpList.map((wp) => [String(wp.id), String(wp.contractorName ?? '')]),
      ));
    } catch (err) {
      setError(formatApiError(err, 'Failed to load construction data. Run migrations 012 & 013 and restart API.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const applyConstructionTab = (tabKey: string) => {
      if (CONSTRUCTION_TAB_KEYS.has(tabKey)) setTab(tabKey as TabKey);
    };
    const stateTab = (location.state as { constructionTab?: string } | null)?.constructionTab;
    if (stateTab) applyConstructionTab(stateTab);
    const hash = window.location.hash.replace('#', '');
    if (hash) applyConstructionTab(hash);
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '');
      if (h) applyConstructionTab(h);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [location.state]);

  const planningChecklist = useMemo(() => {
    const hasBoqData = boq.length > 0 && !pendingGovBoq;
    const hasL1BoqData = l1Boq.length > 0 && !pendingL1BoqUpload;
    const packagesAssigned = workPackages.length > 0
      && workPackages.every((wp) => String(contractorDrafts[String(wp.id)] ?? wp.contractorName ?? '').trim());
    return [
      { key: 'dpr', label: 'Approved DPR Upload', done: Boolean(planningForm.approvedDprUrl) },
      { key: 'admin', label: 'Administrative Approval', done: Boolean(planningForm.adminApprovalRef.trim()) },
      { key: 'ts', label: 'Technical Sanction', done: Boolean(planningForm.technicalSanctionRef.trim()) },
      { key: 'boq', label: 'BOQ Upload', done: hasBoqData },
      { key: 'l1Boq', label: 'L1 Contractor BOQ', done: hasL1BoqData },
      { key: 'contractorPo', label: 'Contractor PO/WO Upload', done: Boolean(planningForm.contractorPoUploadUrl) },
      { key: 'drawing', label: 'Drawing Upload', done: Boolean(planningForm.drawingUploadUrl) },
      { key: 'wp', label: 'Work Package Creation', done: workPackages.length > 0 },
      { key: 'contractor', label: 'Contractor Assignment', done: packagesAssigned },
      { key: 'gis', label: 'GIS Alignment Approval', done: planningForm.gisAlignmentApproved },
    ];
  }, [planningForm, boq.length, l1Boq.length, workPackages, contractorDrafts, pendingGovBoq, pendingL1BoqUpload]);

  const submitWorkflow = async (fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(formatApiError(err, `Failed to ${label}. Ensure migration 012 is applied and API is restarted.`));
    }
  };

  const workflowAction = async (
    type: 'dpr' | 'mb' | 'invoice' | 'ra',
    id: string,
    action: 'approve' | 'reject',
    comments?: string,
  ) => {
    try {
      const payload = { action, comments };
      if (type === 'dpr') await constructionApi.dprWorkflow(projectId, id, payload);
      if (type === 'mb') await constructionApi.mbWorkflow(projectId, id, payload);
      if (type === 'invoice') await constructionApi.invoiceWorkflow(projectId, id, payload);
      if (type === 'ra') await constructionApi.raBillWorkflow(projectId, id, payload);
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Workflow action failed.'));
    }
  };

  const openMbVerify = async (mbId: string, role: 'ae' | 'ee') => {
    setMbVerifyDialog({ mbId, role });
    setAeVerifyForm({ mbEntriesOk: false, siteConditionsOk: false, quantitiesOk: false, drawingsOk: false, comments: '' });
    setEeVerifyForm({ technicalOk: false, quantityApprovalOk: false, financialOk: false, comments: '' });
    setAeRemarks(EMPTY_BILINGUAL);
    setEeRemarks(EMPTY_BILINGUAL);
    try {
      const { data } = await constructionApi.getMb(projectId, mbId);
      setMbDetail(data as Record<string, unknown>);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load MB for verification.'));
    }
  };

  const submitMbVerification = async (action: 'approve' | 'reject') => {
    if (!mbVerifyDialog) return;
    const { mbId, role } = mbVerifyDialog;
    let comments = '';
    if (action === 'approve') {
      if (role === 'ae') {
        if (!aeChecksComplete(aeVerifyForm)) {
          setError('Complete all AE verification checks before approving.');
          return;
        }
        comments = buildAeVerificationComments({
          ...aeVerifyForm,
          comments: serializeBilingualText(aeRemarks),
        });
      } else {
        if (!eeChecksComplete(eeVerifyForm)) {
          setError('Complete all EE approval checks before approving.');
          return;
        }
        comments = buildEeVerificationComments({
          ...eeVerifyForm,
          comments: serializeBilingualText(eeRemarks),
        });
      }
    } else {
      const rejectRemarks = role === 'ae' ? aeRemarks : eeRemarks;
      comments = serializeBilingualText(rejectRemarks);
      if (!hasBilingualContent(rejectRemarks)) {
        setError('Provide rejection remarks.');
        return;
      }
    }
    try {
      await constructionApi.mbWorkflow(projectId, mbId, { action, comments });
      setMbVerifyDialog(null);
      setMbDetailOpen(false);
      setSuccess(action === 'approve' ? 'MB verification approved.' : 'MB rejected.');
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Verification action failed.'));
    }
  };

  const MbVerifyActions = ({ mbId, status }: { mbId: string; status: string }) => {
    const verifier = mbPendingVerifier(status);
    if (!verifier) return null;
    const canAct = !roles.includes('super_admin') && roles.includes(verifier);
    if (!canAct) return null;
    return (
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="nowrap">
        <Button size="small" variant="contained" color="primary"
          onClick={() => { void openMbVerify(mbId, verifier); }}>
          {verifier === 'ae' ? 'AE Verify' : 'EE Verify'}
        </Button>
      </Stack>
    );
  };

  const ApprovalButtons = ({ type, id, status }: { type: 'dpr' | 'mb' | 'invoice' | 'ra'; id: string; status: string }) => {
    if (WORKFLOW_DONE_STATUSES.includes(status)) return null;
    const requiredRole = STATUS_APPROVER[status];
    const canAct = !roles.includes('super_admin') && (!requiredRole || roles.includes(requiredRole));
    if (!canApprove || !canAct) return null;
    return (
      <Box display="inline-flex" gap={0.5} alignItems="center">
        {requiredRole && (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>{requiredRole.toUpperCase()}</Typography>
        )}
        <IconButton size="small" color="success" title="Approve" onClick={() => { void workflowAction(type, id, 'approve'); }}>
          <CheckCircleIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" title="Reject" onClick={() => { void workflowAction(type, id, 'reject'); }}>
          <CancelIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  };

  const resetDprForm = () => {
    setEditingDprId(null);
    setDprHeaderForm(defaultDprHeader());
    setDprActivityRows([emptyDprActivityRow()]);
    setDprPhotos([]);
    setGpsCapturingKey(null);
  };

  const openNewDprDialog = () => {
    resetDprForm();
    const header = defaultDprHeader();
    if (roles.includes('contractor') && user) {
      header.contractorName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    }
    setDprHeaderForm(header);
    setDprDialog(true);
  };

  const loadDprForEdit = async (id: string) => {
    try {
      const { data } = await constructionApi.getDpr(projectId, id);
      const d = data as Record<string, unknown>;
      setEditingDprId(id);
      setDprHeaderForm({
        dprNumber: String(d.dprNumber ?? ''),
        reportDate: String(d.reportDate ?? todayIso()).slice(0, 10),
        schemeType: (d.schemeType as SchemeType) ?? 'gravity',
        workLocation: String(d.workSite ?? ''),
        weather: String(d.weather ?? 'Clear'),
        manpowerCount: Number(d.manpowerCount ?? 0),
        contractorName: String(d.contractorName ?? ''),
        supervisorName: String(d.supervisorName ?? ''),
        workPackageId: String(d.workPackageId ?? ''),
        remarks: String(d.remarks ?? ''),
      });
      const acts = (d.activities as Array<Record<string, unknown>>) ?? [];
      setDprActivityRows(acts.length ? acts.map((act) => ({
        key: emptyDprActivityRow().key,
        description: String(act.description ?? ''),
        unit: String(act.unit ?? 'cum'),
        quantityDone: Number(act.quantityDone ?? 0),
        boqItemId: String(act.boqItemId ?? ''),
        component: (act.component as ProjectComponent) ?? '',
        chainageFrom: String(act.chainageFrom ?? ''),
        chainageTo: String(act.chainageTo ?? ''),
        latitude: act.latitude != null ? String(act.latitude) : '',
        longitude: act.longitude != null ? String(act.longitude) : '',
        locationDetail: String(act.siteDetail ?? ''),
        materialConsumption: String(act.materialConsumption ?? ''),
        labourCount: Number(act.labourCount ?? 0),
        equipmentDetails: String(act.equipmentDetails ?? ''),
      })) : [emptyDprActivityRow()]);
      setDprPhotos([]);
      setDprDialog(true);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load DPR for editing.'));
    }
  };

  const viewDprDetail = async (id: string) => {
    try {
      const { data } = await constructionApi.getDpr(projectId, id);
      setDprDetail(data as Record<string, unknown>);
      setDprDetailOpen(true);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load DPR details.'));
    }
  };

  const captureActivityGps = (rowKey: string) => {
    if (!navigator.geolocation) {
      setError('GPS is not available in this browser.');
      return;
    }
    setGpsCapturingKey(rowKey);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDprActivityRows((rows) => rows.map((row) => (
          row.key === rowKey
            ? {
              ...row,
              latitude: pos.coords.latitude.toFixed(6),
              longitude: pos.coords.longitude.toFixed(6),
            }
            : row
        )));
        setGpsCapturingKey(null);
        setSuccess('GPS coordinates captured.');
      },
      (err) => {
        setGpsCapturingKey(null);
        setError(err.message || 'Failed to capture GPS coordinates.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const uploadDprPhotos = async (dprId: string) => {
    for (const photo of dprPhotos) {
      const form = new FormData();
      form.append('file', photo);
      form.append('resourceType', 'dpr');
      form.append('resourceId', dprId);
      form.append('docType', 'site_photo');
      await constructionApi.uploadDocumentFile(projectId, form);
    }
  };

  const updateDprActivityRow = (rowKey: string, patch: Partial<DprActivityRow>) => {
    setDprActivityRows((rows) => rows.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)));
  };

  const handleSaveDpr = async () => {
    const payload = buildDprPayload(dprHeaderForm, dprActivityRows);
    if (!payload.dprNumber.trim()) {
      setError('DPR number is required.');
      return;
    }
    if (!payload.activities.length) {
      setError('Add at least one work item with a description.');
      return;
    }
    try {
      const { data } = editingDprId
        ? await constructionApi.updateDpr(projectId, editingDprId, payload)
        : await constructionApi.createDpr(projectId, payload);
      const dprId = String((data as Record<string, unknown>).id);
      if (dprPhotos.length) {
        await uploadDprPhotos(dprId);
      }
      setDprDialog(false);
      resetDprForm();
      setSuccess(editingDprId ? 'DPR updated.' : 'Daily progress report saved.');
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to save DPR.'));
    }
  };

  const handleCreateMb = async () => {
    const payload = buildMbPayload(mbHeaderForm, mbEntryRows);
    if (!payload.mbNumber.trim()) {
      setError('MB number is required.');
      return;
    }
    if (!payload.entries.length) {
      setError('Add at least one work item measurement.');
      return;
    }
    try {
      const { data } = editingMbId
        ? await constructionApi.updateMb(projectId, editingMbId, payload)
        : await constructionApi.createMb(projectId, payload);
      const mbId = String((data as Record<string, unknown>).id);
      if (mbPhotos.length) {
        for (const photo of mbPhotos) {
          const form = new FormData();
          form.append('file', photo);
          form.append('resourceType', 'measurement_book');
          form.append('resourceId', mbId);
          form.append('docType', 'site_photo');
          await constructionApi.uploadDocumentFile(projectId, form);
        }
      }
      setMbDialog(false);
      resetMbForm();
      setSuccess(editingMbId ? 'Measurement book updated.' : 'Measurement book saved.');
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to save measurement book.'));
    }
  };

  const resetMbForm = () => {
    setEditingMbId(null);
    setMbHeaderForm(defaultMbHeader());
    setMbEntryRows([emptyMbEntryRow()]);
    setMbPhotos([]);
    setMbGpsCapturingKey(null);
  };

  const openNewMbDialog = () => {
    resetMbForm();
    setMbDialog(true);
  };

  const loadMbForEdit = async (id: string) => {
    try {
      const { data } = await constructionApi.getMb(projectId, id);
      const m = data as Record<string, unknown>;
      setEditingMbId(id);
      setMbHeaderForm({
        mbNumber: String(m.mbNumber ?? ''),
        measurementDate: String(m.measurementDate ?? todayIso()).slice(0, 10),
        schemeType: (m.schemeType as SchemeType) ?? 'gravity',
        siteLocation: String(m.siteAddress ?? ''),
        workPackageId: String(m.workPackageId ?? ''),
        dprId: String(m.dprId ?? ''),
        remarks: String(m.remarks ?? ''),
        qualityVerification: '',
        materialVerification: '',
      });
      const entries = (m.entries as Array<Record<string, unknown>>) ?? [];
      setMbEntryRows(entries.length ? entries.map((e) => ({
        key: emptyMbEntryRow().key,
        description: String(e.description ?? ''),
        unit: String(e.unit ?? 'cum'),
        measuredQty: Number(e.measuredQty ?? 0),
        rate: Number(e.rate ?? 0),
        boqItemId: String(e.boqItemId ?? ''),
        chainageFrom: String(e.chainageFrom ?? ''),
        chainageTo: String(e.chainageTo ?? ''),
        lengthM: e.lengthM != null ? String(e.lengthM) : '',
        widthM: e.widthM != null ? String(e.widthM) : '',
        depthM: e.depthM != null ? String(e.depthM) : '',
        latitude: e.latitude != null ? String(e.latitude) : '',
        longitude: e.longitude != null ? String(e.longitude) : '',
      })) : [emptyMbEntryRow()]);
      setMbPhotos([]);
      setMbDialog(true);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load MB for editing.'));
    }
  };

  const viewMbDetail = async (id: string) => {
    try {
      const { data } = await constructionApi.getMb(projectId, id);
      setMbDetail(data as Record<string, unknown>);
      setMbDetailOpen(true);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load MB details.'));
    }
  };

  const captureMbEntryGps = (rowKey: string) => {
    if (!navigator.geolocation) {
      setError('GPS is not available in this browser.');
      return;
    }
    setMbGpsCapturingKey(rowKey);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMbEntryRows((rows) => rows.map((row) => (
          row.key === rowKey
            ? { ...row, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }
            : row
        )));
        setMbGpsCapturingKey(null);
        setSuccess('GPS coordinates captured for verification.');
      },
      (err) => {
        setMbGpsCapturingKey(null);
        setError(err.message || 'Failed to capture GPS.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const updateMbEntryRow = (rowKey: string, patch: Partial<MbEntryRow>) => {
    setMbEntryRows((rows) => rows.map((row) => {
      if (row.key !== rowKey) return row;
      const next = { ...row, ...patch };
      if ('lengthM' in patch || 'widthM' in patch || 'depthM' in patch) {
        next.measuredQty = calcMbQuantity(next);
      }
      return next;
    }));
  };

  const handleBoqUpload = async (file: File) => {
    setBoqFileName(file.name);
    setPlanningLocalFiles((prev) => ({ ...prev, boq: file }));
    setBoqImporting(true);
    setError('');
    setSuccess('');
    try {
      const rows = await parseBoqExcel(file);
      if (!rows.length) {
        throw new Error('No BOQ rows found — check Excel columns: SN, Item Description, QTY, Unit, Rate with GST, Total Amount with Tax.');
      }
      setPendingGovBoq({ file, fileName: file.name, rows });
      setPlanningForm((prev) => ({
        ...prev,
        boqUploadUrl: planningUploadPath('boq', file.name),
      }));
      setSuccess(`Parsed ${rows.length} BOQ line(s) from ${file.name}. Preview below — click Save Planning to persist.`);
    } catch (err) {
      const savedForm = savedPlanningSnapshot
        ? JSON.parse(savedPlanningSnapshot) as PlanningFormState
        : null;
      setBoqFileName(savedForm?.boqUploadUrl ? savedForm.boqUploadUrl.split('/').pop() ?? '' : '');
      setPendingGovBoq(null);
      setPlanningLocalFiles((prev) => ({ ...prev, boq: undefined }));
      setError(formatApiError(err, 'Failed to parse BOQ Excel. Check columns: SN, Item Description, QTY, Unit, Rate with GST, Total Amount with Tax.'));
    } finally {
      setBoqImporting(false);
    }
  };

  const handleL1BoqUpload = async (file: File) => {
    setL1BoqFileName(file.name);
    setPlanningLocalFiles((prev) => ({ ...prev, l1Boq: file }));
    setL1BoqImporting(true);
    setError('');
    setSuccess('');
    try {
      const rows = await parseBoqExcel(file);
      if (!rows.length) {
        throw new Error('No BOQ rows found — check Excel columns.');
      }
      setPendingL1BoqUpload({ file, fileName: file.name, rows });
      setPlanningForm((prev) => ({
        ...prev,
        l1ContractorBoqUploadUrl: planningUploadPath('boq-l1', file.name),
      }));
      setSuccess(`Parsed ${rows.length} L1 Contractor BOQ line(s). Preview below — click Save Planning to persist.`);
    } catch (err) {
      const savedForm = savedPlanningSnapshot
        ? JSON.parse(savedPlanningSnapshot) as PlanningFormState
        : null;
      setL1BoqFileName(savedForm?.l1ContractorBoqUploadUrl ? savedForm.l1ContractorBoqUploadUrl.split('/').pop() ?? '' : '');
      setPendingL1BoqUpload(null);
      setPlanningLocalFiles((prev) => ({ ...prev, l1Boq: undefined }));
      setError(formatApiError(err, 'Failed to parse L1 Contractor BOQ Excel.'));
    } finally {
      setL1BoqImporting(false);
    }
  };

  const handleSavePlanning = async () => {
    try {
      let nextForm: PlanningFormState = { ...planningForm };

      if (pendingGovBoq) {
        const { data } = await constructionApi.uploadBoqExcel(projectId, pendingGovBoq.file);
        const savedName = String(data.fileName ?? pendingGovBoq.fileName);
        nextForm = {
          ...nextForm,
          boqUploadUrl: planningUploadPath('boq', savedName),
        };
        setBoqFileName(savedName);
      }
      if (pendingL1BoqUpload) {
        const { data } = await constructionApi.uploadBoqExcel(projectId, pendingL1BoqUpload.file, 'l1_contractor');
        const savedName = String(data.fileName ?? pendingL1BoqUpload.fileName);
        nextForm = {
          ...nextForm,
          l1ContractorBoqUploadUrl: planningUploadPath('boq-l1', savedName),
        };
        setL1BoqFileName(savedName);
      }

      const willHaveBoq = Boolean(pendingGovBoq) || boq.length > 0;
      const willHaveL1Boq = Boolean(pendingL1BoqUpload) || l1Boq.length > 0;
      const packagesAssigned = workPackages.length > 0
        && workPackages.every((wp) => String(contractorDrafts[String(wp.id)] ?? wp.contractorName ?? '').trim());
      const willBeComplete = Boolean(nextForm.approvedDprUrl)
        && Boolean(nextForm.adminApprovalRef.trim())
        && Boolean(nextForm.technicalSanctionRef.trim())
        && willHaveBoq
        && willHaveL1Boq
        && Boolean(nextForm.contractorPoUploadUrl)
        && Boolean(nextForm.drawingUploadUrl)
        && workPackages.length > 0
        && packagesAssigned
        && nextForm.gisAlignmentApproved;

      await constructionApi.updateWorkPlanning(projectId, {
        ...nextForm,
        status: willBeComplete ? 'approved' : 'draft',
      });
      setPlanningForm(nextForm);
      setPendingGovBoq(null);
      setPendingL1BoqUpload(null);
      if (planningDraftStorageKey) sessionStorage.removeItem(planningDraftStorageKey);
      setSuccess('Work planning saved.');
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to save work planning.'));
    }
  };

  const handleCreateWorkPackage = async () => {
    try {
      await constructionApi.createWorkPackage(projectId, wpForm);
      setWpDialog(false);
      setWpForm({
        packageCode: '', name: '', component: 'gravity_main',
        schemeType: 'gravity', contractorName: '', chainageFrom: '', chainageTo: '',
      });
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to create work package.'));
    }
  };

  const handleAssignContractor = async (wpId: string) => {
    const contractorName = contractorDrafts[wpId]?.trim();
    if (!contractorName) return;
    try {
      await constructionApi.updateWorkPackage(projectId, wpId, { contractorName });
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to assign contractor.'));
    }
  };

  const handleGisPackageApproval = async (wpId: string, approved: boolean) => {
    try {
      await constructionApi.updateWorkPackage(projectId, wpId, {
        gisAlignmentStatus: approved ? 'approved' : 'pending',
      });
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to update GIS alignment.'));
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Construction Lifecycle"
        title="Water Supply Construction — Gravity & Pumping"
        subtitle={`${projectName} · Source → Pipeline → Reservoir → Distribution → FHTC`}
        accent="amber"
        leading={(
          <IconButton component={RouterLink} to="/projects" size="small" sx={{ mt: 0.25 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={styledTabsSx()}>
        <Tab value="dashboard" label="Dashboard" />
        <Tab value="planning" label="Work Planning" />
        <Tab value="dpr" label="Daily Progress" />
        <Tab value="mb" label="Measurement Book" />
        <Tab value="reconciliation" label="BOQ Reconciliation" />
        <Tab value="ra-bills" label="RA Bills" />
        <Tab value="final" label="Final Bill" />
        <Tab value="gis" label="GIS Assets" />
        <Tab value="reports" label="Reports" />
      </Tabs>

      {tab === 'dashboard' && (
        <ConstructionDashboardPanel projectId={projectId} onError={setError} />
      )}

      {tab === 'planning' && (
        <Grid container spacing={2}>
          {planningDirty && (
            <Grid item xs={12}>
              <Alert severity="warning">
                Unsaved work planning changes
                {pendingGovBoq || pendingL1BoqUpload ? ' (including BOQ Excel)' : ''}.
                BOQ upload stays available until you click Save Planning.
              </Alert>
            </Grid>
          )}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight={700}>Stage 1: Work Planning</Typography>
                  <StatusChip status={String(workPlanning?.status ?? 'draft')} />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(planningChecklist.filter((i) => i.done).length / planningChecklist.length) * 100}
                  sx={{ height: 8, borderRadius: 1, mb: 2 }}
                />
                <List dense disablePadding>
                  {planningChecklist.map((item) => (
                    <ListItem key={item.key} disableGutters sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {item.done
                          ? <CheckCircleOutlineIcon color="success" fontSize="small" />
                          : <RadioButtonUncheckedIcon color="disabled" fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ variant: 'body2', color: item.done ? 'text.primary' : 'text.secondary' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ height: 'auto', overflow: 'visible' }}>
              <CardContent sx={{ overflow: 'visible' }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Approvals & Document Uploads</Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <PlanningFileField
                    label="1. Approved DPR Upload"
                    value={planningForm.approvedDprUrl}
                    file={planningLocalFiles.dpr}
                    disabled={!canAdminPlanning}
                    onPick={(file) => {
                      setPlanningLocalFiles((prev) => ({ ...prev, dpr: file }));
                      setPlanningForm({
                        ...planningForm,
                        approvedDprUrl: planningUploadPath('dpr', file.name),
                      });
                    }}
                  />
                  <TextField
                    label="2. Administrative Approval Ref"
                    placeholder="e.g. ADM/2024/WS-001"
                    value={planningForm.adminApprovalRef}
                    onChange={(e) => setPlanningForm({ ...planningForm, adminApprovalRef: e.target.value })}
                    disabled={!canAdminPlanning}
                  />
                  <TextField
                    label="3. Technical Sanction Ref"
                    placeholder="e.g. TS/EE/2024/045"
                    value={planningForm.technicalSanctionRef}
                    onChange={(e) => setPlanningForm({ ...planningForm, technicalSanctionRef: e.target.value })}
                    disabled={!canAdminPlanning}
                  />
                  <BoqUploadField
                    label="4. BOQ Upload (Excel) — Original / Tender BOQ"
                    fileName={boqFileName}
                    file={planningLocalFiles.boq}
                    disabled={!canAdminPlanning}
                    importing={boqImporting}
                    onUpload={handleBoqUpload}
                  />
                  <BoqUploadField
                    label="5. L1 Contractor BOQ (Excel)"
                    fileName={l1BoqFileName}
                    file={planningLocalFiles.l1Boq}
                    disabled={!canAdminPlanning}
                    importing={l1BoqImporting}
                    onUpload={handleL1BoqUpload}
                  />
                  <PlanningFileField
                    label="6. Contractor PO/WO Upload"
                    value={planningForm.contractorPoUploadUrl}
                    file={planningLocalFiles.contractorPo}
                    disabled={!canAdminPlanning}
                    onPick={(file) => {
                      setPlanningLocalFiles((prev) => ({ ...prev, contractorPo: file }));
                      setPlanningForm({
                        ...planningForm,
                        contractorPoUploadUrl: planningUploadPath('contractor-po', file.name),
                      });
                    }}
                  />
                  <PlanningFileField
                    label="7. Drawing Upload"
                    value={planningForm.drawingUploadUrl}
                    file={planningLocalFiles.drawing}
                    disabled={!canAdminPlanning}
                    onPick={(file) => {
                      setPlanningLocalFiles((prev) => ({ ...prev, drawing: file }));
                      setPlanningForm({
                        ...planningForm,
                        drawingUploadUrl: planningUploadPath('drawings', file.name),
                      });
                    }}
                  />
                  <TextField
                    select label="8. GIS Alignment Approval (Project-wide)"
                    value={planningForm.gisAlignmentApproved ? 'yes' : 'no'}
                    onChange={(e) => setPlanningForm({
                      ...planningForm,
                      gisAlignmentApproved: e.target.value === 'yes',
                    })}
                    disabled={!canAdminPlanning}
                  >
                    <MenuItem value="yes">Approved</MenuItem>
                    <MenuItem value="no">Pending</MenuItem>
                  </TextField>
                  {canAdminPlanning && (
                    <Button variant="contained" onClick={() => { void handleSavePlanning(); }}>
                      Save Planning
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ height: 'auto', overflow: 'visible' }}>
              <CardContent sx={{ overflow: 'visible' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight={700}>6. Work Packages & 7. Contractor Assignment</Typography>
                  {canAdminPlanning && (
                    <Button startIcon={<AddIcon />} size="small" variant="outlined" onClick={() => setWpDialog(true)}>
                      New Package
                    </Button>
                  )}
                </Box>
                <Table size="small" sx={constructionTableShellSx('planning')}>
                  <ConstructionTableHead
                    stage="planning"
                    columns={[
                      { label: 'Code' },
                      { label: 'Component' },
                      { label: 'Chainage' },
                      { label: 'Contractor' },
                      { label: 'GIS' },
                      { label: 'Status' },
                    ]}
                  />
                  <TableBody>
                    {workPackages.map((wp) => {
                      const wpId = String(wp.id);
                      return (
                        <TableRow key={wpId}>
                          <TableCell>{String(wp.packageCode)}</TableCell>
                          <TableCell>{COMPONENT_LABELS[wp.component as ProjectComponent] ?? String(wp.component)}</TableCell>
                          <TableCell>{String(wp.chainageFrom ?? '—')} – {String(wp.chainageTo ?? '—')}</TableCell>
                          <TableCell>
                            <Box display="flex" gap={0.5} alignItems="center">
                              <TextField
                                size="small" placeholder="Contractor name"
                                value={contractorDrafts[wpId] ?? ''}
                                onChange={(e) => setContractorDrafts({ ...contractorDrafts, [wpId]: e.target.value })}
                                disabled={!canAdminPlanning}
                                sx={{ minWidth: 140 }}
                              />
                              {canAdminPlanning && (
                                <Button size="small" onClick={() => { void handleAssignContractor(wpId); }}>Save</Button>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={String(wp.gisAlignmentStatus ?? 'pending')}
                              color={wp.gisAlignmentStatus === 'approved' ? 'success' : 'default'}
                              onClick={canAdminPlanning ? () => { void handleGisPackageApproval(wpId, wp.gisAlignmentStatus !== 'approved'); } : undefined}
                              sx={canAdminPlanning ? { cursor: 'pointer' } : undefined}
                            />
                          </TableCell>
                          <TableCell><StatusChip status={String(wp.status)} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {!workPackages.length && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No work packages yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <BoqTablesCard
              title="Original / Tender BOQ by Project Component"
              items={displayGovBoq}
            />
            <BoqTablesCard
              title="L1 Contractor BOQ"
              items={displayL1Boq}
            />
          </Grid>
        </Grid>
      )}

      {tab === 'dpr' && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} gap={2} sx={constructionSectionBarSx('dpr')}>
            <Typography variant="subtitle1" fontWeight={700} color={constructionTableTheme('dpr').headerColor}>
              Stage 2: Daily Construction Activity
            </Typography>
            {canCreateDpr && (
              <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={openNewDprDialog}>
                New DPR
              </Button>
            )}
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
            {DPR_WORKFLOW_SEQUENCE.map((step) => (
              <Chip
                key={step.status}
                size="small"
                variant="outlined"
                label={`${step.step}. ${step.label}`}
                sx={constructionWorkflowChipSx('dpr')}
              />
            ))}
          </Box>
          <Table size="small" sx={constructionTableShellSx('dpr')}>
            <ConstructionTableHead
              stage="dpr"
              columns={[
                { label: 'DPR #' },
                { label: 'Date' },
                { label: 'Location' },
                { label: 'Chainage' },
                { label: 'Work Item' },
                { label: 'Qty Executed' },
                { label: 'Contractor' },
                { label: 'Supervisor' },
                { label: 'Workflow Step', minWidth: 130 },
                { label: 'Actions', minWidth: 280 },
              ]}
            />
            <TableBody>
              {dprs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10}>
                    <Typography variant="body2" color="text.secondary">
                      No daily progress reports yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {dprs.map((dpr) => {
                const summary = dprActivitySummary(dpr);
                const status = String(dpr.status);
                const isEditable = status === 'draft' || status === 'rejected';
                const dprId = String(dpr.id);
                return (
                  <TableRow key={dprId}>
                    <TableCell>{String(dpr.dprNumber)}</TableCell>
                    <TableCell>{String(dpr.reportDate)}</TableCell>
                    <TableCell>{summary.location}</TableCell>
                    <TableCell>{summary.chainage}</TableCell>
                    <TableCell>{summary.workItem}</TableCell>
                    <TableCell>{summary.qty}</TableCell>
                    <TableCell>{String(dpr.contractorName ?? '—')}</TableCell>
                    <TableCell>{String(dpr.supervisorName ?? '—')}</TableCell>
                    <TableCell>
                      <StatusChip status={status} label={dprWorkflowStepLabel(status)} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="nowrap">
                        <Button
                          size="small" variant="text" startIcon={<VisibilityIcon fontSize="small" />}
                          onClick={() => { void viewDprDetail(dprId); }}
                        >
                          View
                        </Button>
                        {canCreateDpr && isEditable && (
                          <Button
                            size="small" variant="outlined"
                            onClick={() => { void loadDprForEdit(dprId); }}
                          >
                            Edit
                          </Button>
                        )}
                        {canCreateDpr && isEditable && (
                          <Button
                            size="small" variant="contained"
                            onClick={() => { void submitWorkflow(() => constructionApi.submitDpr(projectId, dprId), 'submit DPR'); }}
                          >
                            {status === 'rejected' ? 'Resubmit' : 'Submit'}
                          </Button>
                        )}
                        {!isEditable && <ApprovalButtons type="dpr" id={dprId} status={status} />}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 'mb' && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} gap={2} sx={constructionSectionBarSx('mb')}>
            <Typography variant="subtitle1" fontWeight={700} color={constructionTableTheme('mb').headerColor}>
              Stage 3 &amp; 4: Measurement Book Entry &amp; Verification
            </Typography>
            {canCreateMb && (
              <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={openNewMbDialog}>
                New MB
              </Button>
            )}
          </Box>
          <Box display="flex" gap={0.5} flexWrap="wrap" alignItems="center" mb={1}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Pipeline:</Typography>
            {CONSTRUCTION_PIPELINE.map((role, idx) => (
              <Box key={role} display="flex" alignItems="center" gap={0.5}>
                <Chip size="small" variant={['AE', 'EE'].includes(role) ? 'filled' : 'outlined'} color={['AE', 'EE'].includes(role) ? 'primary' : 'default'} label={role} />
                {idx < CONSTRUCTION_PIPELINE.length - 1 && (
                  <Typography variant="caption" color="text.secondary">→</Typography>
                )}
              </Box>
            ))}
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
            {MB_WORKFLOW_SEQUENCE.map((step) => (
              <Chip key={step.status} size="small" variant="outlined" label={`${step.step}. ${step.label}`} sx={constructionWorkflowChipSx('mb')} />
            ))}
          </Box>
          <Table size="small" sx={constructionTableShellSx('mb')}>
            <ConstructionTableHead
              stage="mb"
              columns={[
                { label: 'MB #' },
                { label: 'Date' },
                { label: 'Work Item' },
                { label: 'Chainage' },
                { label: 'Qty' },
                { label: 'Coordinates' },
                { label: 'Status', minWidth: 130 },
                { label: 'Actions', minWidth: 280 },
              ]}
            />
            <TableBody>
              {mbs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary">
                      No measurement books yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {mbs.map((mb) => {
                const summary = mbEntrySummary(mb);
                const status = String(mb.status);
                const isEditable = status === 'draft' || status === 'rejected';
                const mbId = String(mb.id);
                return (
                  <TableRow key={mbId}>
                    <TableCell>{String(mb.mbNumber)}</TableCell>
                    <TableCell>{String(mb.measurementDate)}</TableCell>
                    <TableCell>{summary.workItem}</TableCell>
                    <TableCell>{summary.chainage}</TableCell>
                    <TableCell>{summary.qty}</TableCell>
                    <TableCell>{summary.coordinates}</TableCell>
                    <TableCell>
                      <StatusChip status={status} label={mbWorkflowStepLabel(status)} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="nowrap">
                        <Button size="small" variant="text" startIcon={<VisibilityIcon fontSize="small" />}
                          onClick={() => { void viewMbDetail(mbId); }}>
                          View
                        </Button>
                        {canCreateMb && isEditable && (
                          <Button size="small" variant="outlined" onClick={() => { void loadMbForEdit(mbId); }}>
                            Edit
                          </Button>
                        )}
                        {canCreateMb && isEditable && (
                          <Button size="small" variant="contained"
                            onClick={() => { void submitWorkflow(() => constructionApi.submitMb(projectId, mbId), 'submit MB'); }}>
                            {status === 'rejected' ? 'Resubmit' : 'Submit'}
                          </Button>
                        )}
                        {!isEditable && <MbVerifyActions mbId={mbId} status={status} />}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 'reconciliation' && (
        <BoqReconciliationPanel reconciliation={reconciliation} projectName={projectName} />
      )}

      {tab === 'ra-bills' && (
        <RaBillPanel
          projectId={projectId!}
          raBills={raBills as Parameters<typeof RaBillPanel>[0]['raBills']}
          ratesFromL1Boq={ratesFromL1Boq}
          roles={roles}
          canGenerate={canGenerateRa}
          canApprove={canApprove}
          onRefresh={refresh}
          onError={setError}
        />
      )}

      {tab === 'final' && (
        <FinalBillPanel
          projectId={projectId}
          canVerify={canApprove || roles.includes('ee')}
          onRefresh={refresh}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}

      {tab === 'gis' && (
        <GisIntegrationPanel
          projectId={projectId}
          canCreate={canCreate || canSubmit}
          canUpdate={canUpdate || canSubmit}
          onRefresh={refresh}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}

      {tab === 'reports' && (
        <ConstructionReportsPanel projectId={projectId} onError={setError} />
      )}

      {/* DPR Dialog */}
      <Dialog
        open={dprDialog}
        onClose={() => { setDprDialog(false); resetDprForm(); }}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          {editingDprId ? 'Edit Daily Progress Report' : 'Daily Progress Report — Stage 2'}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 2,
            overflowY: 'auto',
            '& > *': { flexShrink: 0 },
          }}
        >
          <Typography variant="subtitle2" fontWeight={700}>Contractor — Daily Progress</Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <TextField
              required label="DPR number" sx={{ flex: 1, minWidth: 160 }}
              value={dprHeaderForm.dprNumber}
              onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, dprNumber: e.target.value })}
            />
            <TextField
              required type="date" label="Date" InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 160 }}
              value={dprHeaderForm.reportDate}
              onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, reportDate: e.target.value })}
            />
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap">
            <TextField
              select label="Scheme" sx={{ flex: 1, minWidth: 160 }}
              value={dprHeaderForm.schemeType}
              onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, schemeType: e.target.value as SchemeType })}
            >
              <MenuItem value="gravity">Gravity</MenuItem>
              <MenuItem value="pumping">Pumping</MenuItem>
            </TextField>
            <TextField
              select label="Work Package" sx={{ flex: 1, minWidth: 160 }}
              value={dprHeaderForm.workPackageId}
              onChange={(e) => {
                const wpId = e.target.value;
                const wp = workPackages.find((w) => String(w.id) === wpId);
                setDprHeaderForm({
                  ...dprHeaderForm,
                  workPackageId: wpId,
                  contractorName: wp ? String(wp.contractorName ?? dprHeaderForm.contractorName) : dprHeaderForm.contractorName,
                });
              }}
            >
              <MenuItem value="">— None —</MenuItem>
              {workPackages.map((wp) => (
                <MenuItem key={String(wp.id)} value={String(wp.id)}>{String(wp.packageCode)} — {String(wp.name)}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap">
            <TextField
              required label="Contractor Name" sx={{ flex: 1, minWidth: 200 }}
              value={dprHeaderForm.contractorName}
              onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, contractorName: e.target.value })}
            />
            <TextField
              required label="Supervisor Name" sx={{ flex: 1, minWidth: 200 }}
              value={dprHeaderForm.supervisorName}
              onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, supervisorName: e.target.value })}
            />
          </Box>
          <TextField
            fullWidth
            label="Site Location" placeholder="Village / ward / landmark"
            value={dprHeaderForm.workLocation}
            onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, workLocation: e.target.value })}
          />
          <Box display="flex" gap={1} flexWrap="wrap">
            <TextField
              label="Weather" sx={{ flex: 1, minWidth: 140 }}
              value={dprHeaderForm.weather}
              onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, weather: e.target.value })}
            />
            <TextField
              type="number" label="Total Manpower (Labour)" sx={{ flex: 1, minWidth: 140 }}
              value={dprHeaderForm.manpowerCount}
              onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, manpowerCount: Number(e.target.value) })}
            />
          </Box>

          <Divider />
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ flexShrink: 0 }}>
            <Typography variant="subtitle2" fontWeight={700}>Work Items — Quantity Executed</Typography>
            <Button
              size="small" startIcon={<AddIcon />}
              onClick={() => setDprActivityRows((rows) => [...rows, emptyDprActivityRow()])}
            >
              Add work item
            </Button>
          </Box>

          <Box display="flex" flexDirection="column" gap={2} sx={{ flexShrink: 0 }}>
          {dprActivityRows.map((row, idx) => (
            <Box
              key={row.key}
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                overflow: 'visible',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="body2" fontWeight={600}>Work item {idx + 1}</Typography>
                {dprActivityRows.length > 1 && (
                  <IconButton
                    size="small" color="error" aria-label={`Remove work item ${idx + 1}`}
                    onClick={() => setDprActivityRows((rows) => rows.filter((r) => r.key !== row.key))}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Box display="flex" flexDirection="column" gap={1.5}>
                <TextField
                  fullWidth
                  required label="Work Item / Activity Description"
                  value={row.description}
                  onChange={(e) => updateDprActivityRow(row.key, { description: e.target.value })}
                />
                <Box display="flex" gap={1} flexWrap="wrap">
                  <TextField
                    select label="Component" sx={{ flex: 1, minWidth: 160 }}
                    value={row.component}
                    onChange={(e) => updateDprActivityRow(row.key, { component: e.target.value as ProjectComponent })}
                  >
                    <MenuItem value="">— Select —</MenuItem>
                    {Object.entries(COMPONENT_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </TextField>
                  <TextField
                    select label="BOQ Item" sx={{ flex: 1, minWidth: 160 }}
                    value={row.boqItemId}
                    onChange={(e) => {
                      const item = billingBoq.find((b) => String(b.id) === e.target.value);
                      updateDprActivityRow(row.key, {
                        boqItemId: e.target.value,
                        description: row.description || (item ? String(item.description) : ''),
                        unit: item ? String(item.unit) : row.unit,
                      });
                    }}
                  >
                    <MenuItem value="">— None —</MenuItem>
                    {billingBoq.filter((b) => b.schemeType === dprHeaderForm.schemeType).map((b) => (
                      <MenuItem key={String(b.id)} value={String(b.id)}>{String(b.itemCode)} — {String(b.description).slice(0, 40)}</MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <TextField
                    label="Chainage From" placeholder="0+000" sx={{ flex: 1, minWidth: 120 }}
                    value={row.chainageFrom}
                    onChange={(e) => updateDprActivityRow(row.key, { chainageFrom: e.target.value })}
                  />
                  <TextField
                    label="Chainage To" placeholder="0+500" sx={{ flex: 1, minWidth: 120 }}
                    value={row.chainageTo}
                    onChange={(e) => updateDprActivityRow(row.key, { chainageTo: e.target.value })}
                  />
                  <TextField
                    type="number" required label="Quantity Executed" sx={{ flex: 1, minWidth: 120 }}
                    value={row.quantityDone}
                    onChange={(e) => updateDprActivityRow(row.key, { quantityDone: Number(e.target.value) })}
                  />
                  <TextField
                    select label="Unit" sx={{ flex: 1, minWidth: 100 }}
                    value={row.unit}
                    onChange={(e) => updateDprActivityRow(row.key, { unit: e.target.value })}
                  >
                    {DPR_UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                  </TextField>
                </Box>

                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Site Engineer — GPS, Resources &amp; Progress Verification
                </Typography>
                <TextField
                  fullWidth
                  label="Location Detail" placeholder="Specific point / structure / house connection"
                  value={row.locationDetail}
                  onChange={(e) => updateDprActivityRow(row.key, { locationDetail: e.target.value })}
                />
                <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                  <TextField
                    label="Latitude" sx={{ flex: 1, minWidth: 140 }}
                    value={row.latitude}
                    onChange={(e) => updateDprActivityRow(row.key, { latitude: e.target.value })}
                  />
                  <TextField
                    label="Longitude" sx={{ flex: 1, minWidth: 140 }}
                    value={row.longitude}
                    onChange={(e) => updateDprActivityRow(row.key, { longitude: e.target.value })}
                  />
                  <GpsCaptureButton
                    loading={gpsCapturingKey === row.key}
                    onCapture={() => captureActivityGps(row.key)}
                  />
                </Box>
                <TextField
                  fullWidth
                  label="Material Consumption" placeholder="e.g. Cement 10 bags, DI pipe 100mm × 50 Rmt"
                  value={row.materialConsumption}
                  onChange={(e) => updateDprActivityRow(row.key, { materialConsumption: e.target.value })}
                />
                <Box display="flex" gap={1} flexWrap="wrap">
                  <TextField
                    type="number" label="Labour Count (this item)" sx={{ flex: 1, minWidth: 160 }}
                    value={row.labourCount}
                    onChange={(e) => updateDprActivityRow(row.key, { labourCount: Number(e.target.value) })}
                  />
                  <TextField
                    label="Equipment Details" placeholder="JCB 1 no, concrete mixer 2 nos" sx={{ flex: 2, minWidth: 200 }}
                    value={row.equipmentDetails}
                    onChange={(e) => updateDprActivityRow(row.key, { equipmentDetails: e.target.value })}
                  />
                </Box>
              </Box>
            </Box>
          ))}
          </Box>

          <Divider />
          <Typography variant="subtitle2" fontWeight={700}>Geo-tagged Photographs</Typography>
          <DprPhotoPicker
            photos={dprPhotos}
            onAdd={(files) => setDprPhotos((prev) => [...prev, ...files])}
            onRemove={(index) => setDprPhotos((prev) => prev.filter((_, i) => i !== index))}
          />
          <BilingualRemarkField
            label="Remarks"
            pdfTitle="Daily Progress Report Remarks"
            value={parseBilingualText(dprHeaderForm.remarks)}
            onChange={(v) => setDprHeaderForm({ ...dprHeaderForm, remarks: serializeBilingualText(v) })}
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDprDialog(false); resetDprForm(); }}>Cancel</Button>
          <Button variant="contained" onClick={() => { void handleSaveDpr(); }}>Save DPR</Button>
        </DialogActions>
      </Dialog>

      {/* DPR Detail Dialog */}
      <Dialog open={dprDetailOpen} onClose={() => setDprDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          DPR {String(dprDetail?.dprNumber ?? '')} — {String(dprDetail?.reportDate ?? '')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {dprDetail && (
            <>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip size="small" label={String(dprDetail.schemeType)} />
                <StatusChip status={String(dprDetail.status)} />
              </Box>
              <Grid container spacing={1}>
                {[
                  ['Location', String(dprDetail.workSite ?? '—')],
                  ['Contractor', String(dprDetail.contractorName ?? '—')],
                  ['Supervisor', String(dprDetail.supervisorName ?? '—')],
                  ['Weather', String(dprDetail.weather ?? '—')],
                  ['Total Manpower', String(dprDetail.manpowerCount ?? 0)],
                ].map(([label, value]) => (
                  <Grid item xs={12} sm={6} key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2">{value}</Typography>
                  </Grid>
                ))}
              </Grid>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Work Items</Typography>
              {((dprDetail.activities as Array<Record<string, unknown>>) ?? []).map((act, idx) => (
                <Card key={String(act.id ?? idx)} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    {idx + 1}. {String(act.description)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Qty: {String(act.quantityDone)} {String(act.unit)}
                    {' · '}Chainage: {[act.chainageFrom, act.chainageTo].filter(Boolean).join(' → ') || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    GPS: {act.latitude != null && act.longitude != null ? `${act.latitude}, ${act.longitude}` : '—'}
                    {' · '}Labour: {String(act.labourCount ?? 0)}
                  </Typography>
                  {Boolean(act.materialConsumption) && (
                    <Typography variant="caption" display="block">Material: {String(act.materialConsumption)}</Typography>
                  )}
                  {Boolean(act.equipmentDetails) && (
                    <Typography variant="caption" display="block">Equipment: {String(act.equipmentDetails)}</Typography>
                  )}
                </Card>
              ))}
              {((dprDetail.documents as Array<Record<string, unknown>>) ?? []).length > 0 && (
                <>
                  <Divider />
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Geo-tagged Photographs</Typography>
                  <DprPhotoGallery
                    projectId={projectId}
                    documents={(dprDetail.documents as Array<Record<string, unknown>>) ?? []}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDprDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* MB Dialog */}
      <Dialog open={mbDialog} onClose={() => { setMbDialog(false); resetMbForm(); }} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle>
          {editingMbId ? 'Edit Measurement Book' : 'Measurement Book — Stage 3 (JE Site Inspection)'}
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2, overflowY: 'auto', '& > *': { flexShrink: 0 } }}>
          <Typography variant="subtitle2" fontWeight={700}>JE — Site Inspection &amp; Measurement</Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <TextField required label="MB Number" sx={{ flex: 1, minWidth: 160 }}
              value={mbHeaderForm.mbNumber} onChange={(e) => setMbHeaderForm({ ...mbHeaderForm, mbNumber: e.target.value })} />
            <TextField required type="date" label="Date of Measurement" InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 160 }}
              value={mbHeaderForm.measurementDate} onChange={(e) => setMbHeaderForm({ ...mbHeaderForm, measurementDate: e.target.value })} />
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap">
            <TextField select label="Scheme" sx={{ flex: 1, minWidth: 140 }}
              value={mbHeaderForm.schemeType} onChange={(e) => setMbHeaderForm({ ...mbHeaderForm, schemeType: e.target.value as SchemeType })}>
              <MenuItem value="gravity">Gravity</MenuItem>
              <MenuItem value="pumping">Pumping</MenuItem>
            </TextField>
            <TextField select label="Work Package" sx={{ flex: 1, minWidth: 160 }}
              value={mbHeaderForm.workPackageId} onChange={(e) => setMbHeaderForm({ ...mbHeaderForm, workPackageId: e.target.value })}>
              <MenuItem value="">— None —</MenuItem>
              {workPackages.map((wp) => (
                <MenuItem key={String(wp.id)} value={String(wp.id)}>{String(wp.packageCode)}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Linked DPR" sx={{ flex: 1, minWidth: 160 }}
              value={mbHeaderForm.dprId} onChange={(e) => setMbHeaderForm({ ...mbHeaderForm, dprId: e.target.value })}>
              <MenuItem value="">— None —</MenuItem>
              {dprs.map((d) => (
                <MenuItem key={String(d.id)} value={String(d.id)}>{String(d.dprNumber)} — {String(d.reportDate)}</MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField fullWidth label="Site Location" value={mbHeaderForm.siteLocation}
            onChange={(e) => setMbHeaderForm({ ...mbHeaderForm, siteLocation: e.target.value })} />

          <Divider />
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" fontWeight={700}>Measured Work Items</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setMbEntryRows((r) => [...r, emptyMbEntryRow()])}>
              Add work item
            </Button>
          </Box>

          <Box display="flex" flexDirection="column" gap={2}>
            {mbEntryRows.map((row, idx) => (
              <Box key={row.key} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'visible' }}>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" fontWeight={600}>Work item {idx + 1}</Typography>
                  {mbEntryRows.length > 1 && (
                    <IconButton size="small" color="error" onClick={() => setMbEntryRows((r) => r.filter((x) => x.key !== row.key))}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <Box display="flex" flexDirection="column" gap={1.5}>
                  <TextField fullWidth required label="Work Item" value={row.description}
                    onChange={(e) => updateMbEntryRow(row.key, { description: e.target.value })} />
                  <TextField select fullWidth label="BOQ Item" value={row.boqItemId}
                    onChange={(e) => {
                      const item = billingBoq.find((b) => String(b.id) === e.target.value);
                      updateMbEntryRow(row.key, {
                        boqItemId: e.target.value,
                        description: row.description || (item ? String(item.description) : ''),
                        unit: item ? String(item.unit) : row.unit,
                        rate: item ? Number(item.rate) : row.rate,
                      });
                    }}>
                    <MenuItem value="">— Select —</MenuItem>
                    {billingBoq.filter((b) => b.schemeType === mbHeaderForm.schemeType).map((b) => (
                      <MenuItem key={String(b.id)} value={String(b.id)}>{String(b.itemCode)} — {String(b.description).slice(0, 40)}</MenuItem>
                    ))}
                  </TextField>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <TextField label="Chainage From" sx={{ flex: 1, minWidth: 120 }} value={row.chainageFrom}
                      onChange={(e) => updateMbEntryRow(row.key, { chainageFrom: e.target.value })} />
                    <TextField label="Chainage To" sx={{ flex: 1, minWidth: 120 }} value={row.chainageTo}
                      onChange={(e) => updateMbEntryRow(row.key, { chainageTo: e.target.value })} />
                  </Box>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <TextField type="number" label="Length (m)" sx={{ flex: 1, minWidth: 100 }} value={row.lengthM}
                      onChange={(e) => updateMbEntryRow(row.key, { lengthM: e.target.value })} />
                    <TextField type="number" label="Width (m)" sx={{ flex: 1, minWidth: 100 }} value={row.widthM}
                      onChange={(e) => updateMbEntryRow(row.key, { widthM: e.target.value })} />
                    <TextField type="number" label="Depth (m)" sx={{ flex: 1, minWidth: 100 }} value={row.depthM}
                      onChange={(e) => updateMbEntryRow(row.key, { depthM: e.target.value })} />
                    <TextField type="number" required label="Quantity" sx={{ flex: 1, minWidth: 100 }} value={row.measuredQty}
                      onChange={(e) => updateMbEntryRow(row.key, { measuredQty: Number(e.target.value) })} />
                    <TextField select label="Unit" sx={{ flex: 1, minWidth: 90 }} value={row.unit}
                      onChange={(e) => updateMbEntryRow(row.key, { unit: e.target.value })}>
                      {MB_UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </TextField>
                    <TextField type="number" label="Rate" sx={{ flex: 1, minWidth: 100 }} value={row.rate}
                      onChange={(e) => updateMbEntryRow(row.key, { rate: Number(e.target.value) })} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>GPS Verification</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
                    <TextField label="Latitude" sx={{ flex: 1, minWidth: 140 }} value={row.latitude}
                      onChange={(e) => updateMbEntryRow(row.key, { latitude: e.target.value })} />
                    <TextField label="Longitude" sx={{ flex: 1, minWidth: 140 }} value={row.longitude}
                      onChange={(e) => updateMbEntryRow(row.key, { longitude: e.target.value })} />
                    <GpsCaptureButton loading={mbGpsCapturingKey === row.key} onCapture={() => captureMbEntryGps(row.key)} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>

          <Divider />
          <Typography variant="subtitle2" fontWeight={700}>Quality &amp; Material Verification</Typography>
          <TextField fullWidth multiline minRows={2} label="Quality Verification"
            placeholder="Work quality, compaction, alignment, test results…"
            value={mbHeaderForm.qualityVerification}
            onChange={(e) => setMbHeaderForm({ ...mbHeaderForm, qualityVerification: e.target.value })} />
          <TextField fullWidth multiline minRows={2} label="Material Verification"
            placeholder="Material type, quantity used, batch/lot, supplier…"
            value={mbHeaderForm.materialVerification}
            onChange={(e) => setMbHeaderForm({ ...mbHeaderForm, materialVerification: e.target.value })} />

          <Divider />
          <Typography variant="subtitle2" fontWeight={700}>Geo-tagged Photographs</Typography>
          <DprPhotoPicker photos={mbPhotos}
            onAdd={(files) => setMbPhotos((p) => [...p, ...files])}
            onRemove={(i) => setMbPhotos((p) => p.filter((_, idx) => idx !== i))} />

          <BilingualRemarkField
            label="Remarks"
            pdfTitle="Measurement Book Remarks"
            value={parseBilingualText(mbHeaderForm.remarks)}
            onChange={(v) => setMbHeaderForm({ ...mbHeaderForm, remarks: serializeBilingualText(v) })}
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setMbDialog(false); resetMbForm(); }}>Cancel</Button>
          <Button variant="contained" onClick={() => { void handleCreateMb(); }}>Save MB</Button>
        </DialogActions>
      </Dialog>

      {/* MB Detail Dialog */}
      <Dialog open={mbDetailOpen} onClose={() => setMbDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>MB {String(mbDetail?.mbNumber ?? '')} — {String(mbDetail?.measurementDate ?? '')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {mbDetail && (
            <>
              <Box display="flex" gap={1}>
                <StatusChip status={String(mbDetail.status)} label={mbWorkflowStepLabel(String(mbDetail.status))} />
              </Box>
              <Grid container spacing={1}>
                {[['Site', String(mbDetail.siteAddress ?? '—')], ['Scheme', String(mbDetail.schemeType ?? '—')]].map(([l, v]) => (
                  <Grid item xs={12} sm={6} key={l}>
                    <Typography variant="caption" color="text.secondary">{l}</Typography>
                    <Typography variant="body2">{v}</Typography>
                  </Grid>
                ))}
              </Grid>
              {mbDetail.remarks && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{String(mbDetail.remarks)}</Typography>
              )}
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>Measurements</Typography>
              {((mbDetail.entries as Array<Record<string, unknown>>) ?? []).map((e, idx) => (
                <Box key={String(e.id ?? idx)} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{idx + 1}. {String(e.description)}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Qty: {String(e.measuredQty)} {String(e.unit)}
                    {' · '}L×W×D: {[e.lengthM, e.widthM, e.depthM].filter(Boolean).join(' × ') || '—'}
                    {' · '}Chainage: {[e.chainageFrom, e.chainageTo].filter(Boolean).join(' → ') || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    GPS: {e.latitude != null && e.longitude != null ? `${e.latitude}, ${e.longitude}` : '—'}
                    {' · '}Rate: ₹{Number(e.rate ?? 0).toLocaleString()}
                  </Typography>
                </Box>
              ))}
              {((mbDetail.documents as Array<Record<string, unknown>>) ?? []).length > 0 && (
                <>
                  <Divider />
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Geo-tagged Photographs</Typography>
                  <DprPhotoGallery projectId={projectId} documents={(mbDetail.documents as Array<Record<string, unknown>>) ?? []} />
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMbDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* MB Verification Dialog — Stage 4 */}
      <Dialog open={Boolean(mbVerifyDialog)} onClose={() => setMbVerifyDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Stage 4: {mbVerifyDialog?.role === 'ae' ? 'Assistant Engineer (AE) Verification' : 'Executive Engineer (EE) Final Approval'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {mbDetail && (
            <Typography variant="body2" color="text.secondary">
              MB {String(mbDetail.mbNumber)} — {String(mbDetail.measurementDate)}
              {' · '}{mbEntrySummary(mbDetail).workItem}
            </Typography>
          )}
          {planningForm.drawingUploadUrl && (
            <Typography variant="caption" color="text.secondary">
              Approved drawing on file: {planningForm.drawingUploadUrl.split('/').pop()}
            </Typography>
          )}
          {mbVerifyDialog?.role === 'ae' && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>AE — Verify before Approve</Typography>
              <FormControlLabel control={<Checkbox checked={aeVerifyForm.mbEntriesOk} onChange={(e) => setAeVerifyForm({ ...aeVerifyForm, mbEntriesOk: e.target.checked })} />} label="MB entries verified" />
              <FormControlLabel control={<Checkbox checked={aeVerifyForm.siteConditionsOk} onChange={(e) => setAeVerifyForm({ ...aeVerifyForm, siteConditionsOk: e.target.checked })} />} label="Site conditions verified" />
              <FormControlLabel control={<Checkbox checked={aeVerifyForm.quantitiesOk} onChange={(e) => setAeVerifyForm({ ...aeVerifyForm, quantitiesOk: e.target.checked })} />} label="Quantities verified" />
              <FormControlLabel control={<Checkbox checked={aeVerifyForm.drawingsOk} onChange={(e) => setAeVerifyForm({ ...aeVerifyForm, drawingsOk: e.target.checked })} />} label="Drawings verified against site" />
              <BilingualRemarkField
                label="Verification remarks"
                pdfTitle="Measurement Book AE Verification Remarks"
                pdfSubtitle={mbDetail ? `MB ${String(mbDetail.mbNumber)}` : undefined}
                value={aeRemarks}
                onChange={setAeRemarks}
                minRows={2}
              />
            </>
          )}
          {mbVerifyDialog?.role === 'ee' && (
            <>
              <Typography variant="subtitle2" fontWeight={700}>EE — Final Approval</Typography>
              <FormControlLabel control={<Checkbox checked={eeVerifyForm.technicalOk} onChange={(e) => setEeVerifyForm({ ...eeVerifyForm, technicalOk: e.target.checked })} />} label="Final technical verification" />
              <FormControlLabel control={<Checkbox checked={eeVerifyForm.quantityApprovalOk} onChange={(e) => setEeVerifyForm({ ...eeVerifyForm, quantityApprovalOk: e.target.checked })} />} label="Quantity approval" />
              <FormControlLabel control={<Checkbox checked={eeVerifyForm.financialOk} onChange={(e) => setEeVerifyForm({ ...eeVerifyForm, financialOk: e.target.checked })} />} label="Financial approval" />
              <BilingualRemarkField
                label="Approval remarks"
                pdfTitle="Measurement Book EE Approval Remarks"
                pdfSubtitle={mbDetail ? `MB ${String(mbDetail.mbNumber)}` : undefined}
                value={eeRemarks}
                onChange={setEeRemarks}
                minRows={2}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMbVerifyDialog(null)}>Cancel</Button>
          <Button color="error" onClick={() => { void submitMbVerification('reject'); }}>Reject</Button>
          <Button variant="contained" onClick={() => { void submitMbVerification('approve'); }}>Approve</Button>
        </DialogActions>
      </Dialog>


      <Dialog open={wpDialog} onClose={() => setWpDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Work Package (Admin)</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField label="Package Code" value={wpForm.packageCode} onChange={(e) => setWpForm({ ...wpForm, packageCode: e.target.value })} placeholder="WP-GM-02" required />
          <TextField label="Package Name" value={wpForm.name} onChange={(e) => setWpForm({ ...wpForm, name: e.target.value })} required />
          <TextField select label="Component" value={wpForm.component} onChange={(e) => setWpForm({ ...wpForm, component: e.target.value as ProjectComponent })}>
            {Object.entries(COMPONENT_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <TextField select label="Scheme Type" value={wpForm.schemeType} onChange={(e) => setWpForm({ ...wpForm, schemeType: e.target.value as SchemeType })}>
            <MenuItem value="gravity">Gravity</MenuItem>
            <MenuItem value="pumping">Pumping</MenuItem>
          </TextField>
          <TextField label="Chainage From" value={wpForm.chainageFrom} onChange={(e) => setWpForm({ ...wpForm, chainageFrom: e.target.value })} placeholder="0+000" />
          <TextField label="Chainage To" value={wpForm.chainageTo} onChange={(e) => setWpForm({ ...wpForm, chainageTo: e.target.value })} placeholder="2+000" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWpDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { void handleCreateWorkPackage(); }}>Save Package</Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
