/** Detailed Project Report (DPR) approval pipeline — mirrors backend */

export const DPR_PLANNING_STAGES = [
  { stage: 1, key: 'proposal-initiation', name: 'DPR Proposal Initiation (Division EE)' },
  { stage: 2, key: 'hq-prep-approval', name: 'DPR Preparation Approval' },
  { stage: 3, key: 'dpr-preparation', name: 'DPR Preparation' },
  { stage: 4, key: 'tac-round1', name: 'TAC Review — First Round' },
  { stage: 5, key: 'dpr-revision', name: 'DPR Revision & Finalization' },
  { stage: 6, key: 'secretariat', name: 'Secretariat / Sachiwalaya Submission' },
  { stage: 7, key: 'tac-round2', name: 'Second Round TAC / Govt Technical Exam' },
  { stage: 8, key: 'sanction', name: 'Administrative Sanction & Budget Approval' },
  { stage: 9, key: 'tender-initiation', name: 'Tender & BOQ Initiation' },
  { stage: 10, key: 'tender-processing', name: 'Tender Processing & Procurement' },
  { stage: 11, key: 'governance', name: 'Audit Trail & Governance' },
  { stage: 12, key: 'dashboard', name: 'Dashboard & Monitoring' },
] as const;

export const DPR_ACTION_LABELS: Record<string, string> = {
  submit: 'Forward for Review',
  approve: 'Approve',
  return: 'Return to Division EE',
  reject: 'Reject',
  request_corrections: 'Request Corrections',
  request_info: 'Request Additional Information',
  forward_tac: 'Forward to TAC Section',
  forward_secretariat: 'Forward to Secretariat',
  record_sanction: 'Record Sanction (AA/ES)',
  initiate_tender: 'Initiate Tender Processing',
  publish_tender: 'Publish Tender',
  close: 'Close Pipeline',
};

export const DPR_TAC_ROUND1_CHECKLIST = [
  { key: 'technicalFeasibility', label: 'Technical feasibility' },
  { key: 'designStandards', label: 'Design standards' },
  { key: 'hydraulicCalculations', label: 'Hydraulic calculations' },
  { key: 'costEstimates', label: 'Cost estimates' },
  { key: 'boqQuantities', label: 'BOQ quantities' },
  { key: 'drawingsLayouts', label: 'Drawings and layouts' },
] as const;

export const DPR_TAC_ACTION_LABELS: Record<string, string> = {
  approve: 'Approve — TAC Cleared (Round 1)',
  suggest_corrections: 'Suggest Corrections',
  request_info: 'Request Additional Information',
  return_revision: 'Return DPR for Revision',
};

export const DPR_TAC_ROUND2_CHECKLIST = [
  { key: 'technicalExamination', label: 'Technical examination completed' },
  { key: 'financialExamination', label: 'Financial examination completed' },
  { key: 'costEstimateScrutiny', label: 'Cost estimates scrutinized' },
  { key: 'budgetFundProvisioning', label: 'Budget / fund provisioning verified' },
  { key: 'boqFinancialCompliance', label: 'BOQ & financial compliance' },
  { key: 'designStandardsCompliance', label: 'Design standards & norms compliance' },
  { key: 'envSocialClearances', label: 'Environmental & social clearances reviewed' },
  { key: 'fundingRequirements', label: 'Funding requirements validated' },
] as const;

export const DPR_TAC_ROUND2_ACTION_LABELS: Record<string, string> = {
  approve: 'Grant Govt Technical Concurrence',
  suggest_corrections: 'Request Compliance Submission',
  request_info: 'Request Additional Information',
  return_revision: 'Return for Major Revision',
};

export const DPR_TENDER_PREP_CHECKLIST = [
  { key: 'finalBoqPrep', label: 'Final BOQ preparation' },
  { key: 'sorVerification', label: 'Schedule of Rates verification' },
  { key: 'bidPackagePrep', label: 'Bid package preparation' },
  { key: 'techSpecsFinalization', label: 'Technical specifications finalization' },
  { key: 'tenderDocGeneration', label: 'Tender document generation' },
] as const;

