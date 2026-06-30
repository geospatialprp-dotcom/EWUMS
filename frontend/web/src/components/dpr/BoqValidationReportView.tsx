import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, LinearProgress, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { dprPlanningApi } from '../../services/api';
import { dataTableSx } from '../../utils/pagePresentationStyles';

export type BoqPageData = {
  pageNo: number;
  sheetName: string;
  sheetType?: string;
  status: string;
  isCalculationSheet?: boolean;
  totalItems?: number;
  passedItems?: number;
  failedItems?: number;
  warningItems?: number;
  computedPageTotal?: number | null;
  declaredPageTotal?: number | null;
  pageTotalMatch?: boolean | null;
  hasIssues?: boolean;
  issues?: string[];
  headerLabels?: string[];
  headerRowNo?: number | null;
  headerValid?: boolean;
  headerIssues?: string[];
  totalChecks?: Array<{
    label: string;
    rowNo: number;
    declaredAmount: number;
    computedAmount: number;
    match: boolean;
    message?: string;
  }>;
  keyTotals?: Array<{ label: string; amount: number; rowNo?: number; source?: string }>;
  lines?: Array<{
    lineNo: number;
    description: string;
    qty: number;
    rate: number;
    declaredAmount: number;
    computedAmount: number;
    difference: number;
    status: string;
    message?: string;
  }>;
};

export type BoqCrossCheckData = {
  label: string;
  gac?: number | null;
  bc?: number | null;
  abstract?: number | null;
  boqSum?: number | null;
  match?: boolean;
  message?: string;
};

export type DprAuditError = {
  sheetName: string;
  pageNo: number;
  rowNo: number;
  column?: string;
  cellRef: string;
  errorType: string;
  category: string;
  severity: 'critical' | 'major' | 'minor';
  expectedValue: number | string | null;
  actualValue: number | string | null;
  difference: number | null;
  message: string;
};

export type DprAuditSummary = {
  visibleSheetsChecked?: number;
  hiddenSheetsSkipped?: number;
  hiddenSheetNames?: string[];
  formulasVerified?: number;
  formulasUnverified?: number;
  calculationsVerified?: number;
  totalErrors?: number;
  errorPercentage?: number;
  validationStatus?: string;
  errors?: DprAuditError[];
  errorsBySeverity?: { critical: number; major: number; minor: number };
  firstErrorPageNo?: number | null;
  firstErrorCellRef?: string | null;
};

export type BoqValidationData = {
  status?: string;
  totalItems?: number;
  passedItems?: number;
  failedItems?: number;
  warningItems?: number;
  computedGrandTotal?: number | null;
  declaredGrandTotal?: number | null;
  grandTotalMatch?: boolean | null;
  firstCalculationPageNo?: number | null;
  pages?: BoqPageData[];
  crossChecks?: BoqCrossCheckData[];
  summary?: { message?: string; readyForTac?: boolean; issues?: string[] };
  lines?: BoqPageData['lines'];
  validatedAt?: string;
  audit?: DprAuditSummary | null;
};

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pageStatusColor(status?: string): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'passed') return 'success';
  if (status === 'skipped') return 'default';
  if (status === 'warning') return 'warning';
  return 'error';
}

function sheetTypeLabel(type?: string) {
  if (type === 'gac') return 'GAC';
  if (type === 'bc') return 'BC';
  if (type === 'abstract') return 'Abstract of Cost';
  if (type === 'boq') return 'BOQ';
  if (type === 'form') return 'Form';
  return 'Sheet';
}

function severityColor(s?: string): 'error' | 'warning' | 'default' {
  if (s === 'critical') return 'error';
  if (s === 'major') return 'warning';
  return 'default';
}

interface Props {
  validation: BoqValidationData | null;
  highlightProblemPages?: boolean;
  validating?: boolean;
  validatingLabel?: string;
  proposalId?: string | null;
}

