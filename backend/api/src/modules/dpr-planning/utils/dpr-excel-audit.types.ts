import type { BoqValidationReport } from './dpr-boq-validation.util';

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

export type DprExcelAuditSummary = {
  visibleSheetsChecked: number;
  hiddenSheetsSkipped: number;
  hiddenSheetNames: string[];
  formulasVerified: number;
  formulasUnverified: number;
  calculationsVerified: number;
  totalErrors: number;
  errorPercentage: number;
  validationStatus: 'Pass' | 'Fail' | 'Warning';
  errors: DprAuditError[];
  formulaAudits: DprFormulaAuditRow[];
  errorsBySeverity: { critical: number; major: number; minor: number };
  firstErrorPageNo: number | null;
  firstErrorCellRef: string | null;
};

export type DprExcelAuditReport = BoqValidationReport & {
  audit: DprExcelAuditSummary;
};
