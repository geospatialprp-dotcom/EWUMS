import { useState } from 'react';
import {
  Alert, Box, Button, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
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

export type DprAuditSummary = {
  visibleSheetsChecked?: number;
  hiddenSheetsSkipped?: number;
  totalErrors?: number;
  errorSheetCount?: number;
  validationStatus?: string;
  summaryMessage?: string;
  errors?: DprAuditError[];
  firstErrorCellRef?: string | null;
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

  if (passed) {
    return (
      <Box>
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          <Typography variant="body2" fontWeight={600}>BOQ validation PASSED</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            All {audit?.visibleSheetsChecked ?? validation.pages?.filter((p) => p.isCalculationSheet !== false && p.status !== 'skipped').length ?? 0} calculation sheet(s) checked — no errors found.
          </Typography>
        </Alert>
        {proposalId && (
          <Button size="small" variant="text" startIcon={<DownloadOutlinedIcon />}
            disabled={exporting || !audit} onClick={downloadReport} sx={{ mt: 1 }}>
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
