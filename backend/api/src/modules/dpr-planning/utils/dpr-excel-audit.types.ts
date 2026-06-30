import type {
  BoqTotalRowCheck,
  BoqValidationReport,
} from './dpr-boq-validation.util';

export type DprAuditSeverity = 'critical' | 'major' | 'minor';
export type DprAuditCategory =
  | 'horizontal'
  | 'vertical'
  | 'formula'
  | 'arithmetic'
  | 'data'
  | 'dpr_estimate';

export type DprAuditError = {
  sheetName: string;
  pageNo: number;
  rowNo: number;
  /** Excel column letter (e.g. D) or heading label when cell ref unavailable */
  column?: string;
  cellRef: string;
  errorType: string;
  /** Validation step order (1=description, 2=qty, 3=rate, 4=horizontal A, 5=horizontal B, …) */
  checkOrder?: number;
  category: DprAuditCategory;
  severity: DprAuditSeverity;
  expectedValue: number | string | null;
  actualValue: number | string | null;
  difference: number | null;
  message: string;
};

export type DprFormulaAuditRow = {
  sheetName: string;
  pageNo: number;
  cellRef: string;
  rowNo: number;
  formula: string;
  displayedValue: number | null;
  computedValue: number | null;
  /** verified = recomputed OK; mismatch = values differ; unverified = formula not evaluable */
  status: 'verified' | 'mismatch' | 'unverified';
  match: boolean;
  issue?: string;
};

export type DprSheetSummary = {
  sheetName: string;
  status: 'passed' | 'failed' | 'skipped';
  /** Line rows + total-row checks validated on this sheet */
  itemCount?: number;
  errorCount?: number;
};

export type DprSheetLineStepCheck = {
  match: boolean;
  message?: string;
  declared?: number;
  computed?: number;
  qty?: number;
  rate?: number;
  dsr?: number;
  ujn?: number;
  sorPwd?: number;
  nsi?: number;
};

export type DprSheetLineReport = {
  lineNo: number;
  sheetRow?: number;
  description: string;
  status: 'pass' | 'fail' | 'warning';
  step4?: DprSheetLineStepCheck;
  step5?: DprSheetLineStepCheck;
};

export type DprSheetReport = {
  sheetName: string;
  pageNo: number;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  lineCount: number;
  step6Checks: BoqTotalRowCheck[];
  step7Checks: BoqTotalRowCheck[];
  lines: DprSheetLineReport[];
};

export type DprExcelAuditSummary = {
  visibleSheetsChecked: number;
  hiddenSheetsSkipped: number;
  hiddenSheetNames: string[];
  formulasVerified: number;
  formulasUnverified: number;
  calculationsVerified: number;
  totalErrors: number;
  /** Distinct calculation sheets with at least one error */
  errorSheetCount: number;
  errorPercentage: number;
  validationStatus: 'Pass' | 'Fail' | 'Warning';
  errors: DprAuditError[];
  formulaAudits: DprFormulaAuditRow[];
  errorsBySeverity: { critical: number; major: number; minor: number };
  firstErrorPageNo: number | null;
  firstErrorCellRef: string | null;
  /** Compact one-line summary for UI: "BOQ validation PASSED" or "N errors in M sheets" */
  summaryMessage: string;
  /** Per-sheet pass/fail for UI — no full line-level pass payload */
  sheetsSummary: DprSheetSummary[];
  /** Full per-sheet validation detail for UI accordion (includes pass rows/checks) */
  sheetReports?: DprSheetReport[];
};

export type DprExcelAuditReport = BoqValidationReport & {
  audit: DprExcelAuditSummary;
};