export const DPR_TENDER_PREP_DOCUMENT_TYPES = [
  { type: 'boq_final', label: 'Final BOQ' },
  { type: 'sor_verification', label: 'Schedule of Rates Verification' },
  { type: 'bid_package', label: 'Bid Package' },
  { type: 'tender_specs_final', label: 'Technical Specifications (Final)' },
  { type: 'tender_documents', label: 'Tender Documents' },
  { type: 'tender_task_order', label: 'Tender Preparation Task Order' },
] as const;

export const DPR_TENDER_PROCESSING_DOCUMENT_TYPES = [
  { type: 'boq_final', label: 'Final BOQ' },
  { type: 'nit', label: 'Notice Inviting Tender (NIT)' },
  { type: 'bid_documents', label: 'Bid Documents' },
  { type: 'tender_tech_eligibility', label: 'Technical Eligibility Criteria' },
  { type: 'tender_financial_criteria', label: 'Financial Evaluation Criteria' },
] as const;

export const DPR_TENDER_APPROVAL_LABELS: Record<string, string> = {
  je: 'JE Verification',
  ae: 'AE Review',
  ee: 'EE Approval',
  cleared: 'Tender Approved — Ready to Publish',
};

export const DPR_STAGE_1_DOCUMENT_TYPES = [
  { type: 'concept_note', label: 'Project Concept Note' },
  { type: 'preliminary_estimate', label: 'Preliminary Estimate' },
  { type: 'scheme_justification', label: 'Scheme Justification' },
  { type: 'survey_data', label: 'Survey & Field Data' },
  { type: 'gis_boundary', label: 'GIS Location & Boundaries' },
] as const;

export const DPR_HQ_VERIFICATION_ITEMS = [
  { key: 'needAssessment', label: 'Need assessment verified' },
  { key: 'budgetAvailability', label: 'Budget availability confirmed' },
  { key: 'schemePriority', label: 'Scheme priority assessed' },
  { key: 'fundingSource', label: 'Funding source validated' },
] as const;

export const DPR_HQ_ACTION_LABELS: Record<string, string> = {
  approve: 'Approve DPR Preparation',
  return: 'Return to Division EE',
  reject: 'Reject Proposal',
};

export const DPR_STAGE_3_DOCUMENT_TYPES = [
  { type: 'engineering_design', label: 'Engineering Design' },
  { type: 'hydraulic_design', label: 'Hydraulic Design' },
  { type: 'survey_drawings', label: 'Survey Drawings' },
  { type: 'gis_maps', label: 'GIS Maps' },
  { type: 'cost_estimate', label: 'Cost Estimates' },
  { type: 'boq_draft', label: 'BOQ Draft' },
  { type: 'env_social', label: 'Environmental & Social' },
  { type: 'technical_specs', label: 'Technical Specifications' },
] as const;

export const DPR_DOCUMENT_TYPES = [
  ...DPR_STAGE_1_DOCUMENT_TYPES,
  { type: 'dpr_prep_order', label: 'DPR Preparation Order' },
  ...DPR_STAGE_3_DOCUMENT_TYPES,
  { type: 'sanction_aa', label: 'Administrative Approval (AA)' },
  { type: 'sanction_es', label: 'Expenditure Sanction (ES)' },
  { type: 'sanction_budget_allocation', label: 'Budget Allocation Order' },
  { type: 'funding_release_order', label: 'Funding Release Order' },
  { type: 'nit', label: 'Notice Inviting Tender (NIT)' },
] as const;

/** Secretariat / Sachiwalaya — Round 2 Govt examination (Stage 7). */
export const DPR_SECRETARIAT_REVIEWER_ROLES = ['secretariat'] as const;

