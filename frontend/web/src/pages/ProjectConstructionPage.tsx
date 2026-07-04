import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControlLabel, Grid, IconButton, LinearProgress, Link, List, ListItem,
  ListItemIcon, ListItemText, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography, Table, TableBody,
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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
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
  activityRowFromBoqAndWp, buildDprPayload, defaultDprHeader, dprActivitySummaryForActivity,
  emptyDprActivityRow, findL1BoqForComponent, flattenDprsForTable, formatProgressQty,
  frozenProgressFromRow, isWholeJobMeasurement, pctFromQty, prefillAllDprActivitiesFromWp,
  prefillDprActivitiesFromWp, resolveL1BoqItem, wholeJobQtySelectOptions,
  type DprActivityRow, type DprHeaderForm, type DprProgressSummary,
} from '../utils/dprForm';
import DprPhotoGallery from '../components/construction/DprPhotoGallery';
import DprBoqProgressCell from '../components/construction/DprBoqProgressCell';
import DprDetailDialog from '../components/construction/DprDetailDialog';
import DprExecutionQtyDisplay from '../components/construction/DprExecutionQtyDisplay';
import DprPlannedVsActualPanel from '../components/construction/DprPlannedVsActualPanel';
import DprTableQtyCell from '../components/construction/DprTableQtyCell';
import DprWorkItemCell from '../components/construction/DprWorkItemCell';
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
  mbEntrySummary, type MbEntryRow, type MbHeaderForm,
} from '../utils/mbForm';
import { boqUnitOptions, collectBoqUnits } from '../utils/boqUnits';
import {
  aeChecksComplete, buildAeVerificationComments, buildEeVerificationComments,
  eeChecksComplete, type AeVerificationChecks, type EeVerificationChecks,
} from '../utils/mbVerification';
import { parseBoqExcel, toImportPayload, type ParsedBoqRow } from '../utils/boqExcelImport';
import { formatBoqAmount, formatBoqRoundedRupee, roundBoqTotalToNearestRupee, sumBoqAmounts } from '../utils/boqAmount';
import { formatApiError } from '../utils/apiError';
import {
  BOQ_EXCEL_SECTION_LABELS, BOQ_EXCEL_SECTION_ORDER, BOQ_TABLE_COLUMNS, COMPONENT_LABELS,
  CONSTRUCTION_PIPELINE, DPR_WEATHER_OPTIONS, DPR_WORKFLOW_SEQUENCE, dprWorkflowStepLabel, MB_WORKFLOW_SEQUENCE,
  mbPendingVerifier, mbWorkflowStepLabel,
  PROJECT_COMPONENT_ORDER, STATUS_APPROVER, STATUS_COLORS, WORKFLOW_DONE_STATUSES, WORKFLOW_STAGES,
  type ProjectComponent,
} from '../constants/construction';

type SecretariatSanctionRefs = {
  dprProposalId?: string;
  proposalNo?: string;
  administrativeApprovalNo?: string | null;
  expenditureSanctionNo?: string | null;
};

function applySecretariatSanctionRefs(
  form: PlanningFormState,
  secretariat: SecretariatSanctionRefs | null | undefined,
): { form: PlanningFormState; autoFilled: string[] } {
  if (!secretariat) return { form, autoFilled: [] };

  const autoFilled: string[] = [];
  const next = { ...form };
  const aa = String(secretariat.administrativeApprovalNo ?? '').trim();
  const es = String(secretariat.expenditureSanctionNo ?? '').trim();

  if (!next.adminApprovalRef.trim() && aa) {
    next.adminApprovalRef = aa;
    autoFilled.push('Administrative Approval (AA)');
  }
  if (!next.technicalSanctionRef.trim() && es) {
    next.technicalSanctionRef = es;
    autoFilled.push('Expenditure Sanction (ES)');
  }

  return { form: next, autoFilled };
}

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

type ContractorLoginInfo = {
  workPackageCode: string;
  contractorName: string;
  email: string;
  password: string;
  created: boolean;
  passwordIssued: boolean;
};

function parseContractorLogin(data: unknown): ContractorLoginInfo | null {
  const row = data as Record<string, unknown>;
  const login = row.contractorLogin as Record<string, unknown> | undefined;
  const email = String(login?.email ?? row.contractorLoginEmail ?? '').trim();
  if (!email) return null;
  const created = Boolean(login?.created);
  const passwordIssued = login?.passwordIssued !== false && created;
  return {
    workPackageCode: String(login?.workPackageCode ?? row.packageCode ?? ''),
    contractorName: String(login?.contractorName ?? row.contractorName ?? ''),
    email,
    password: passwordIssued ? String(login?.password ?? 'Contractor@123') : '',
    created,
    passwordIssued,
  };
}

function contractorLoginFromWorkPackage(wp: Record<string, unknown>): ContractorLoginInfo | null {
  const email = String(wp.contractorLoginEmail ?? '').trim();
  if (!email) return null;
  return {
    workPackageCode: String(wp.packageCode ?? ''),
    contractorName: String(wp.contractorName ?? ''),
    email,
    password: '',
    created: false,
    passwordIssued: false,
  };
}

function scrollToTopForFeedback() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function contractorDraftName(wp: Record<string, unknown>, drafts: Record<string, string>): string {
  return String(drafts[String(wp.id)] ?? wp.contractorName ?? '').trim();
}

/** Provision when name is set and login is missing, email unknown, or firm name changed. */
function needsContractorProvision(wp: Record<string, unknown>, contractorName: string): boolean {
  const trimmed = contractorName.trim();
  if (!trimmed) return false;
  if (!wp.contractorId) return true;
  if (!String(wp.contractorLoginEmail ?? '').trim()) return true;
  return trimmed !== String(wp.contractorName ?? '').trim();
}

