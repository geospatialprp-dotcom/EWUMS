export const DPR_PDF_AI_SEVERITIES = ['critical', 'major', 'minor', 'info'] as const;
export type DprPdfAiSeverity = (typeof DPR_PDF_AI_SEVERITIES)[number];

export const DPR_PDF_AI_SEVERITY_COLORS: Record<DprPdfAiSeverity, string> = {
  critical: '#d32f2f',
  major: '#f57c00',
  minor: '#fbc02d',
  info: '#1976d2',
};

export const DPR_PDF_AI_CATEGORIES = [
  'signature',
  'numerical',
  'formatting',
  'compliance',
  'grammar',
  'technical',
  'cross_reference',
] as const;
export type DprPdfAiCategory = (typeof DPR_PDF_AI_CATEGORIES)[number];

export function aiSeverityToAnnotationType(severity: DprPdfAiSeverity): string {
  return `ai_${severity}`;
}
