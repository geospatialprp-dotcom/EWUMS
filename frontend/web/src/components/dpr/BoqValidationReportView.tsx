import { useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Divider,
  LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { dprPlanningApi } from '../../services/api';
import { dataTableSx } from '../../utils/pagePresentationStyles';

export type BoqPageData = {
  pageNo: number;
  sheetName: string;
  sheetType?: string;
  layoutFormat?: 'standard' | 'tharali';
  status: string;
  isCalculationSheet?: boolean;
  totalItems?: number;
  passedItems?: number;
  failedItems?: number;
  warningItems?: number;
  hasIssues?: boolean;
  issues?: string[];
  headerValid?: boolean;
  headerIssues?: string[];
  totalChecks?: Array<{
    label: string;
    rowNo: number;
    match: boolean;
    message?: string;
    checkStep?: 6 | 7;
    columnChecks?: Array<{
      columnLabel: string;
      match: boolean;
      declaredAmount?: number;
      computedAmount?: number;
      message?: string;
    }>;
    horizontalMatch?: boolean | null;
  }>;
  lines?: Array<{
    lineNo: number;
    sheetRow?: number;
    description: string;
    status: string;
    message?: string;
    issues?: Array<{ status: string; column?: string; message: string }>;
  }>;
};

export type BoqCrossCheckData = {
  label: string;
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
  checkOrder?: number;
  category: string;
  severity: 'critical' | 'major' | 'minor';
  expectedValue: number | string | null;
  actualValue: number | string | null;
  difference: number | null;
  message: string;
};

export type DprSheetSummary = {
  sheetName: string;
  status: 'passed' | 'failed' | 'skipped';
  itemCount?: number;
  errorCount?: number;
};

export type DprSheetLineReport = {
  lineNo: number;
  sheetRow?: number;
  description: string;
  status: 'pass' | 'fail' | 'warning';
  step4?: {
    match: boolean;
    message?: string;
    qty?: number;
    rate?: number;
    declared?: number;
    computed?: number;
  };
  step5?: {
    match: boolean;
    message?: string;
    declared?: number;
    computed?: number;
    dsr?: number;
    ujn?: number;
    sorPwd?: number;
    nsi?: number;
  };
};

export type DprSheetReport = {
  sheetName: string;
  pageNo: number;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  lineCount: number;
  step6Checks: BoqPageData['totalChecks'];
  step7Checks: BoqPageData['totalChecks'];
  lines: DprSheetLineReport[];
};

export type DprAuditSummary = {
  visibleSheetsChecked?: number;
  hiddenSheetsSkipped?: number;
  totalErrors?: number;
  errorSheetCount?: number;
  validationStatus?: string;
  summaryMessage?: string;
  errors?: DprAuditError[];
  firstErrorCellRef?: string | null;
  sheetsSummary?: DprSheetSummary[];
  sheetReports?: DprSheetReport[];
};

export type BoqValidationData = {
  status?: string;
  fileName?: string;
  totalItems?: number;
  failedItems?: number;
  warningItems?: number;
  firstCalculationPageNo?: number | null;
  pages?: BoqPageData[];
  crossChecks?: BoqCrossCheckData[];
  summary?: { message?: string; readyForTac?: boolean; issues?: string[] };
  validatedAt?: string;
  audit?: DprAuditSummary | null;
};

const MAX_VISIBLE_ERRORS = 100;

interface Props {
  validation: BoqValidationData | null;
  highlightProblemPages?: boolean;
  validating?: boolean;
  validatingLabel?: string;
  proposalId?: string | null;
}

function formatInr(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function CheckIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircleOutlineIcon color="success" fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
    : <ErrorOutlineIcon color="error" fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />;
}

function resolveSheetReports(validation: BoqValidationData): DprSheetReport[] {
  const fromAudit = validation.audit?.sheetReports;
  if (fromAudit && fromAudit.length > 0) return fromAudit;

  return (validation.pages ?? [])
    .filter((p) => p.isCalculationSheet !== false)
    .map((p) => ({
      sheetName: p.sheetName,
      pageNo: p.pageNo,
      status: (p.status === 'skipped' ? 'skipped' : p.status === 'failed' ? 'failed' : p.status === 'warning' ? 'warning' : 'passed') as DprSheetReport['status'],
      lineCount: p.totalItems ?? 0,
      step6Checks: (p.totalChecks ?? []).filter((c) => c.checkStep === 6),
      step7Checks: (p.totalChecks ?? []).filter((c) => c.checkStep === 7),
      lines: (p.lines ?? []).map((l) => ({
        lineNo: l.lineNo,
        sheetRow: l.sheetRow,
        description: l.description,
        status: (l.status === 'fail' ? 'fail' : l.status === 'warning' ? 'warning' : 'pass') as DprSheetLineReport['status'],
      })),
    }));
}

function resolveSheetsSummary(validation: BoqValidationData, sheetReports: DprSheetReport[]): DprSheetSummary[] {
  const fromAudit = validation.audit?.sheetsSummary;
  if (fromAudit && fromAudit.length > 0) return fromAudit;

  return sheetReports.map((s) => ({
    sheetName: s.sheetName,
    status: s.status === 'skipped' ? 'skipped' as const : s.status === 'failed' ? 'failed' as const : 'passed' as const,
    itemCount: s.lineCount + (s.step6Checks?.length ?? 0) + (s.step7Checks?.length ?? 0),
    errorCount: s.status === 'failed' ? 1 : 0,
  }));
}

function TotalCheckTable({ checks, step }: { checks: NonNullable<BoqPageData['totalChecks']>; step: 6 | 7 }) {
  if (!checks.length) return null;
  const label = step === 6 ? 'Step 6 — Sub Total' : 'Step 7 — Total Cost';

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      {checks.map((check) => (
        <Paper key={`${step}-${check.rowNo}`} variant="outlined" sx={{ p: 1, mb: 0.75, bgcolor: check.match ? 'rgba(46,125,50,0.04)' : 'rgba(211,47,47,0.04)' }}>
          <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
            <CheckIcon ok={check.match} />
            Row {check.rowNo} — {check.label}
            {check.match ? ' ✓' : ''}
          </Typography>
          {(check.columnChecks ?? []).length > 0 ? (
            <Table size="small" sx={{ ...dataTableSx, mt: 0.5 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Column</TableCell>
                  <TableCell>Excel</TableCell>
                  <TableCell>Calculated</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(check.columnChecks ?? []).map((col) => (
                  <TableRow key={col.columnLabel}>
                    <TableCell>{col.columnLabel}</TableCell>
                    <TableCell>{formatInr(col.declaredAmount)}</TableCell>
                    <TableCell>{formatInr(col.computedAmount)}</TableCell>
                    <TableCell>
                      <CheckIcon ok={col.match} />
                      {col.match ? 'Match' : 'Mismatch'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Excel {formatInr(check.declaredAmount)} vs Calculated {formatInr(check.computedAmount)}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>
  );
}

function SheetAccordion({ sheet }: { sheet: DprSheetReport }) {
  const isPassed = sheet.status === 'passed';
  const isSkipped = sheet.status === 'skipped';
  const Icon = isPassed ? CheckCircleOutlineIcon : isSkipped ? CheckCircleOutlineIcon : ErrorOutlineIcon;
  const iconColor = isPassed ? 'success' : isSkipped ? 'disabled' : 'error';

  return (
    <Accordion
      disableGutters
      sx={{
        border: '1px solid',
        borderColor: isPassed ? 'success.light' : isSkipped ? 'divider' : 'error.light',
        '&:before': { display: 'none' },
        mb: 0.75,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={1} flex={1} minWidth={0}>
          <Icon color={iconColor} fontSize="small" />
          <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
            {sheet.sheetName}
          </Typography>
          <Chip
            size="small"
            color={isPassed ? 'success' : isSkipped ? 'default' : 'error'}
            variant="outlined"
            label={isSkipped ? 'Skipped' : isPassed ? 'PASSED' : 'FAILED'}
          />
          {!isSkipped && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {sheet.lineCount} item row{sheet.lineCount === 1 ? '' : 's'}
            </Typography>
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {isSkipped ? (
          <Typography variant="body2" color="text.secondary">Non-calculation sheet — skipped.</Typography>
        ) : (
          <>
            {isPassed && (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 1.5, py: 0 }}>
                All items OK — {sheet.lineCount} row{sheet.lineCount === 1 ? '' : 's'} validated
              </Alert>
            )}
            <TotalCheckTable checks={sheet.step6Checks ?? []} step={6} />
            <TotalCheckTable checks={sheet.step7Checks ?? []} step={7} />
            {sheet.lines.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
                  Item rows checked
                </Typography>
                <Table size="small" sx={{ ...dataTableSx, maxHeight: 280 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Step 4 Qty×Rate</TableCell>
                      <TableCell>Step 5 Components</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sheet.lines.map((line) => (
                      <TableRow
                        key={`${line.lineNo}-${line.sheetRow}`}
                        sx={{ bgcolor: line.status === 'fail' ? 'rgba(211,47,47,0.06)' : undefined }}
                      >
                        <TableCell>{line.sheetRow ?? line.lineNo}</TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap title={line.description}>
                            {line.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {line.step4 ? (
                            <Typography variant="caption" component="span">
                              <CheckIcon ok={line.step4.match} />
                              {line.step4.qty != null && line.step4.rate != null
                                ? `${line.step4.qty} × ${line.step4.rate} = ${formatInr(line.step4.computed)}`
                                : line.step4.match ? 'OK' : 'Mismatch'}
                            </Typography>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {line.step5 ? (
                            <Typography variant="caption" component="span">
                              <CheckIcon ok={line.step5.match} />
                              {[line.step5.dsr, line.step5.ujn, line.step5.sorPwd, line.step5.nsi].some((v) => (v ?? 0) > 0)
                                ? `DSR ${line.step5.dsr ?? 0}+UJN ${line.step5.ujn ?? 0}+SOR ${line.step5.sorPwd ?? 0}+NSI ${line.step5.nsi ?? 0}`
                                : line.step5.match ? 'OK' : 'Mismatch'}
                            </Typography>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={line.status === 'pass' ? 'success' : line.status === 'warning' ? 'warning' : 'error'}
                            label={line.status.toUpperCase()}
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

export default function BoqValidationReportView({
  validation,
  validating = false,
  validatingLabel = 'Validating BOQ Excel — previous results cleared…',
  proposalId,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const sheetReports = useMemo(
    () => (validation ? resolveSheetReports(validation) : []),
    [validation],
  );
  const sheetsSummary = useMemo(
    () => (validation ? resolveSheetsSummary(validation, sheetReports) : []),
    [validation, sheetReports],
  );

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

  const downloadPdfSummary = () => {
    printRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    window.print();
  };

  if (validating) {
    return (
      <Box>
        <LinearProgress sx={{ mb: 1 }} />
        <Alert severity="info">{validatingLabel}</Alert>
      </Box>
    );
  }

  if (!validation) {
    return (
      <Alert severity="info">
        Upload BOQ Excel (.xlsx) to scan all visible sheets — row math, Sub Total, Total Cost, and cross-sheet totals.
      </Alert>
    );
  }

  const audit = validation.audit;
  const errors = audit?.errors ?? [];
  const totalErrors = audit?.totalErrors ?? errors.length;
  const warningCount = validation.warningItems ?? 0;
  const passed = validation.status === 'passed' && totalErrors === 0;
  const validatedSheets = sheetsSummary.filter((s) => s.status !== 'skipped');
  const sheetCount = validatedSheets.length || audit?.visibleSheetsChecked || sheetReports.filter((s) => s.status !== 'skipped').length;

  return (
    <Box ref={printRef}>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
          <Chip
            icon={passed ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
            color={passed ? 'success' : validation.status === 'warning' ? 'warning' : 'error'}
            label={passed ? 'PASSED' : validation.status === 'warning' ? 'PASSED WITH WARNINGS' : 'FAILED'}
          />
          <Typography variant="body2" color="text.secondary">
            {validation.fileName ?? 'BOQ workbook'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · {formatTimestamp(validation.validatedAt)}
          </Typography>
        </Box>
        <Box display="grid" gridTemplateColumns={{ xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }} gap={1}>
          <Box>
            <Typography variant="caption" color="text.secondary">Sheets validated</Typography>
            <Typography variant="body2" fontWeight={600}>{sheetCount}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Item rows checked</Typography>
            <Typography variant="body2" fontWeight={600}>{validation.totalItems ?? 0}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Errors</Typography>
            <Typography variant="body2" fontWeight={600} color={totalErrors > 0 ? 'error.main' : 'success.main'}>
              {totalErrors}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Warnings</Typography>
            <Typography variant="body2" fontWeight={600} color={warningCount > 0 ? 'warning.main' : 'text.primary'}>
              {warningCount}
            </Typography>
          </Box>
        </Box>
        {(audit?.hiddenSheetsSkipped ?? 0) > 0 && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {audit?.hiddenSheetsSkipped} hidden sheet(s) skipped
          </Typography>
        )}
      </Paper>

      <Box display="flex" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }} className="no-print">
        {proposalId && (
          <>
            <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
              disabled={exporting || !audit} onClick={downloadReport}>
              Download Excel Audit Report
            </Button>
            <Button size="small" variant="text" startIcon={<PictureAsPdfOutlinedIcon />}
              disabled={!audit} onClick={downloadPdfSummary}>
              Download PDF Summary Report
            </Button>
          </>
        )}
      </Box>

      {sheetReports.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
            Per-sheet breakdown ({sheetReports.length} sheet{sheetReports.length === 1 ? '' : 's'})
          </Typography>
          {sheetReports.map((sheet) => (
            <SheetAccordion key={sheet.sheetName} sheet={sheet} />
          ))}
        </Box>
      )}

      {errors.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
            Errors ({errors.length})
          </Typography>
          <Table size="small" sx={{ ...dataTableSx, maxHeight: 420 }}>
            <TableHead>
              <TableRow>
                <TableCell>Sheet</TableCell>
                <TableCell>Row</TableCell>
                <TableCell>Column</TableCell>
                <TableCell>Problem</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {errors.slice(0, MAX_VISIBLE_ERRORS).map((e, idx) => (
                <TableRow
                  key={`${e.sheetName}-${e.rowNo}-${e.column}-${idx}`}
                  sx={{
                    bgcolor: e.severity === 'critical'
                      ? 'rgba(211,47,47,0.08)'
                      : e.severity === 'major'
                        ? 'rgba(237,108,2,0.06)'
                        : undefined,
                  }}
                >
                  <TableCell>{e.sheetName}</TableCell>
                  <TableCell>{e.rowNo || '—'}</TableCell>
                  <TableCell>{e.column || (e.cellRef ? e.cellRef.replace(/\d+$/, '') : '—')}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{e.message}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {errors.length > MAX_VISIBLE_ERRORS && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Showing first {MAX_VISIBLE_ERRORS} of {errors.length} — download Excel report for the full list.
            </Typography>
          )}
        </>
      )}

      {!passed && errors.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Validation failed but no detailed error list is available — re-upload the workbook or download the audit report.
        </Typography>
      )}
    </Box>
  );
}