/** HQ officials — state-level DPR review after division initiation. */
export const DPR_STATE_REVIEWER_ROLES = ['se', 'ce', 'cgm', 'md'] as const;
export const DPR_HQ_REVIEWER_ROLES = DPR_STATE_REVIEWER_ROLES;
export const DPR_TAC_REVIEWER_ROLES = DPR_STATE_REVIEWER_ROLES;
export const DPR_TAC_ROUND2_REVIEWER_ROLES = DPR_STATE_REVIEWER_ROLES;
export const DPR_SECRETARIAT_FORWARD_ROLES = DPR_STATE_REVIEWER_ROLES;
export const DPR_SANCTION_ROLES = DPR_SECRETARIAT_REVIEWER_ROLES;
export const DPR_TENDER_INIT_ROLES = ['ee'] as const;

function hasDprRole(roles: string[], allowed: readonly string[]): boolean {
  return allowed.length > 0 && roles.some((r) => (allowed as readonly string[]).includes(r));
}

export function isStateReviewer(roles: string[]): boolean {
  return roles.includes('super_admin') || hasDprRole(roles, DPR_STATE_REVIEWER_ROLES);
}

export function canPerformHqReview(roles: string[]): boolean {
  return isStateReviewer(roles);
}

export function canForwardDprToTac(roles: string[]): boolean {
  return isStateReviewer(roles);
}

export function canPerformTacReview(roles: string[]): boolean {
  return isStateReviewer(roles);
}

export function canForwardToSecretariat(roles: string[]): boolean {
  return isStateReviewer(roles);
}

export function canPerformTacRound2Review(roles: string[]): boolean {
  return roles.some((r) => (DPR_SECRETARIAT_REVIEWER_ROLES as readonly string[]).includes(r));
}

export function isSecretariatReviewer(roles: string[]): boolean {
  return canPerformTacRound2Review(roles);
}

export function canRecordDprSanction(roles: string[]): boolean {
  return roles.includes('super_admin') || isSecretariatReviewer(roles);
}

export function canInitiateDprTenderPrep(roles: string[]): boolean {
  return roles.includes('super_admin');
}

export function canAuthorizeDprTenderPrep(roles: string[]): boolean {
  return roles.includes('super_admin');
}

export function canBeginEeDprTenderPrep(roles: string[]): boolean {
  return roles.includes('ee');
}

/** Super Admin may initiate proposals only — not post-creation pipeline actions. */
export function canPlatformInitiateDpr(roles: string[]): boolean {
  return roles.includes('super_admin');
}

/** Division users (EE/JE/AE) without HQ state reviewer — read-only TAC tracking. */
export function isDivisionDprViewer(roles: string[]): boolean {
  const hasDivision = roles.some((r) => ['ee', 'je', 'ae'].includes(r));
  return hasDivision && !isStateReviewer(roles);
}

const DPR_DIVISION_VIEWER_STATUS_LABELS: Record<string, string> = {
  tac_round1_review: 'Under Review',
  secretariat_submitted: 'Under Secretariat Examination',
  tac_round2_review: 'Under Secretariat Examination',
  tac_round2_corrections_required: 'Action Required — Round 2 Compliance',
  tac_round2_compliance: 'Compliance Submission In Progress',
  tac_round2_compliance_submitted: 'Submitted to Super Admin — Awaiting Review',
  govt_technical_concurrence: 'Govt Technical Concurrence',
};

/** Role-aware status label for list chips and tracking panels. */
export function getDprDisplayStatusLabel(
  status: string,
  roles: string[],
  apiLabel?: string,
): string {
  if (isDivisionDprViewer(roles) && DPR_DIVISION_VIEWER_STATUS_LABELS[status]) {
    return DPR_DIVISION_VIEWER_STATUS_LABELS[status];
  }
  return apiLabel ?? status.replace(/_/g, ' ');
}
