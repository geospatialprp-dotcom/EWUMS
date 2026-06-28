export type DprPdfCheck = {
  label: string;
  passed: boolean;
  severity: 'critical' | 'minor';
  message: string;
};

export type DprPdfValidationReport = {
  status: 'passed' | 'warning' | 'failed';
  pageCountEstimate: number;
  fileSizeKb: number;
  checks: DprPdfCheck[];
  summary: {
    message: string;
    readyForTac: boolean;
    manualReviewRequired: boolean;
  };
};

const KEYWORD_CHECKS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'Abstract / cost summary', patterns: [/abstract\s*of\s*cost/i, /cost\s*abstract/i, /\baoc\b/i] },
  { label: 'Grand / gross total', patterns: [/grand\s*total/i, /gross\s*total/i, /\bgac\b/i] },
  { label: 'BOQ / estimate items', patterns: [/bill\s*of\s*quantities/i, /\bboq\b/i, /schedule\s*[a-z]?\s*of\s*rate/i] },
  { label: 'Hydraulic / design', patterns: [/hydraulic/i, /design\s*criteria/i, /water\s*supply/i] },
];

function estimatePageCount(buffer: Buffer): number {
  const text = buffer.toString('latin1');
  const typedPages = (text.match(/\/Type\s*\/Page\b/g) ?? []).length;
  if (typedPages > 0) return typedPages;
  const pageObjs = (text.match(/\/Page\b/g) ?? []).length;
  return Math.max(1, Math.floor(pageObjs / 3));
}

function bufferContainsPattern(buffer: Buffer, pattern: RegExp): boolean {
  return pattern.test(buffer.toString('latin1'));
}

export function validateDprPdfBuffer(buffer: Buffer, fileName?: string): DprPdfValidationReport {
  const checks: DprPdfCheck[] = [];
  const fileSizeKb = Math.round(buffer.length / 1024);

  const hasPdfHeader = buffer.length >= 5 && buffer.subarray(0, 5).toString('utf8') === '%PDF-';
  checks.push({
    label: 'Valid PDF file',
    passed: hasPdfHeader,
    severity: 'critical',
    message: hasPdfHeader ? 'PDF header verified' : 'File is not a valid PDF document',
  });

  const minSizeOk = buffer.length >= 10_000;
  checks.push({
    label: 'Minimum file size',
    passed: minSizeOk,
    severity: 'critical',
    message: minSizeOk ? `File size ${fileSizeKb} KB` : `File too small (${fileSizeKb} KB) — likely incomplete`,
  });

  const pageCountEstimate = hasPdfHeader ? estimatePageCount(buffer) : 0;
  const pagesOk = pageCountEstimate >= 1;
  checks.push({
    label: 'Page count',
    passed: pagesOk,
    severity: 'critical',
    message: pagesOk ? `Approximately ${pageCountEstimate} page(s) detected` : 'Could not detect PDF pages',
  });

  for (const { label, patterns } of KEYWORD_CHECKS) {
    const found = patterns.some((p) => bufferContainsPattern(buffer, p));
    checks.push({
      label,
      passed: found,
      severity: 'minor',
      message: found ? `${label} section likely present` : `${label} not detected — TAC manual review required`,
    });
  }

  const criticalFailed = checks.some((c) => c.severity === 'critical' && !c.passed);
  const minorMissing = checks.filter((c) => c.severity === 'minor' && !c.passed).length;

  let status: DprPdfValidationReport['status'] = 'passed';
  if (criticalFailed) status = 'failed';
  else if (minorMissing > 0) status = 'warning';

  const baseName = fileName ?? 'DPR PDF';
  let message: string;
  if (status === 'failed') {
    message = `${baseName} failed basic PDF checks — upload a complete DPR PDF`;
  } else if (status === 'warning') {
    message = `${baseName} passed basic checks with warnings — BOQ/cost sections will need TAC manual review`;
  } else {
    message = `${baseName} passed basic PDF checks — ready for PDF-only TAC submission (manual calculation review)`;
  }

  return {
    status,
    pageCountEstimate,
    fileSizeKb,
    checks,
    summary: {
      message,
      readyForTac: !criticalFailed,
      manualReviewRequired: true,
    },
  };
}
