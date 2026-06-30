export const DPR_PDF_REVIEW_STATUSES = [
  'open',
  'assigned',
  'in_review',
  'corrections_pending',
  'resubmitted',
  'verified',
  'closed',
] as const;

export type DprPdfReviewStatus = (typeof DPR_PDF_REVIEW_STATUSES)[number];

export const DPR_PDF_REVIEWER_SCOPES = ['division', 'circle', 'hq'] as const;
export type DprPdfReviewerScope = (typeof DPR_PDF_REVIEWER_SCOPES)[number];

export const DPR_PDF_ANNOTATION_TYPES = [
  'freehand',
  'highlight',
  'sticky_note',
  'underline',
  'circle',
  'strike',
  'arrow',
  'stamp',
  'signature',
] as const;

export type DprPdfAnnotationType = (typeof DPR_PDF_ANNOTATION_TYPES)[number];

export const DPR_PDF_PHASE1_TOOLS: DprPdfAnnotationType[] = ['freehand', 'highlight', 'sticky_note'];

/** HQ/state roles that review at circle/HQ scope */
export const DPR_PDF_HQ_ROLES = ['se', 'ce', 'cgm', 'md', 'super_admin'] as const;

/** Division field roles */
export const DPR_PDF_DIVISION_ROLES = ['ee', 'je', 'ae'] as const;

export function resolveReviewerScope(roles: string[]): DprPdfReviewerScope {
  if (roles.some((r) => DPR_PDF_HQ_ROLES.includes(r as typeof DPR_PDF_HQ_ROLES[number]))) {
    return 'hq';
  }
  if (roles.includes('se') || roles.includes('ce')) {
    return 'circle';
  }
  return 'division';
}