function isContractorFullyAssigned(wp: Record<string, unknown>, drafts: Record<string, string>): boolean {
  return Boolean(contractorDraftName(wp, drafts)) && Boolean(wp.contractorId);
}

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
  const grandTotalRaw = useMemo(
    () => sumBoqAmounts(items.map((item) => boqLineAmount(item))),
    [items],
  );
  const grandTotal = useMemo(() => roundBoqTotalToNearestRupee(grandTotalRaw), [grandTotalRaw]);

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>{title}</Typography>
        {!items.length && (
          <Typography variant="body2" color="text.secondary">No items.</Typography>
        )}
        {sections.map((section) => {
          const sectionTotalRaw = sumBoqAmounts(section.items.map((item) => boqLineAmount(item)));
          const sectionTotal = roundBoqTotalToNearestRupee(sectionTotalRaw);
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
                        <TableCell align="right">₹{formatBoqAmount(amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="body2" fontWeight={700}>Total Amount with Tax</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700}>
                        ₹{formatBoqRoundedRupee(sectionTotal)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          );
        })}
        {items.length > 0 && (
          <Box display="flex" flexDirection="column" alignItems="flex-end" mt={1} px={1} gap={0.25}>
            <Typography variant="subtitle1" fontWeight={700}>
              Grand Total Amount with Tax: ₹{formatBoqRoundedRupee(grandTotal)}
            </Typography>
            {grandTotal !== grandTotalRaw && (
              <Typography variant="caption" color="text.secondary">
                Calculated ₹{formatBoqAmount(grandTotalRaw)} — rounded to nearest rupee
              </Typography>
            )}
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
  label, value, file, disabled, done, onPick,
}: {
  label: string; value: string; file?: File | null; disabled?: boolean; done?: boolean;
  onPick: (file: File) => void;
}) {
  const fileName = value ? value.split('/').pop() ?? value : '';
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        {done
          ? <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
          : <RadioButtonUncheckedIcon color="disabled" sx={{ fontSize: 20 }} />}
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
      </Box>
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
  label, fileName, file, disabled, importing, done, onUpload,
}: {
  label: string; fileName: string; file?: File | null; disabled?: boolean; importing?: boolean; done?: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        {done
          ? <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
          : <RadioButtonUncheckedIcon color="disabled" sx={{ fontSize: 20 }} />}
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
      </Box>
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

  const [tab, setTab] = useState<TabKey>(() => (
    roles.includes('contractor') && !roles.includes('super_admin') ? 'dpr' : 'dashboard'
  ));
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dprTabError, setDprTabError] = useState('');
  const [dprFormError, setDprFormError] = useState('');
  const [boqImporting, setBoqImporting] = useState(false);
  const [boqFileName, setBoqFileName] = useState('');
  const [l1BoqImporting, setL1BoqImporting] = useState(false);
  const [l1BoqFileName, setL1BoqFileName] = useState('');
  const [planningSecretariatMsg, setPlanningSecretariatMsg] = useState('');
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
  const [dprWeatherFilter, setDprWeatherFilter] = useState('');
  const [editingDprId, setEditingDprId] = useState<string | null>(null);
  const [dprHeaderForm, setDprHeaderForm] = useState<DprHeaderForm>(defaultDprHeader());
  const selectedDprWorkPackage = useMemo(
    () => workPackages.find((w) => String(w.id) === dprHeaderForm.workPackageId),
    [workPackages, dprHeaderForm.workPackageId],
  );
  const [dprActivityRows, setDprActivityRows] = useState<DprActivityRow[]>([emptyDprActivityRow()]);
  const [dprProgressHints, setDprProgressHints] = useState<Record<string, DprProgressSummary>>({});
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
  const [wpEditingId, setWpEditingId] = useState<string | null>(null);
  const [wpSaving, setWpSaving] = useState(false);
  const [wpDialogError, setWpDialogError] = useState('');
  const [planningSaving, setPlanningSaving] = useState(false);
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
  const [assigningContractorWpId, setAssigningContractorWpId] = useState<string | null>(null);
  const [deletingWpId, setDeletingWpId] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({ docType: 'site_photo', fileName: '', fileUrl: '' });

  const displayGovBoq = useMemo(
    () => (pendingGovBoq ? parsedBoqRowsToDisplayItems(pendingGovBoq.rows) : boq),
    [pendingGovBoq, boq],
  );
  const displayL1Boq = useMemo(
    () => (pendingL1BoqUpload ? parsedBoqRowsToDisplayItems(pendingL1BoqUpload.rows) : l1Boq),
    [pendingL1BoqUpload, l1Boq],
  );
  const dprBoq = useMemo(() => displayL1Boq, [displayL1Boq]);
  const boqUnitsSource = useMemo(
    () => (displayL1Boq.length > 0 ? displayL1Boq : displayGovBoq),
    [displayL1Boq, displayGovBoq],
  );
  const dprBoqUnits = useMemo(
    () => collectBoqUnits(dprBoq, dprHeaderForm.schemeType),
    [dprBoq, dprHeaderForm.schemeType],
  );
  const mbBoqUnits = useMemo(
    () => collectBoqUnits(boqUnitsSource, mbHeaderForm.schemeType),
    [boqUnitsSource, mbHeaderForm.schemeType],
  );

  const dprBoqItemsForRow = useCallback((rowComponent: string) => {
    let items = dprBoq.filter((b) => b.schemeType === dprHeaderForm.schemeType);
    const comp = rowComponent || String(selectedDprWorkPackage?.component ?? '');
    if (comp) {
      items = items.filter((b) => !b.component || String(b.component) === comp);
    }
    return items;
  }, [dprBoq, dprHeaderForm.schemeType, selectedDprWorkPackage]);

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
  const isContractorUser = !isSuperAdmin(roles) && roles.includes('contractor');
  const canSubmit = !isSuperAdmin(roles) && (hasPermission('construction:submit') || isContractorUser);
  const canApprove = !isSuperAdmin(roles) && (hasPermission('construction:approve') || roles.some((r) => ['je', 'ae', 'ee', 'accounts'].includes(r)));
  const canMeasure = !isSuperAdmin(roles) && (hasPermission('construction:measure') || roles.includes('je'));
  const canUpdate = canPerformOperational(roles, hasPermission, 'construction:update');
  const canCreate = canPerformOperational(roles, hasPermission, 'construction:create') || (!isSuperAdmin(roles) && roles.includes('ee'));
  /** Daily DPR is created and submitted only by the contractor; JE/AE/EE review after submit. */
  const canCreateDpr = isContractorUser;
  const canSubmitDpr = isContractorUser;
  const canCreateMb = canMeasure || (!isSuperAdmin(roles) && roles.includes('je'));
  const canAdminPlanning = hasOperationalRole(roles, ['se', 'ce', 'cgm', 'md', 'ee'])
    || canUpdate
    || canCreate;
  const canGenerateRa = isContractorUser;

  const contractorOwnsDpr = (dpr: Record<string, unknown>) => {
    if (!isContractorUser) return true;
    if (String(dpr.submittedBy ?? '') === String(user?.id ?? '')) return true;
    const wpId = String(dpr.workPackageId ?? '');
    return Boolean(wpId) && workPackages.some((wp) => String(wp.id) === wpId);
  };

  const visibleDprs = useMemo(
    () => (isContractorUser ? dprs.filter((d) => contractorOwnsDpr(d)) : dprs),
    [dprs, isContractorUser, user?.id, workPackages],
  );

  const filteredDprs = useMemo(() => {
    if (!dprWeatherFilter) return visibleDprs;
    return visibleDprs.filter((d) => String(d.weather ?? '') === dprWeatherFilter);
  }, [visibleDprs, dprWeatherFilter]);

  const dprTableRows = useMemo(
    () => flattenDprsForTable(filteredDprs),
    [filteredDprs],
  );

  const dprWeatherFilterOptions = useMemo(() => {
    const legacy = new Set<string>();
    for (const d of visibleDprs) {
      const w = String(d.weather ?? '');
      if (w && !DPR_WEATHER_OPTIONS.includes(w as typeof DPR_WEATHER_OPTIONS[number])) {
        legacy.add(w);
      }
    }
    return [...DPR_WEATHER_OPTIONS, ...Array.from(legacy).sort()];
  }, [visibleDprs]);

  const fetchOptional = async <T,>(request: Promise<{ data: T }>, fallback: T): Promise<T> => {
    try {
      const { data } = await request;
      return data;
    } catch {
      return fallback;
    }
  };

  const fetchOptionalTracked = async <T,>(
    label: string,
    request: Promise<{ data: T }>,
    fallback: T,
    failures: string[],
  ): Promise<T> => {
    try {
      const { data } = await request;
      return data;
    } catch {
      failures.push(label);
      return fallback;
    }
  };

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    const failures: string[] = [];
    try {
      const { data: project } = await projectsApi.get(projectId);
      setProjectName(project.name);

      const [
        overviewRes, boqRes, l1BoqRes, dprRes, mbRes, invRes,
        raData, wpData, planningData, reconData, completionData,
      ] = await Promise.all([
        fetchOptionalTracked('overview', constructionApi.overview(projectId), null, failures),
        fetchOptionalTracked('BOQ', constructionApi.boq(projectId, { boqSource: 'government' }), [], failures),
        fetchOptionalTracked('L1 BOQ', constructionApi.boq(projectId, { boqSource: 'l1_contractor' }), [], failures),
        fetchOptionalTracked('DPR list', constructionApi.listDprs(projectId), [], failures),
        fetchOptionalTracked('measurement books', constructionApi.listMbs(projectId), [], failures),
        fetchOptionalTracked('invoices', constructionApi.listInvoices(projectId), [], failures),
        fetchOptionalTracked('RA bills', constructionApi.listRaBills(projectId), [], failures),
        fetchOptionalTracked('work packages', constructionApi.workPackages(projectId), [], failures),
        fetchOptionalTracked('work planning', constructionApi.workPlanning(projectId), null, failures),
        fetchOptionalTracked('BOQ reconciliation', constructionApi.boqReconciliation(projectId), null, failures),
        fetchOptionalTracked('completion', constructionApi.completion(projectId), null, failures),
      ]);
      if (overviewRes) setOverview(overviewRes as Record<string, unknown>);
      setBoq(boqRes as Array<Record<string, unknown>>);
      setL1Boq(l1BoqRes as Array<Record<string, unknown>>);
      setDprs(dprRes as Array<Record<string, unknown>>);
      setMbs(mbRes as Array<Record<string, unknown>>);
      setInvoices(invRes as Array<Record<string, unknown>>);
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
        const secretariat = pd.secretariatSanction as SecretariatSanctionRefs | null | undefined;
        const baseForm: PlanningFormState = {
          approvedDprUrl: String(pd.approvedDprUrl ?? ''),
          adminApprovalRef: String(pd.adminApprovalRef ?? ''),
          technicalSanctionRef: String(pd.technicalSanctionRef ?? ''),
          boqUploadUrl: uploadUrl,
          l1ContractorBoqUploadUrl: l1UploadUrl,
          contractorPoUploadUrl: String(pd.contractorPoUploadUrl ?? ''),
          drawingUploadUrl: String(pd.drawingUploadUrl ?? ''),
          gisAlignmentApproved: Boolean(pd.gisAlignmentApproved),
        };
        const { form: loadedForm, autoFilled } = applySecretariatSanctionRefs(baseForm, secretariat);
        setPlanningForm(loadedForm);
        setSavedPlanningSnapshot(serializePlanningForm(loadedForm));
        if (autoFilled.length) {
          const proposalNo = secretariat?.proposalNo ? ` (${secretariat.proposalNo})` : '';
          setPlanningSecretariatMsg(
            `Auto-filled ${autoFilled.join(' and ')} from Secretariat Stage 8 sanction${proposalNo}.`,
          );
        } else {
          setPlanningSecretariatMsg('');
        }
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
      if (failures.length > 0) {
        const essentials = isContractorUser
          ? ['DPR list', 'work packages', 'L1 BOQ']
          : failures;
        const blocking = failures.filter((f) => essentials.includes(f));
        if (blocking.length > 0) {
          const loadMsg = `Could not load: ${blocking.join(', ')}. `
            + 'If DPR list failed, run migration 104 on VPS: '
            + 'bash /opt/egip/database/scripts/vps-migrate-104-dpr-progress.sh';
          if (isContractorUser) {
            setDprTabError(loadMsg);
          } else {
            setSuccess('');
            setError(loadMsg);
          }
        }
      }
    } catch (err) {
      setSuccess('');
      setError(formatApiError(err, 'Failed to load project. Check API is running.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, isContractorUser]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (isContractorUser) {
      setTab((current) => (current === 'dashboard' ? 'dpr' : current));
    }
  }, [isContractorUser, user?.id]);

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
    const hasBoqData = boq.length > 0 || Boolean(pendingGovBoq) || Boolean(planningForm.boqUploadUrl.trim());
    const hasL1BoqData = l1Boq.length > 0 || Boolean(pendingL1BoqUpload) || Boolean(planningForm.l1ContractorBoqUploadUrl.trim());
    const hasDpr = Boolean(planningForm.approvedDprUrl) || Boolean(planningLocalFiles.dpr);
    const hasDrawing = Boolean(planningForm.drawingUploadUrl) || Boolean(planningLocalFiles.drawing);
    const hasContractorPo = Boolean(planningForm.contractorPoUploadUrl) || Boolean(planningLocalFiles.contractorPo);
    const packagesAssigned = workPackages.length > 0
      && workPackages.every((wp) => isContractorFullyAssigned(wp, contractorDrafts));
    return [
      { key: 'dpr', label: 'Approved DPR Upload', done: hasDpr },
      { key: 'admin', label: 'Administrative Approval (AA)', done: Boolean(planningForm.adminApprovalRef.trim()) },
      { key: 'ts', label: 'Expenditure Sanction (ES)', done: Boolean(planningForm.technicalSanctionRef.trim()) },
      { key: 'boq', label: 'BOQ Upload', done: hasBoqData },
      { key: 'l1Boq', label: 'L1 Contractor BOQ', done: hasL1BoqData },
      { key: 'contractorPo', label: 'Contractor PO/WO Upload', done: hasContractorPo },
      { key: 'drawing', label: 'Drawing Upload', done: hasDrawing },
      { key: 'wp', label: 'Work Package Creation', done: workPackages.length > 0 },
      { key: 'contractor', label: 'Contractor Assignment', done: packagesAssigned },
      { key: 'gis', label: 'GIS Alignment Approval', done: planningForm.gisAlignmentApproved },
    ];
  }, [planningForm, boq.length, l1Boq.length, workPackages, contractorDrafts, pendingGovBoq, pendingL1BoqUpload, planningLocalFiles]);

  const checklistByKey = useMemo(
    () => Object.fromEntries(planningChecklist.map((item) => [item.key, item.done])),
    [planningChecklist],
  );

  const submitWorkflow = async (fn: () => Promise<unknown>, label: string) => {
    try {
      setDprTabError('');
      setError('');
      setSuccess('');
      await fn();
      await refresh();
    } catch (err) {
      const msg = formatApiError(err, `Failed to ${label}.`);
      if (isContractorUser) {
        setDprTabError(msg);
      } else {
        setSuccess('');
        setError(msg);
      }
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
      if (type === 'dpr' && dprDetailOpen && String(dprDetail?.id ?? '') === id) {
        const { data } = await constructionApi.getDpr(projectId, id);
        setDprDetail(data as Record<string, unknown>);
      }
      setSuccess(action === 'approve' ? 'Approved successfully.' : 'Rejected.');
    } catch (err) {
      setError(formatApiError(err, 'Workflow action failed.'));
    }
  };

  const canApproveDpr = (dpr: Record<string, unknown>) => {
    const status = String(dpr.status);
    if (WORKFLOW_DONE_STATUSES.includes(status)) return false;
    const requiredRole = STATUS_APPROVER[status];
    if (!canApprove || !requiredRole) return false;
    return !roles.includes('super_admin') && roles.includes(requiredRole);
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
    if (!canApprove || !canAct) {
      if (type === 'dpr' && requiredRole) {
        return (
          <Chip
            size="small"
            variant="outlined"
            color="warning"
            label={`Pending ${requiredRole.toUpperCase()}`}
          />
        );
      }
      return null;
    }
    if (type === 'dpr') {
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon fontSize="small" />}
            onClick={() => { void workflowAction(type, id, 'approve'); }}
          >
            Approve
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<CancelIcon fontSize="small" />}
            onClick={() => { void workflowAction(type, id, 'reject'); }}
          >
            Reject
          </Button>
        </Stack>
      );
    }
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
    setDprProgressHints({});
    setDprPhotos([]);
    setGpsCapturingKey(null);
    setDprFormError('');
  };

  const openNewDprDialog = () => {
    resetDprForm();
    const header = defaultDprHeader();
    let activityRows = [emptyDprActivityRow()];
    if (isContractorUser && user) {
      const wpContractor = workPackages.length === 1
        ? String(workPackages[0].contractorName ?? '').trim()
        : '';
      header.contractorName = wpContractor
        || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
        || user.email;
    }
    if (workPackages.length === 1) {
      const wp = workPackages[0];
      header.workPackageId = String(wp.id);
      if (!header.workLocation) header.workLocation = String(wp.name ?? '');
      if (dprBoq.length) {
        const prefilled = prefillDprActivitiesFromWp(wp, dprBoq, header.schemeType);
        if (prefilled.length) activityRows = prefilled;
      }
    }
    setDprHeaderForm(header);
    setDprActivityRows(activityRows);
    setDprDialog(true);
  };

  const canEditDpr = (dpr: Record<string, unknown>) => {
    const status = String(dpr.status);
    if (status !== 'draft' && status !== 'rejected') return false;
    if (!canSubmitDpr) return false;
    return contractorOwnsDpr(dpr);
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
      const wpId = String(d.workPackageId ?? '');
      const wp = workPackages.find((w) => String(w.id) === wpId);
      const schemeType = (d.schemeType as SchemeType) ?? 'gravity';
      let activityRows: DprActivityRow[];
      if (acts.length) {
        activityRows = acts.map((act) => ({
          key: emptyDprActivityRow().key,
          description: String(act.description ?? ''),
          unit: String(act.unit ?? 'cum'),
          quantityDone: Number(act.quantityDone ?? 0),
          progressMode: (String(act.progressMode ?? '') as DprActivityRow['progressMode'])
            || (isWholeJobMeasurement(String(act.progressMode ?? ''), String(act.unit ?? '')) ? 'whole_job' : 'discrete_qty'),
          progressPctToday: Number(act.progressPctToday ?? 0),
          workDoneToday: String(act.workDoneToday ?? act.description ?? ''),
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
        }));
      } else if (wp && dprBoq.length) {
        activityRows = prefillAllDprActivitiesFromWp(wp, dprBoq, schemeType);
      } else {
        activityRows = [emptyDprActivityRow()];
      }
      setDprActivityRows(activityRows);
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
        setError('');
      },
      (err) => {
        setGpsCapturingKey(null);
        setSuccess('');
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

  const refreshDprProgressHint = async (row: DprActivityRow) => {
    if (!projectId || !row.boqItemId) return;
    try {
      const { data } = await constructionApi.dprProgressSummary(projectId, {
        boqItemId: row.boqItemId,
        workPackageId: dprHeaderForm.workPackageId || undefined,
        chainageFrom: row.chainageFrom || undefined,
        chainageTo: row.chainageTo || undefined,
        reportDate: dprHeaderForm.reportDate,
      });
      setDprProgressHints((prev) => ({ ...prev, [row.key]: data as DprProgressSummary }));
    } catch {
      setDprProgressHints((prev) => {
        const next = { ...prev };
        delete next[row.key];
        return next;
      });
    }
  };

  const handleSaveDpr = async () => {
    const payload = buildDprPayload(dprHeaderForm, dprActivityRows, dprBoq);
    if (!payload.dprNumber.trim()) {
      setError('DPR number is required.');
      return;
    }
    if (!payload.activities.length) {
      setError('Add at least one work item with a description.');
      return;
    }
    if (payload.activities.some((a) => !a.boqItemId)) {
      const msg = 'Select an L1 BOQ item for each work line.';
      if (isContractorUser) {
        setDprFormError(msg);
      } else {
        setError(msg);
      }
      return;
    }
    try {
      setDprFormError('');
      setDprTabError('');
      setError('');
      const { data } = editingDprId
        ? await constructionApi.updateDpr(projectId, editingDprId, payload)
        : await constructionApi.createDpr(projectId, payload);
      const dprId = String((data as Record<string, unknown>).id);
      if (dprPhotos.length) {
        try {
          await uploadDprPhotos(dprId);
        } catch (photoErr) {
          setError(formatApiError(photoErr, 'DPR saved but photo upload failed.'));
        }
      }
      setDprDialog(false);
      resetDprForm();
      if (!isContractorUser) {
        setSuccess(editingDprId ? 'DPR updated.' : 'Daily progress report saved.');
      }
      await refresh();
    } catch (err) {
      const msg = formatApiError(err, 'Failed to save DPR.');
      if (isContractorUser) {
        setDprFormError(msg);
      } else {
        setSuccess('');
        setError(msg);
      }
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
    if (!projectId) return;
    setPlanningSaving(true);
    setError('');
    try {
      let nextForm: PlanningFormState = { ...planningForm };

      if (planningLocalFiles.dpr) {
        const { data } = await constructionApi.uploadPlanningFile(projectId, 'dpr', planningLocalFiles.dpr);
        nextForm = { ...nextForm, approvedDprUrl: String(data.fileUrl) };
      }
      if (planningLocalFiles.drawing) {
        const { data } = await constructionApi.uploadPlanningFile(projectId, 'drawings', planningLocalFiles.drawing);
        nextForm = { ...nextForm, drawingUploadUrl: String(data.fileUrl) };
      }
      if (planningLocalFiles.contractorPo) {
        const { data } = await constructionApi.uploadPlanningFile(projectId, 'contractor-po', planningLocalFiles.contractorPo);
        nextForm = { ...nextForm, contractorPoUploadUrl: String(data.fileUrl) };
      }

      if (pendingGovBoq) {
        const { data } = await constructionApi.importBoq(projectId, {
          fileName: pendingGovBoq.fileName,
          replaceExisting: true,
          boqSource: 'government',
          items: toImportPayload(pendingGovBoq.rows),
        });
        const savedName = String(data.fileName ?? pendingGovBoq.fileName);
        nextForm = { ...nextForm, boqUploadUrl: planningUploadPath('boq', savedName) };
        setBoqFileName(savedName);
        if (Array.isArray(data.items)) setBoq(data.items as Array<Record<string, unknown>>);
      }
      if (pendingL1BoqUpload) {
        const { data } = await constructionApi.importBoq(projectId, {
          fileName: pendingL1BoqUpload.fileName,
          replaceExisting: true,
          boqSource: 'l1_contractor',
          items: toImportPayload(pendingL1BoqUpload.rows),
        });
        const savedName = String(data.fileName ?? pendingL1BoqUpload.fileName);
        nextForm = { ...nextForm, l1ContractorBoqUploadUrl: planningUploadPath('boq-l1', savedName) };
        setL1BoqFileName(savedName);
        if (Array.isArray(data.items)) setL1Boq(data.items as Array<Record<string, unknown>>);
      }

      await constructionApi.updateWorkPlanning(projectId, {
        ...nextForm,
        status: 'draft',
      });

      const newLogins: ContractorLoginInfo[] = [];
      const provisionErrors: string[] = [];
      for (const wp of workPackages) {
        const wpId = String(wp.id);
        const contractorName = contractorDrafts[wpId]?.trim();
        if (!needsContractorProvision(wp, contractorName)) continue;
        try {
          const { data } = await constructionApi.updateWorkPackage(projectId, wpId, { contractorName });
          const saved = data as Record<string, unknown>;
          const login = parseContractorLogin(data) ?? contractorLoginFromWorkPackage(saved);
          if (login) {
            newLogins.push(login);
          } else if (!saved.contractorId) {
            provisionErrors.push(
              `${String(wp.packageCode ?? wpId)}: login was not created — check contractor role and EE permissions (migration 102).`,
            );
          }
        } catch (err) {
          provisionErrors.push(`${String(wp.packageCode ?? wpId)}: ${formatApiError(err)}`);
        }
      }
      if (provisionErrors.length) {
        throw new Error(provisionErrors.join(' '));
      }

      setPlanningForm(nextForm);
      setSavedPlanningSnapshot(serializePlanningForm(nextForm));
      setPendingGovBoq(null);
      setPendingL1BoqUpload(null);
      setPlanningLocalFiles({});
      if (planningDraftStorageKey) sessionStorage.removeItem(planningDraftStorageKey);

      const doneCount = [
        Boolean(nextForm.approvedDprUrl),
        Boolean(nextForm.adminApprovalRef.trim()),
        Boolean(nextForm.technicalSanctionRef.trim()),
        Boolean(pendingGovBoq || boq.length > 0 || nextForm.boqUploadUrl.trim()),
        Boolean(pendingL1BoqUpload || l1Boq.length > 0 || nextForm.l1ContractorBoqUploadUrl.trim()),
        Boolean(nextForm.contractorPoUploadUrl),
        Boolean(nextForm.drawingUploadUrl),
        workPackages.length > 0,
        workPackages.length > 0 && workPackages.every((wp) => isContractorFullyAssigned(wp, contractorDrafts)),
        nextForm.gisAlignmentApproved,
      ].filter(Boolean).length;
      const loginNote = newLogins.length
        ? ` Contractor login${newLogins.length > 1 ? 's' : ''} created.`
        : '';
      setSuccess(`Work planning saved (${doneCount}/10 items stored).${loginNote}`);
      scrollToTopForFeedback();
      await refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to save work planning.'));
      scrollToTopForFeedback();
    } finally {
      setPlanningSaving(false);
    }
  };

  const openNewWorkPackageDialog = () => {
    setWpEditingId(null);
    setWpDialogError('');
    setWpForm({
      packageCode: '', name: '', component: 'gravity_main',
      schemeType: 'gravity', contractorName: '', chainageFrom: '', chainageTo: '',
    });
    setWpDialog(true);
  };

  const openEditWorkPackageDialog = (wp: Record<string, unknown>) => {
    setWpEditingId(String(wp.id));
    setWpDialogError('');
    setWpForm({
      packageCode: String(wp.packageCode ?? ''),
      name: String(wp.name ?? ''),
      component: (String(wp.component ?? 'gravity_main') as ProjectComponent),
      schemeType: (String(wp.schemeType ?? 'gravity') as SchemeType),
      contractorName: String(wp.contractorName ?? ''),
      chainageFrom: String(wp.chainageFrom ?? ''),
      chainageTo: String(wp.chainageTo ?? ''),
    });
    setWpDialog(true);
  };

  const handleDeleteWorkPackage = async (wp: Record<string, unknown>) => {
    if (!projectId) return;
    const wpId = String(wp.id);
    const packageCode = String(wp.packageCode ?? 'package');
    const packageName = String(wp.name ?? packageCode);
    if (!window.confirm(`Delete work package "${packageName}" (${packageCode})? This cannot be undone.`)) {
      return;
    }

    setDeletingWpId(wpId);
    setError('');
    try {
      await constructionApi.deleteWorkPackage(projectId, wpId);
      setWorkPackages((prev) => prev.filter((row) => String(row.id) !== wpId));
      setContractorDrafts((prev) => {
        const next = { ...prev };
        delete next[wpId];
        return next;
      });
      setSuccess(`Work package "${packageName}" deleted.`);
      scrollToTopForFeedback();
    } catch (err: unknown) {
      setError(formatApiError(err, 'Failed to delete work package.'));
      scrollToTopForFeedback();
    } finally {
      setDeletingWpId(null);
    }
  };

  const handleSaveWorkPackage = async () => {
    if (!projectId) {
      setWpDialogError('Project not found — reload the page and try again.');
      return;
    }
    const packageCode = wpForm.packageCode.trim();
    const name = wpForm.name.trim();
    if (!packageCode || !name) {
      setWpDialogError('Package code and package name are required.');
      return;
    }

    setWpSaving(true);
    setWpDialogError('');
    setError('');
    try {
      const contractorName = wpForm.contractorName.trim();
      const payload = {
        packageCode,
        name,
        component: wpForm.component,
        schemeType: wpForm.schemeType,
        chainageFrom: wpForm.chainageFrom.trim() || undefined,
        chainageTo: wpForm.chainageTo.trim() || undefined,
        ...(contractorName ? { contractorName } : {}),
      };
      if (wpEditingId) {
        const { data } = await constructionApi.updateWorkPackage(projectId, wpEditingId, payload);
        const saved = data as Record<string, unknown>;
        if (!parseContractorLogin(data) && contractorName && !saved.contractorId) {
          throw new Error('Contractor login was not created — check contractor role and migration 102.');
        }
        setSuccess(`Work package "${name}" updated.`);
      } else {
        const { data } = await constructionApi.createWorkPackage(projectId, payload);
        const saved = data as Record<string, unknown>;
        if (!parseContractorLogin(data) && contractorName && !saved.contractorId) {
          throw new Error('Contractor login was not created — check contractor role and migration 102.');
        }
        setSuccess(`Work package "${name}" created.`);
      }
      setWpDialog(false);
      setWpEditingId(null);
      setWpForm({
        packageCode: '', name: '', component: 'gravity_main',
        schemeType: 'gravity', contractorName: '', chainageFrom: '', chainageTo: '',
      });
      await refresh();
    } catch (err) {
      const message = formatApiError(err, wpEditingId ? 'Failed to update work package.' : 'Failed to create work package.');
      setWpDialogError(message);
      setError(message);
    } finally {
      setWpSaving(false);
    }
  };

  const handleAssignContractor = async (wpId: string) => {
    const wp = workPackages.find((row) => String(row.id) === wpId);
    const contractorName = (contractorDrafts[wpId] ?? String(wp?.contractorName ?? '')).trim();
    if (!contractorName) {
      setError('Enter the contractor firm name before saving.');
      scrollToTopForFeedback();
      return;
    }
    if (wp && !needsContractorProvision(wp, contractorName)) {
      setSuccess(`Contractor "${contractorName}" is already assigned.`);
      scrollToTopForFeedback();
      return;
    }
    setAssigningContractorWpId(wpId);
    setError('');
    setSuccess('');
    try {
      const { data } = await constructionApi.updateWorkPackage(projectId, wpId, { contractorName });
      const saved = data as Record<string, unknown>;
      const login = parseContractorLogin(data)
        ?? contractorLoginFromWorkPackage(saved);
      if (!login && !saved.contractorId) {
        throw new Error(
          'Contractor login was not created. Ensure migration 102 is applied (EE needs construction:update) and the contractor role exists.',
        );
      }
      await refresh();
      setSuccess(`Contractor "${contractorName}" saved.`);
      scrollToTopForFeedback();
    } catch (err) {
      setError(formatApiError(err, 'Failed to assign contractor.'));
      scrollToTopForFeedback();
    } finally {
      setAssigningContractorWpId(null);
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

      {error && !isContractorUser && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && !isContractorUser && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={styledTabsSx()}>
        {!isContractorUser && <Tab value="dashboard" label="Dashboard" />}
        {!isContractorUser && <Tab value="planning" label="Work Planning" />}
        <Tab value="dpr" label="Daily Progress" />
        {!isContractorUser && <Tab value="mb" label="Measurement Book" />}
        {!isContractorUser && <Tab value="reconciliation" label="BOQ Reconciliation" />}
        {(!isContractorUser || canGenerateRa) && <Tab value="ra-bills" label="RA Bills" />}
        {!isContractorUser && <Tab value="final" label="Final Bill" />}
        {!isContractorUser && <Tab value="gis" label="GIS Assets" />}
        {!isContractorUser && <Tab value="reports" label="Reports" />}
      </Tabs>

      {tab === 'dashboard' && (
        <ConstructionDashboardPanel projectId={projectId} onError={setError} />
      )}

      {tab === 'planning' && (
        <Grid container spacing={2}>
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
                          ? <CheckCircleIcon color="success" fontSize="small" />
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
                    done={checklistByKey.dpr}
                    disabled={!canAdminPlanning}
                    onPick={(file) => {
                      setPlanningLocalFiles((prev) => ({ ...prev, dpr: file }));
                      setPlanningForm((prev) => ({
                        ...prev,
                        approvedDprUrl: planningUploadPath('dpr', file.name),
                      }));
                    }}
                  />
                  {planningSecretariatMsg && (
                    <Alert severity="info" sx={{ py: 0.25 }}>{planningSecretariatMsg}</Alert>
                  )}
                  <TextField
                    label="2. Administrative Approval (AA) Ref"
                    placeholder="e.g. ADM/2024/WS-001"
                    value={planningForm.adminApprovalRef}
                    onChange={(e) => {
                      setPlanningSecretariatMsg('');
                      setPlanningForm({ ...planningForm, adminApprovalRef: e.target.value });
                    }}
                    disabled={!canAdminPlanning}
                    helperText="Auto-filled from Secretariat Stage 8 sanction when recorded"
                  />
                  <TextField
                    label="3. Expenditure Sanction (ES) Ref"
                    placeholder="e.g. ES/2024/WS-045"
                    value={planningForm.technicalSanctionRef}
                    onChange={(e) => {
                      setPlanningSecretariatMsg('');
                      setPlanningForm({ ...planningForm, technicalSanctionRef: e.target.value });
                    }}
                    disabled={!canAdminPlanning}
                    helperText="Auto-filled from Secretariat Stage 8 sanction when recorded"
                  />
                  <BoqUploadField
                    label="4. BOQ Upload (Excel) — Original / Tender BOQ"
                    fileName={boqFileName}
                    file={planningLocalFiles.boq}
                    done={checklistByKey.boq}
                    disabled={!canAdminPlanning}
                    importing={boqImporting}
                    onUpload={handleBoqUpload}
                  />
                  <BoqUploadField
                    label="5. L1 Contractor BOQ (Excel)"
                    fileName={l1BoqFileName}
                    file={planningLocalFiles.l1Boq}
                    done={checklistByKey.l1Boq}
                    disabled={!canAdminPlanning}
                    importing={l1BoqImporting}
                    onUpload={handleL1BoqUpload}
                  />
                  <PlanningFileField
                    label="6. Contractor PO/WO Upload"
                    value={planningForm.contractorPoUploadUrl}
                    file={planningLocalFiles.contractorPo}
                    done={checklistByKey.contractorPo}
                    disabled={!canAdminPlanning}
                    onPick={(file) => {
                      setPlanningLocalFiles((prev) => ({ ...prev, contractorPo: file }));
                      setPlanningForm((prev) => ({
                        ...prev,
                        contractorPoUploadUrl: planningUploadPath('contractor-po', file.name),
                      }));
                    }}
                  />
                  <PlanningFileField
                    label="7. Drawing Upload"
                    value={planningForm.drawingUploadUrl}
                    file={planningLocalFiles.drawing}
                    done={checklistByKey.drawing}
                    disabled={!canAdminPlanning}
                    onPick={(file) => {
                      setPlanningLocalFiles((prev) => ({ ...prev, drawing: file }));
                      setPlanningForm((prev) => ({
                        ...prev,
                        drawingUploadUrl: planningUploadPath('drawings', file.name),
                      }));
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
                    <Button
                      variant="contained"
                      disabled={planningSaving}
                      onClick={() => { void handleSavePlanning(); }}
                    >
                      {planningSaving ? 'Saving…' : 'Save Planning'}
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined" sx={{ height: 'auto', overflow: 'visible' }}>
              <CardContent sx={{ overflow: 'visible', pt: 2 }}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={1.5}
                  gap={2}
                  sx={constructionSectionBarSx('planning')}
                >
                  <Typography variant="subtitle1" fontWeight={700} color={constructionTableTheme('planning').headerColor}>
                    6. Work Packages & 7. Contractor Assignment
                  </Typography>
                  {canAdminPlanning && (
                    <Button
                      startIcon={<AddIcon />} size="small" variant="contained"
                      onClick={openNewWorkPackageDialog}
                    >
                      New Package
                    </Button>
                  )}
                </Box>
                <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ ...constructionTableShellSx('planning'), minWidth: 920 }}>
                  <ConstructionTableHead
                    stage="planning"
                    columns={[
                      { label: 'Code', minWidth: 72 },
                      { label: 'Name', minWidth: 140 },
                      { label: 'Component', minWidth: 160 },
                      { label: 'Chainage', minWidth: 120 },
                      { label: 'Contractor', minWidth: 260 },
                      { label: 'GIS', minWidth: 88 },
                      { label: 'Status', minWidth: 88 },
                      { label: 'Actions', minWidth: 88, align: 'center' },
                    ]}
                  />
                  <TableBody>
                    {workPackages.map((wp) => {
                      const wpId = String(wp.id);
                      const contractorDraft = contractorDrafts[wpId] ?? String(wp.contractorName ?? '');
                      const contractorPending = needsContractorProvision(wp, contractorDraft);
                      const contractorAssigned = Boolean(wp.contractorId) && !contractorPending;
                      return (
                        <TableRow key={wpId} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {String(wp.packageCode)}
                          </TableCell>
                          <TableCell>{String(wp.name ?? '—')}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={COMPONENT_LABELS[wp.component as ProjectComponent] ?? String(wp.component)}
                              sx={{ maxWidth: '100%' }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {String(wp.chainageFrom ?? '—')} – {String(wp.chainageTo ?? '—')}
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={0.75} alignItems="center">
                              <TextField
                                size="small"
                                placeholder="Contractor firm name"
                                value={contractorDraft}
                                onChange={(e) => setContractorDrafts({ ...contractorDrafts, [wpId]: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && canAdminPlanning && contractorPending) {
                                    e.preventDefault();
                                    void handleAssignContractor(wpId);
                                  }
                                }}
                                disabled={!canAdminPlanning || assigningContractorWpId === wpId}
                                sx={{ flex: 1, minWidth: 160 }}
                              />
                              {canAdminPlanning && contractorPending && contractorDraft.trim() && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  disableElevation
                                  disabled={assigningContractorWpId === wpId}
                                  onClick={() => { void handleAssignContractor(wpId); }}
                                  sx={{ minWidth: 64, flexShrink: 0 }}
                                >
                                  {assigningContractorWpId === wpId ? '…' : 'Save'}
                                </Button>
                              )}
                              {contractorAssigned && (
                                <Tooltip title="Contractor assigned">
                                  <CheckCircleIcon color="success" fontSize="small" sx={{ flexShrink: 0 }} />
                                </Tooltip>
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
                          <TableCell align="center">
                            {canAdminPlanning && (
                              <Stack direction="row" spacing={0.25} justifyContent="center">
                                <Tooltip title="Edit package">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => openEditWorkPackageDialog(wp)}
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete package">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={deletingWpId === wpId}
                                    onClick={() => { void handleDeleteWorkPackage(wp); }}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!workPackages.length && (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No work packages yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </Box>
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
          {dprTabError && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {dprTabError}
            </Typography>
          )}
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
          <Box display="flex" gap={1} flexWrap="wrap" mb={2} alignItems="center">
            {DPR_WORKFLOW_SEQUENCE.map((step) => {
              const stepActive = filteredDprs.some((d) => String(d.status) === step.status);
              return (
                <Chip
                  key={step.status}
                  size="small"
                  variant={stepActive ? 'filled' : 'outlined'}
                  color={stepActive ? 'warning' : 'default'}
                  label={`${step.step}. ${step.label}`}
                  sx={constructionWorkflowChipSx('dpr')}
                />
              );
            })}
            <Box sx={{ ml: 'auto', minWidth: 160 }}>
              <TextField
                select
                size="small"
                label="Filter by weather"
                value={dprWeatherFilter}
                onChange={(e) => setDprWeatherFilter(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">All weather</MenuItem>
                {dprWeatherFilterOptions.map((option) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ ...constructionTableShellSx('dpr'), minWidth: 1100 }}>
            <ConstructionTableHead
              stage="dpr"
              columns={[
                { label: 'DPR #' },
                { label: 'Date' },
                { label: 'Location' },
                { label: 'Chainage' },
                { label: 'BOQ Item (L1)', minWidth: 200 },
                { label: 'Unit', align: 'center' as const, minWidth: 48 },
                { label: 'Planned', align: 'right' as const, minWidth: 72 },
                { label: 'Today', align: 'right' as const, minWidth: 64 },
                { label: 'Actual', align: 'right' as const, minWidth: 72 },
                { label: 'Balance', align: 'right' as const, minWidth: 72 },
                { label: '% Done', align: 'right' as const, minWidth: 88 },
                { label: 'Contractor' },
                { label: 'Supervisor' },
                { label: 'Weather', minWidth: 80 },
                { label: 'Workflow', minWidth: 120 },
                { label: 'Actions', minWidth: 280 },
              ]}
            />
            <TableBody>
              {dprTableRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={16}>
                    <Typography variant="body2" color="text.secondary">
                      {dprWeatherFilter
                        ? 'No daily progress reports match the selected weather filter.'
                        : isContractorUser
                          ? 'No daily progress reports yet — click New DPR to submit today\'s work.'
                          : 'No daily progress reports yet.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {dprTableRows.map(({ dpr, act, actIndex, actCount }) => {
                const boqRef = resolveL1BoqItem(
                  act ? String(act.boqItemId ?? '') : '',
                  act ? String(act.activityCode ?? '') : '',
                  dprBoq,
                  boq,
                );
                const plannedQty = boqRef
                  ? Number(boqRef.revisedQty ?? boqRef.contractQty ?? 0) || null
                  : (act?.plannedQty != null ? Number(act.plannedQty) : null);
                const summary = dprActivitySummaryForActivity(dpr, act, plannedQty);
                const status = String(dpr.status);
                const isEditable = canEditDpr(dpr);
                const dprId = String(dpr.id);
                const rowKey = act ? `${dprId}-${String(act.id ?? actIndex)}` : dprId;
                const span = actCount;
                return (
                  <TableRow key={rowKey}>
                    {actIndex === 0 && (
                      <>
                        <TableCell rowSpan={span}>{String(dpr.dprNumber)}</TableCell>
                        <TableCell rowSpan={span}>{String(dpr.reportDate)}</TableCell>
                      </>
                    )}
                    <TableCell>{summary.location}</TableCell>
                    <TableCell>{summary.chainage}</TableCell>
                    <TableCell>
                      <DprWorkItemCell
                        itemCode={boqRef ? String(boqRef.itemCode ?? '') : undefined}
                        description={summary.workItem}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight={700} color="text.secondary">
                        {summary.billing.unit}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <DprTableQtyCell value={summary.billing.plannedQty} />
                    </TableCell>
                    <TableCell align="right">
                      <DprTableQtyCell value={summary.billing.todayQty} variant="today" />
                    </TableCell>
                    <TableCell align="right">
                      <DprTableQtyCell value={summary.billing.cumQty} />
                    </TableCell>
                    <TableCell align="right">
                      <DprTableQtyCell value={summary.billing.remainingQty} variant="balance" />
                    </TableCell>
                    <TableCell align="right">
                      <DprBoqProgressCell
                        plannedQty={summary.billing.plannedQty}
                        cumQty={summary.billing.cumQty}
                        cumPct={summary.billing.cumPct}
                      />
                    </TableCell>
                    {actIndex === 0 && (
                      <>
                        <TableCell rowSpan={span}>{String(dpr.contractorName ?? '—')}</TableCell>
                        <TableCell rowSpan={span}>{String(dpr.supervisorName ?? '—')}</TableCell>
                        <TableCell rowSpan={span}>
                          {dpr.weather
                            ? <Chip size="small" label={String(dpr.weather)} variant="outlined" />
                            : '—'}
                        </TableCell>
                        <TableCell rowSpan={span}>
                          <StatusChip status={status} label={dprWorkflowStepLabel(status)} />
                        </TableCell>
                        <TableCell rowSpan={span}>
                          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="nowrap">
                            <Button
                              size="small" variant="text" startIcon={<VisibilityIcon fontSize="small" />}
                              onClick={() => { void viewDprDetail(dprId); }}
                            >
                              View
                            </Button>
                            {canSubmitDpr && isEditable && (
                              <Button
                                size="small" variant="outlined"
                                onClick={() => { void loadDprForEdit(dprId); }}
                              >
                                Edit
                              </Button>
                            )}
                            {canSubmitDpr && isEditable && (
                              <Button
                                size="small" variant="contained"
                                onClick={() => { void submitWorkflow(() => constructionApi.submitDpr(projectId, dprId), 'submit DPR'); }}
                              >
                                {status === 'rejected' ? 'Resubmit' : 'Submit to JE'}
                              </Button>
                            )}
                            {!isEditable && <ApprovalButtons type="dpr" id={dprId} status={status} />}
                          </Stack>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </Box>
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
          {editingDprId ? 'Edit Daily Progress Report' : 'New Daily Progress Report — Contractor'}
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
          {dprFormError && <Alert severity="error" sx={{ mb: 0 }}>{dprFormError}</Alert>}
          <Typography variant="subtitle2" fontWeight={700}>Contractor — Daily Progress</Typography>
          {dprBoq.length === 0 && (
            <Alert severity="warning">
              Upload <strong>L1 Contractor BOQ</strong> in Work Planning first. DPR planned qty, actual, and remaining use L1 BOQ only (not government tender BOQ).
            </Alert>
          )}
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
                  workLocation: wp && !dprHeaderForm.workLocation
                    ? String(wp.name ?? '')
                    : dprHeaderForm.workLocation,
                });
                if (wp) {
                  setDprActivityRows((rows) => rows.map((r) => {
                    const next = {
                      ...r,
                      component: (String(wp.component ?? r.component) as ProjectComponent),
                      chainageFrom: String(wp.chainageFrom ?? r.chainageFrom),
                      chainageTo: String(wp.chainageTo ?? r.chainageTo),
                    };
                    if (!r.boqItemId && dprBoq.length) {
                      const matches = findL1BoqForComponent(
                        dprBoq,
                        String(wp.component ?? ''),
                        dprHeaderForm.schemeType,
                      );
                      const first = matches[0];
                      if (first) return activityRowFromBoqAndWp(first, wp);
                    }
                    return next;
                  }));
                }
                dprActivityRows.forEach((r) => {
                  if (r.boqItemId) void refreshDprProgressHint({ ...r, ...(wp ? {
                    component: String(wp.component ?? r.component) as ProjectComponent,
                    chainageFrom: String(wp.chainageFrom ?? r.chainageFrom),
                    chainageTo: String(wp.chainageTo ?? r.chainageTo),
                  } : {}) });
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
              InputProps={{ readOnly: isContractorUser }}
              helperText={isContractorUser ? 'Filled from your contractor login' : undefined}
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
              select
              label="Weather"
              sx={{ flex: 1, minWidth: 140 }}
              value={dprHeaderForm.weather}
              onChange={(e) => setDprHeaderForm({ ...dprHeaderForm, weather: e.target.value })}
            >
              {DPR_WEATHER_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
              {dprHeaderForm.weather
                && !DPR_WEATHER_OPTIONS.includes(dprHeaderForm.weather as typeof DPR_WEATHER_OPTIONS[number])
                ? <MenuItem value={dprHeaderForm.weather}>{dprHeaderForm.weather}</MenuItem>
                : null}
            </TextField>
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
                    {PROJECT_COMPONENT_ORDER.map((k) => (
                      <MenuItem key={k} value={k}>{COMPONENT_LABELS[k]}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select label="BOQ Item (L1 Contractor)" sx={{ flex: 1, minWidth: 160 }}
                    value={row.boqItemId}
                    onChange={(e) => {
                      const item = dprBoq.find((b) => String(b.id) === e.target.value);
                      const wholeJob = isWholeJobMeasurement(
                        String(item?.measurementMode ?? ''),
                        String(item?.unit ?? ''),
                      );
                      const nextRow = {
                        ...row,
                        boqItemId: e.target.value,
                        description: row.description || (item ? String(item.description) : ''),
                        unit: item ? String(item.unit) : row.unit,
                        progressMode: wholeJob ? 'whole_job' as const : 'discrete_qty' as const,
                        quantityDone: 0,
                        progressPctToday: 0,
                      };
                      updateDprActivityRow(row.key, {
                        boqItemId: nextRow.boqItemId,
                        description: nextRow.description,
                        unit: nextRow.unit,
                        progressMode: nextRow.progressMode,
                        quantityDone: 0,
                        progressPctToday: 0,
                      });
                      void refreshDprProgressHint(nextRow);
                    }}
                  >
                    <MenuItem value="">— None —</MenuItem>
                    {dprBoqItemsForRow(String(row.component)).map((b) => (
                      <MenuItem key={String(b.id)} value={String(b.id)}>
                        {String(b.itemCode)} · {String(b.contractQty)} {String(b.unit)}
                        {' — '}{String(b.description).slice(0, 36)}
                        {isWholeJobMeasurement(String(b.measurementMode ?? ''), String(b.unit ?? '')) ? ' (Job)' : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                {row.boqItemId && (() => {
                  const boqRef = dprBoq.find((b) => String(b.id) === row.boqItemId);
                  if (!boqRef) return null;
                  return (
                    <Typography variant="caption" color="text.secondary" display="block">
                      As per L1 Contractor BOQ: <strong>{String(boqRef.itemCode)}</strong>
                      {' · sanctioned '}{String(boqRef.contractQty)} {String(boqRef.unit)}
                      {boqRef.component
                        ? ` · ${COMPONENT_LABELS[boqRef.component as ProjectComponent] ?? boqRef.component}`
                        : ''}
                    </Typography>
                  );
                })()}
                <Box display="flex" gap={1} flexWrap="wrap">
                  <TextField
                    label="Chainage From" placeholder="0+000" sx={{ flex: 1, minWidth: 120 }}
                    value={row.chainageFrom}
                    onChange={(e) => {
                      updateDprActivityRow(row.key, { chainageFrom: e.target.value });
                      void refreshDprProgressHint({ ...row, chainageFrom: e.target.value });
                    }}
                  />
                  <TextField
                    label="Chainage To" placeholder="0+500" sx={{ flex: 1, minWidth: 120 }}
                    value={row.chainageTo}
                    onChange={(e) => {
                      updateDprActivityRow(row.key, { chainageTo: e.target.value });
                      void refreshDprProgressHint({ ...row, chainageTo: e.target.value });
                    }}
                  />
                  {isWholeJobMeasurement(row.progressMode, row.unit) && row.boqItemId && dprProgressHints[row.key] ? (
                    <>
                      <TextField
                        select
                        required
                        label="Qty executed today"
                        sx={{ flex: 1, minWidth: 160 }}
                        value={row.quantityDone}
                        onChange={(e) => {
                          const qty = Number(e.target.value);
                          const hint = dprProgressHints[row.key];
                          const frozen = frozenProgressFromRow(qty, hint);
                          updateDprActivityRow(row.key, {
                            quantityDone: qty,
                            progressPctToday: frozen.boqPctToday,
                          });
                        }}
                        helperText={(() => {
                          const hint = dprProgressHints[row.key];
                          const scopeCap = Number(hint.scopeSanctionedQty ?? hint.sanctionedQty ?? 0);
                          const scopeDone = Number(hint.scopeContributionQty ?? 0);
                          const scopeBal = Math.max(0, scopeCap - scopeDone);
                          return `Select qty (max ${formatProgressQty(scopeBal)} ${row.unit}) — % freezes automatically`;
                        })()}
                      >
                        {wholeJobQtySelectOptions(
                          Math.max(0, Number(dprProgressHints[row.key].scopeSanctionedQty ?? dprProgressHints[row.key].sanctionedQty ?? 0)
                            - Number(dprProgressHints[row.key].scopeContributionQty ?? 0)),
                        ).map((q) => (
                          <MenuItem key={q} value={q}>
                            {formatProgressQty(q)} {row.unit}
                            {q === 1 ? ' — full Job' : ''}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Scheme % (frozen)"
                        sx={{ flex: 1, minWidth: 120 }}
                        value={`${frozenProgressFromRow(row.quantityDone, dprProgressHints[row.key]).boqPctToday}%`}
                        InputProps={{ readOnly: true }}
                        disabled
                        helperText="of full BOQ line"
                      />
                      {frozenProgressFromRow(row.quantityDone, dprProgressHints[row.key]).jobPctToday != null && (
                        <TextField
                          label="% of this Job (frozen)"
                          sx={{ flex: 1, minWidth: 140 }}
                          value={`${frozenProgressFromRow(row.quantityDone, dprProgressHints[row.key]).jobPctToday}%`}
                          InputProps={{ readOnly: true }}
                          disabled
                          helperText="physical progress on this Job"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <TextField
                        type="number"
                        required
                        label="Quantity executed today"
                        sx={{ flex: 1, minWidth: 140 }}
                        inputProps={{ min: 0, step: 0.001 }}
                        value={row.quantityDone}
                        onChange={(e) => {
                          const qty = Number(e.target.value);
                          const hint = dprProgressHints[row.key];
                          const boqSanctioned = Number(hint?.sanctionedQty ?? 0);
                          updateDprActivityRow(row.key, {
                            quantityDone: qty,
                            progressPctToday: boqSanctioned > 0 ? pctFromQty(qty, boqSanctioned) : 0,
                          });
                        }}
                        helperText={row.boqItemId && dprProgressHints[row.key]
                          ? (() => {
                            const hint = dprProgressHints[row.key];
                            const scopeCap = Number(hint.scopeSanctionedQty ?? hint.sanctionedQty ?? 0);
                            const scopeDone = Number(hint.scopeContributionQty ?? hint.cumulativeQty ?? 0);
                            const scopeBal = Math.max(0, scopeCap - scopeDone);
                            return scopeCap > 0
                              ? `Max today: ${formatProgressQty(scopeBal)} ${row.unit || ''}`
                              : undefined;
                          })()
                          : undefined}
                      />
                      {row.boqItemId && dprProgressHints[row.key] && Number(dprProgressHints[row.key].sanctionedQty) > 0 && (
                        <TextField
                          label="% of BOQ line (frozen)"
                          sx={{ flex: 1, minWidth: 140 }}
                          value={`${pctFromQty(row.quantityDone, Number(dprProgressHints[row.key].sanctionedQty))}%`}
                          InputProps={{ readOnly: true }}
                          disabled
                          helperText="remaining = planned − actual"
                        />
                      )}
                    </>
                  )}
                  {isWholeJobMeasurement(row.progressMode, row.unit)
                    && row.quantityDone > 0
                    && dprProgressHints[row.key]
                    && frozenProgressFromRow(row.quantityDone, dprProgressHints[row.key]).locationComplete && (
                    <Chip
                      size="small"
                      color="success"
                      icon={<CheckCircleIcon />}
                      label={`${formatProgressQty(row.quantityDone)} ${row.unit} — location 100% frozen`}
                      sx={{ alignSelf: 'flex-start' }}
                    />
                  )}
                  <TextField
                    select label="Unit" sx={{ flex: 1, minWidth: 100 }}
                    value={row.unit}
                    onChange={(e) => updateDprActivityRow(row.key, { unit: e.target.value })}
                    helperText={dprBoqUnits.length === 0 ? 'Upload L1 Contractor BOQ in Work Planning' : undefined}
                  >
                    <MenuItem value="">— Select —</MenuItem>
                    {boqUnitOptions(dprBoqUnits, row.unit).map((u) => (
                      <MenuItem key={u} value={u}>{u}</MenuItem>
                    ))}
                  </TextField>
                </Box>
                {row.boqItemId && dprProgressHints[row.key] && (
                  <DprPlannedVsActualPanel
                    hint={dprProgressHints[row.key]}
                    todayQty={row.quantityDone}
                    unit={row.unit}
                  />
                )}
                <TextField
                  fullWidth
                  label="Work done today"
                  placeholder="Describe physical progress completed today"
                  value={row.workDoneToday}
                  onChange={(e) => updateDprActivityRow(row.key, { workDoneToday: e.target.value })}
                />

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

      <DprDetailDialog
        open={dprDetailOpen}
        onClose={() => setDprDetailOpen(false)}
        projectId={projectId}
        dpr={dprDetail}
        canEdit={dprDetail ? canEditDpr(dprDetail) : false}
        onEdit={() => {
          const id = String(dprDetail?.id ?? '');
          if (!id) return;
          setDprDetailOpen(false);
          void loadDprForEdit(id);
        }}
        canApprove={dprDetail ? canApproveDpr(dprDetail) : false}
        onApprove={() => {
          const id = String(dprDetail?.id ?? '');
          if (id) void workflowAction('dpr', id, 'approve');
        }}
        onReject={() => {
          const id = String(dprDetail?.id ?? '');
          if (id) void workflowAction('dpr', id, 'reject');
        }}
      />

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
                      onChange={(e) => updateMbEntryRow(row.key, { unit: e.target.value })}
                      helperText={mbBoqUnits.length === 0 ? 'Upload L1 Contractor BOQ in Work Planning' : undefined}>
                      <MenuItem value="">— Select —</MenuItem>
                      {boqUnitOptions(mbBoqUnits, row.unit).map((u) => (
                        <MenuItem key={u} value={u}>{u}</MenuItem>
                      ))}
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


      <Dialog
        open={wpDialog}
        onClose={() => { if (!wpSaving) setWpDialog(false); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{wpEditingId ? 'Edit Work Package' : 'Create Work Package (Admin)'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {wpDialogError && <Alert severity="error">{wpDialogError}</Alert>}
          <TextField label="Package Code" value={wpForm.packageCode} onChange={(e) => setWpForm({ ...wpForm, packageCode: e.target.value })} placeholder="WP-GM-02" required disabled={wpSaving} />
          <TextField label="Package Name" value={wpForm.name} onChange={(e) => setWpForm({ ...wpForm, name: e.target.value })} required disabled={wpSaving} />
          <TextField select label="Component" value={wpForm.component} onChange={(e) => setWpForm({ ...wpForm, component: e.target.value as ProjectComponent })} disabled={wpSaving}>
            {PROJECT_COMPONENT_ORDER.map((k) => (
              <MenuItem key={k} value={k}>{COMPONENT_LABELS[k]}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Scheme Type" value={wpForm.schemeType} onChange={(e) => setWpForm({ ...wpForm, schemeType: e.target.value as SchemeType })} disabled={wpSaving}>
            <MenuItem value="gravity">Gravity</MenuItem>
            <MenuItem value="pumping">Pumping</MenuItem>
          </TextField>
          <TextField label="Chainage From" value={wpForm.chainageFrom} onChange={(e) => setWpForm({ ...wpForm, chainageFrom: e.target.value })} placeholder="0+000" disabled={wpSaving} />
          <TextField label="Chainage To" value={wpForm.chainageTo} onChange={(e) => setWpForm({ ...wpForm, chainageTo: e.target.value })} placeholder="2+000" disabled={wpSaving} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWpDialog(false)} disabled={wpSaving}>Cancel</Button>
          <Button variant="contained" disabled={wpSaving} onClick={() => { void handleSaveWorkPackage(); }}>
            {wpSaving ? 'Saving…' : wpEditingId ? 'Update Package' : 'Save Package'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}
