import { useState } from 'react';
import {
  Alert, Box, Button, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
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
    columnChecks?: Array<{ columnLabel: string; match: boolean; message?: string }>;
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
};

export type BoqValidationData = {
  status?: string;
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

function resolveSheetsSummary(validation: BoqValidationData): DprSheetSummary[] {
  const fromAudit = validation.audit?.sheetsSummary;
  if (fromAudit && fromAudit.length > 0) return fromAudit;

  return (validation.pages ?? [])
    .filter((p) => p.isCalculationSheet !== false && p.status !== 'skipped')
    .map((p) => ({
      sheetName: p.sheetName,
      status: (p.failedItems ?? 0) > 0 || p.hasIssues ? 'failed' as const : 'passed' as const,
      itemCount: (p.totalItems ?? 0) + (p.totalChecks?.length ?? 0),
      errorCount: p.failedItems ?? 0,
    }));
}

function SheetStatusRow({ sheet, failed = false }: { sheet: DprSheetSummary; failed?: boolean }) {
  const isPassed = sheet.status === 'passed';
  const Icon = isPassed ? CheckCircleOutlineIcon : ErrorOutlineIcon;
  const iconColor = isPassed ? 'success' : 'error';

  return (
    <Box
      display="flex"
      alignItems="flex-start"
      gap={1}
      sx={{
        py: 0.75,
        px: 1,
        borderRadius: 1,
        bgcolor: failed ? 'rgba(211,47,47,0.06)' : isPassed ? 'rgba(46,125,50,0.06)' : undefined,
      }}
    >
      <Icon color={iconColor} fontSize="small" sx={{ mt: 0.15 }} />
      <Box flex={1} minWidth={0}>
        <Typography variant="body2" fontWeight={failed ? 600 : 500}>
          {sheet.sheetName}
          {' — '}
          {isPassed
            ? 'All items OK'
            : `${sheet.errorCount ?? 0} error${(sheet.errorCount ?? 0) === 1 ? '' : 's'}`}
        </Typography>
        {(sheet.itemCount ?? 0) > 0 && (
          <Typography variant="caption" color="text.secondary">
            {sheet.itemCount} item{sheet.itemCount === 1 ? '' : 's'} validated
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function BoqValidationReportView({
  validation,
  validating = false,
  validatingLabel = 'Validating BOQ Excel — previous results cleared…',
  proposalId,
}: Props) {
  const [exporting, setExporting] = useState(false);

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
  const errorSheetCount = audit?.errorSheetCount
    ?? new Set(errors.map((e) => e.sheetName).filter(Boolean)).size;
  const passed = validation.status === 'passed' && totalErrors === 0;
  const summaryText = audit?.summaryMessage
    ?? validation.summary?.message
    ?? (passed ? 'BOQ validation PASSED' : `${totalErrors} error${totalErrors === 1 ? '' : 's'} in ${errorSheetCount} sheet${errorSheetCount === 1 ? '' : 's'}`);

  const allSheets = resolveSheetsSummary(validation);
  const validatedSheets = allSheets.filter((s) => s.status !== 'skipped');
  const passedSheets = validatedSheets.filter((s) => s.status === 'passed');
  const failedSheets = validatedSheets.filter((s) => s.status === 'failed');

  if (passed) {
    const sheetCount = validatedSheets.length
      || audit?.visibleSheetsChecked
      || validation.pages?.filter((p) => p.isCalculationSheet !== false && p.status !== 'skipped').length
      || 0;

    return (
      <Box>
        <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 1.5 }}>
          <Typography variant="body2" fontWeight={600}>BOQ validation PASSED</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            All {sheetCount} calculation sheet{sheetCount === 1 ? '' : 's'} checked — no errors found.
          </Typography>
        </Alert>

        {validatedSheets.length > 0 && (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
              Sheets validated
            </Typography>
            <Box
              display="grid"
              gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
              gap={0.5}
            >
              {validatedSheets.map((sheet) => (
                <SheetStatusRow key={sheet.sheetName} sheet={sheet} />
              ))}
            </Box>
          </Paper>
        )}

        {proposalId && (
          <Button size="small" variant="text" startIcon={<DownloadOutlinedIcon />}
            disabled={exporting || !audit} onClick={downloadReport} sx={{ mt: 0.5 }}>
            Download full audit Excel
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Alert severity={validation.status === 'warning' ? 'warning' : 'error'} sx={{ mb: 1.5 }}>
        <Typography variant="body2" fontWeight={600}>{summaryText}</Typography>
      </Alert>

      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
        {proposalId && (
          <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}
            disabled={exporting || !audit} onClick={downloadReport}>
            Download Excel Audit Report
          </Button>
        )}
        {(audit?.hiddenSheetsSkipped ?? 0) > 0 && (
          <Typography variant="caption" color="text.secondary">
            {audit?.hiddenSheetsSkipped} hidden sheet(s) skipped
          </Typography>
        )}
      </Box>

      {validatedSheets.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Box
            display="grid"
            gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}
            gap={0.5}
          >
            {failedSheets.map((sheet) => (
              <SheetStatusRow key={sheet.sheetName} sheet={sheet} failed />
            ))}
            {passedSheets.map((sheet) => (
              <SheetStatusRow key={sheet.sheetName} sheet={sheet} />
            ))}
          </Box>
        </Paper>
      )}

      {errors.length > 0 ? (
        <>
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
      ) : (
        <Typography variant="body2" color="text.secondary">
          Validation failed but no detailed error list is available — re-upload the workbook or download the audit report.
        </Typography>
      )}
    </Box>
  );
}