export default function BoqValidationReportView({
  validation,
  highlightProblemPages = true,
  validating = false,
  validatingLabel = 'Validating BOQ Excel — previous results cleared…',
  proposalId,
}: Props) {
  const pages = validation?.pages ?? [];
  const calcPages = pages.filter((p) => p.isCalculationSheet !== false && p.status !== 'skipped');
  const skippedPages = pages.filter((p) => p.status === 'skipped' || p.isCalculationSheet === false);
  const listRef = useRef<HTMLDivElement>(null);

  const audit = validation?.audit;
  const auditErrors = audit?.errors ?? [];
  const [exporting, setExporting] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'major' | 'minor'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredErrors = useMemo(() => {
    return auditErrors.filter((e) => {
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      return true;
    });
  }, [auditErrors, severityFilter, categoryFilter]);

  const errorCategories = useMemo(() => {
    const cats = new Set(auditErrors.map((e) => e.category));
    return ['all', ...Array.from(cats).sort()];
  }, [auditErrors]);

  const navigateToError = (err: DprAuditError) => {
    if (!err.pageNo) return;
    const key = `page-${err.pageNo}`;
    setExpanded((prev) => [...new Set([...prev, key])]);
    window.setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-page-key="${key}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  };

  const downloadReport = async () => {
    if (!proposalId) return;
    setExporting(true);
    try {
      const blob = await dprPlanningApi.downloadBoqValidationExport(proposalId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DPR-Validation-${proposalId.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const focusKeys = useMemo(() => {
    const problem = calcPages.filter((p) => p.hasIssues || p.status === 'failed' || p.status === 'warning')
      .map((p) => `page-${p.pageNo}`);
    if (problem.length) return problem;
    const first = audit?.firstErrorPageNo ?? validation?.firstCalculationPageNo;
    if (first) return [`page-${first}`];
    if (calcPages.length) return [`page-${calcPages[0].pageNo}`];
    return [];
  }, [calcPages, validation?.firstCalculationPageNo, audit?.firstErrorPageNo]);

  const [expanded, setExpanded] = useState<string[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);

  useEffect(() => {
    if (!validation) {
      setExpanded([]);
      setShowSkipped(false);
    }
  }, [validation?.validatedAt, validation]);

  useEffect(() => {
    if (highlightProblemPages && focusKeys.length) {
      setExpanded(focusKeys);
      window.setTimeout(() => {
        const el = listRef.current?.querySelector(`[data-page-key="${focusKeys[0]}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 250);
    }
  }, [highlightProblemPages, focusKeys.join(','), validation?.validatedAt]);

  if (validating) {
    return (
      <Box>
        <LinearProgress sx={{ mb: 1 }} />
        <Alert severity="info">
          {validatingLabel}
        </Alert>
      </Box>
    );
  }

  if (!validation) {
    return (
      <Alert severity="info">
        Click <strong>Upload BOQ Excel</strong> above and select your DPR estimate workbook (.xlsx).
        The system auto-checks every visible sheet (description, unit, Qty×Rate, subtotals, grand totals, formulas).
      </Alert>
    );
  }

  const statusColor = pageStatusColor(validation.status);
  const StatusIcon = validation.status === 'passed' ? CheckCircleOutlineIcon : WarningAmberOutlinedIcon;

  const renderPage = (page: BoqPageData, isSkipped: boolean) => {
    const key = `page-${page.pageNo}`;
    const isProblem = !isSkipped && (page.hasIssues || page.status === 'failed' || page.status === 'warning');
    const problemLines = (page.lines ?? []).filter((l) => l.status === 'fail' || l.status === 'warning');
    const failedTotals = (page.totalChecks ?? []).filter((t) => !t.match);
    const pColor = pageStatusColor(page.status);

    return (
      <Accordion
        key={key}
        data-page-key={key}
        expanded={expanded.includes(key)}
        onChange={(_, open) => setExpanded((prev) => (open ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)))}
        disableGutters
        sx={{
          mb: 1,
          border: '1px solid',
          borderColor: isSkipped ? 'divider' : isProblem
            ? (page.status === 'failed' ? 'error.main' : 'warning.main')
            : 'divider',
          borderRadius: '4px !important',
          '&:before': { display: 'none' },
          bgcolor: isSkipped
            ? 'action.hover'
            : isProblem
              ? (page.status === 'failed' ? 'rgba(211,47,47,0.06)' : 'rgba(237,108,2,0.06)')
              : 'background.paper',
          opacity: isSkipped ? 0.85 : 1,
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" width="100%">
            <Chip size="small" label={`Page ${page.pageNo}`} variant="outlined" />
            <Typography variant="body2" fontWeight={600}>{page.sheetName}</Typography>
            <Chip size="small" variant="outlined" label={sheetTypeLabel(page.sheetType)} />
            <Chip size="small" color={pColor} label={page.status?.toUpperCase() ?? 'UNKNOWN'} />
            {!isSkipped && (
              <Typography variant="caption" color="text.secondary">
                {page.passedItems}/{page.totalItems} lines OK
              </Typography>
            )}
            {(page.failedItems ?? 0) > 0 && <Chip size="small" color="error" label={`${page.failedItems} failed`} />}
            {failedTotals.length > 0 && <Chip size="small" color="error" label={`${failedTotals.length} total error(s)`} />}
            {page.headerValid === false && <Chip size="small" color="warning" label="Heading issue" />}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {isSkipped ? (
            <Alert severity="info">No calculation on this sheet — skipped.</Alert>
          ) : (
            <>
              {page.headerLabels && page.headerLabels.length > 0 && (
                <Box mb={1.5}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Column headings (row {page.headerRowNo ?? '—'})
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap" mb={0.5}>
                    {page.headerLabels.map((h) => (
                      <Chip key={h} size="small" variant="outlined" label={h} />
                    ))}
                  </Box>
                  {page.headerValid === false && (
                    <Alert severity="warning" sx={{ py: 0 }}>
                      {(page.headerIssues ?? []).map((issue) => (
                        <Typography key={issue} variant="caption" display="block">• {issue}</Typography>
                      ))}
                    </Alert>
                  )}
                </Box>
              )}

              {page.issues && page.issues.length > 0 && (
                <Alert severity={pColor === 'default' ? 'info' : pColor} sx={{ mb: 1.5 }}>
                  {page.issues.map((issue) => (
                    <Typography key={issue} variant="caption" display="block">• {issue}</Typography>
                  ))}
                </Alert>
              )}

              {(page.totalChecks ?? []).length > 0 && (
                <Box mb={1.5}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Total / Gross Total checks (Excel vs calculated)
                  </Typography>
                  <Table size="small" sx={dataTableSx}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Label</TableCell>
                        <TableCell>Row</TableCell>
                        <TableCell align="right">Excel</TableCell>
                        <TableCell align="right">Calculated</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(page.totalChecks ?? []).map((t) => (
                        <TableRow key={`${t.label}-${t.rowNo}`} sx={{ bgcolor: !t.match ? 'rgba(211,47,47,0.08)' : undefined }}>
                          <TableCell>{t.label}</TableCell>
                          <TableCell>{t.rowNo}</TableCell>
                          <TableCell align="right">{fmt(t.declaredAmount)}</TableCell>
                          <TableCell align="right">{fmt(t.computedAmount)}</TableCell>
                          <TableCell>
                            <Chip size="small" color={t.match ? 'success' : 'error'} label={t.match ? 'OK' : 'ERROR'} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {problemLines.length > 0 ? (
                <Table size="small" sx={{ ...dataTableSx, maxHeight: 360 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Line #</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Declared</TableCell>
                      <TableCell align="right">Computed</TableCell>
                      <TableCell>Issue</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {problemLines.map((line) => (
                      <TableRow key={line.lineNo} sx={{ bgcolor: line.status === 'fail' ? 'rgba(211,47,47,0.08)' : 'rgba(237,108,2,0.08)' }}>
                        <TableCell>{line.lineNo}</TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>{line.description}</TableCell>
                        <TableCell align="right">{line.qty}</TableCell>
                        <TableCell align="right">{line.rate}</TableCell>
                        <TableCell align="right">{line.declaredAmount}</TableCell>
                        <TableCell align="right">{line.computedAmount}</TableCell>
                        <TableCell>
                          <Chip size="small" color={line.status === 'fail' ? 'error' : 'warning'} label={line.message ?? line.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (page.totalItems ?? 0) === 0 && failedTotals.length === 0 ? (
                <Alert severity="success" icon={<CheckCircleOutlineIcon />}>Totals verified on this sheet.</Alert>
              ) : (page.totalItems ?? 0) > 0 && failedTotals.length === 0 ? (
                <Alert severity="success" icon={<CheckCircleOutlineIcon />}>All lines and totals passed.</Alert>
              ) : null}
            </>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <Box ref={listRef}>
      <Box display="flex" gap={1} flexWrap="wrap" mb={1.5} alignItems="center">
        <Chip size="small" color={statusColor === 'default' ? 'default' : statusColor} icon={<StatusIcon />}
          label={`BOQ Auto-Check: ${validation.status?.toUpperCase()}`} />
        <Chip size="small" variant="outlined" label={`${validation.passedItems ?? 0}/${validation.totalItems ?? 0} lines passed`} />
        {(validation.failedItems ?? 0) > 0 && <Chip size="small" color="error" label={`${validation.failedItems} failed`} />}
        {(validation.warningItems ?? 0) > 0 && <Chip size="small" color="warning" label={`${validation.warningItems} warnings`} />}
        {calcPages.length > 0 && (
          <Chip size="small" variant="outlined"
            label={`${calcPages.filter((p) => !p.hasIssues).length}/${calcPages.length} calculation sheets OK`} />
        )}
        {audit && (
          <Chip size="small" variant="outlined"
            label={`${audit.visibleSheetsChecked ?? 0} visible sheets · ${audit.hiddenSheetsSkipped ?? 0} hidden skipped`} />
        )}
        {proposalId && (
          <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
            disabled={exporting || !audit} onClick={downloadReport}>
            Download Excel Audit Report
          </Button>
        )}
      </Box>

      <Box display="flex" gap={3} flexWrap="wrap" mb={1.5}>
        <Box>
          <Typography variant="caption" color="text.secondary">BOQ Computed Total</Typography>
          <Typography variant="body2" fontWeight={600}>{fmt(validation.computedGrandTotal)}</Typography>
        </Box>
        {validation.declaredGrandTotal != null && (
          <Box>
            <Typography variant="caption" color="text.secondary">Gross / Abstract Declared</Typography>
            <Typography variant="body2" fontWeight={600}>{fmt(validation.declaredGrandTotal)}</Typography>
          </Box>
        )}
        {validation.grandTotalMatch != null && (
          <Box>
            <Typography variant="caption" color="text.secondary">GAC–BC–Abstract–BOQ Match</Typography>
            <Typography variant="body2" fontWeight={600} color={validation.grandTotalMatch ? 'success.main' : 'error.main'}>
              {validation.grandTotalMatch ? 'Yes' : 'No'}
            </Typography>
          </Box>
        )}
      </Box>

      {audit && (
        <Box mb={1.5} p={1.5} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
          <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Error Summary Dashboard
          </Typography>
          <Box display="flex" gap={2} flexWrap="wrap" mb={1}>
            <Chip size="small" label={`Status: ${audit.validationStatus ?? '—'}`}
              color={audit.validationStatus === 'Pass' ? 'success' : audit.validationStatus === 'Warning' ? 'warning' : 'error'} />
            <Chip size="small" variant="outlined" label={`Errors: ${audit.totalErrors ?? 0} (${audit.errorPercentage ?? 0}%)`} />
            <Chip size="small" color="error" variant="outlined" label={`Critical: ${audit.errorsBySeverity?.critical ?? 0}`} />
            <Chip size="small" color="warning" variant="outlined" label={`Major: ${audit.errorsBySeverity?.major ?? 0}`} />
            <Chip size="small" variant="outlined" label={`Minor: ${audit.errorsBySeverity?.minor ?? 0}`} />
            <Chip size="small" variant="outlined" label={`Formulas verified: ${audit.formulasVerified ?? 0}`} />
            {(audit.formulasUnverified ?? 0) > 0 && (
              <Chip size="small" color="warning" variant="outlined" label={`Unverified formulas: ${audit.formulasUnverified}`} />
            )}
            <Chip size="small" variant="outlined" label={`Calculations verified: ${audit.calculationsVerified ?? 0}`} />
          </Box>
          <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
            <TextField select size="small" label="Severity" value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
              SelectProps={{ native: true }} sx={{ minWidth: 120 }}>
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </TextField>
            <TextField select size="small" label="Category" value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              SelectProps={{ native: true }} sx={{ minWidth: 140 }}>
              {errorCategories.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
              ))}
            </TextField>
            {audit.firstErrorCellRef && (
              <Chip size="small" variant="outlined" label={`First error: ${audit.firstErrorCellRef}`} />
            )}
          </Box>
          {(audit.hiddenSheetNames ?? []).length > 0 && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Hidden sheets excluded: {(audit.hiddenSheetNames ?? []).slice(0, 8).join(', ')}
              {(audit.hiddenSheetNames ?? []).length > 8 ? ` +${(audit.hiddenSheetNames ?? []).length - 8} more` : ''}
            </Typography>
          )}
          {filteredErrors.length > 0 && (
            <Table size="small" sx={{ ...dataTableSx, maxHeight: 280 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Sheet</TableCell>
                  <TableCell>Row</TableCell>
                  <TableCell>Column</TableCell>
                  <TableCell>Cell</TableCell>
                  <TableCell>Error Type</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell align="right">Expected</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Diff</TableCell>
                  <TableCell>Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredErrors.slice(0, 100).map((e, idx) => (
                  <TableRow key={`${e.sheetName}-${e.rowNo}-${idx}`}
                    hover
                    onClick={() => navigateToError(e)}
                    sx={{
                      cursor: e.pageNo ? 'pointer' : 'default',
                      bgcolor: e.severity === 'critical' ? 'rgba(211,47,47,0.08)' : e.severity === 'major' ? 'rgba(237,108,2,0.06)' : undefined,
                    }}>
                    <TableCell>{e.sheetName}</TableCell>
                    <TableCell>{e.rowNo || '—'}</TableCell>
                    <TableCell>{e.column || '—'}</TableCell>
                    <TableCell>{e.cellRef || '—'}</TableCell>
                    <TableCell>{e.errorType}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell><Chip size="small" color={severityColor(e.severity)} label={e.severity} /></TableCell>
                    <TableCell align="right">{typeof e.expectedValue === 'number' ? fmt(e.expectedValue) : e.expectedValue ?? '—'}</TableCell>
                    <TableCell align="right">{typeof e.actualValue === 'number' ? fmt(e.actualValue) : e.actualValue ?? '—'}</TableCell>
                    <TableCell align="right">{e.difference != null ? fmt(e.difference) : '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 240 }}><Typography variant="caption">{e.message}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filteredErrors.length > 100 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Showing first 100 of {filteredErrors.length} filtered errors ({auditErrors.length} total) — download Excel report for full list.
            </Typography>
          )}
          {auditErrors.length > 0 && filteredErrors.length === 0 && (
            <Typography variant="caption" color="text.secondary">No errors match the selected filters.</Typography>
          )}
        </Box>
      )}

      {validation.summary?.message && (
        <Alert severity={statusColor === 'default' ? 'info' : statusColor} sx={{ mb: 1.5 }}>
          {validation.summary.message}
        </Alert>
      )}

      {(validation.crossChecks ?? []).map((check) => (
        <Alert key={check.label} severity={check.match ? 'success' : 'error'} sx={{ mb: 1 }}>
          <Typography variant="body2" fontWeight={600}>{check.message ?? check.label}</Typography>
        </Alert>
      ))}

      {calcPages.length > 0 && (
        <>
          <Typography variant="overline" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Calculation sheets — auto-opened; Total / Gross Total errors highlighted
          </Typography>
          {calcPages.map((page) => renderPage(page, false))}
        </>
      )}

      {skippedPages.length > 0 && (
        <Box mt={2}>
          <Button size="small" variant="text" onClick={() => setShowSkipped((v) => !v)}>
            {showSkipped ? 'Hide' : 'Show'} {skippedPages.length} non-calculation sheet(s)
          </Button>
          {showSkipped && skippedPages.map((page) => renderPage(page, true))}
        </Box>
      )}
    </Box>
  );
}
