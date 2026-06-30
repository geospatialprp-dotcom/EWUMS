export const DPR_PLANNING_STAGES = [
  { stage: 1, key: 'proposal-initiation', name: 'DPR Proposal Initiation (Division EE)', ownerRoles: ['ee', 'je'] },
  { stage: 2, key: 'hq-prep-approval', name: 'HQ DPR Preparation Approval', ownerRoles: ['se', 'ce', 'cgm', 'md'] },
  { stage: 3, key: 'dpr-preparation', name: 'DPR Preparation', ownerRoles: ['ee', 'je', 'ae', 'se'] },
  { stage: 4, key: 'tac-round1', name: 'TAC Review — First Round', ownerRoles: ['se', 'ce'] },
  { stage: 5, key: 'dpr-revision', name: 'DPR Revision & Finalization', ownerRoles: ['ee', 'je', 'ae', 'se'] },
  { stage: 6, key: 'secretariat', name: 'Secretariat / Sachiwalaya Submission', ownerRoles: ['se', 'ce', 'cgm'] },
  { stage: 7, key: 'tac-round2', name: 'Second Round TAC / Govt Technical Exam', ownerRoles: ['se', 'ce', 'cgm'] },
  { stage: 8, key: 'sanction', name: 'Administrative Sanction & Budget Approval', ownerRoles: ['se', 'ce', 'cgm', 'md'] },
  { stage: 9, key: 'tender-initiation', name: 'Tender & BOQ Initiation (HQ)', ownerRoles: ['se', 'ce'] },
  { stage: 10, key: 'tender-processing', name: 'Tender Processing & Procurement', ownerRoles: ['je', 'ae', 'ee', 'se', 'ce'] },
  { stage: 11, key: 'governance', name: 'Audit Trail & Governance', ownerRoles: [] },
  { stage: 12, key: 'dashboard', name: 'Dashboard & Monitoring', ownerRoles: [] },
] as const;

export type DprProposalStatus =
  | 'proposal_draft'
  | 'proposal_submitted'
  | 'hq_review'
  | 'proposal_returned'
  | 'proposal_rejected'
  | 'dpr_prep_approved'
  | 'dpr_preparation'
  | 'dpr_submitted'
  | 'tac_round1_review'
  | 'tac_corrections_required'
  | 'tac_round1_cleared'
  | 'dpr_revision'
  | 'tac_round1_final'
  | 'secretariat_submitted'
  | 'tac_round2_review'
  | 'tac_round2_corrections_required'
  | 'tac_round2_compliance'
  | 'govt_technical_concurrence'
  | 'sanctioned'
  | 'tender_prep_initiated'
  | 'tender_processing'
  | 'tender_published'
  | 'closed';

export const DPR_STATUS_LABELS: Record<DprProposalStatus, string> = {
  proposal_draft: 'Proposal Draft',
  proposal_submitted: 'Submitted to HQ',
  hq_review: 'HQ Review',
  proposal_returned: 'Returned to Division EE',
  proposal_rejected: 'Proposal Rejected',
  dpr_prep_approved: 'DPR Preparation Approved',
  dpr_preparation: 'DPR Preparation in Progress',
  dpr_submitted: 'DPR Submitted to HQ',
  tac_round1_review: 'TAC Review — Round 1',
  tac_corrections_required: 'TAC Corrections Required',
  tac_round1_cleared: 'TAC Cleared — First Stage',
  dpr_revision: 'DPR Revision',
  tac_round1_final: 'TAC Final — Round 1',
  secretariat_submitted: 'Forwarded to Secretariat',
  tac_round2_review: 'TAC / Govt Review — Round 2',
  tac_round2_corrections_required: 'Round 2 — Compliance Required',
  tac_round2_compliance: 'Round 2 — Compliance in Progress',
  govt_technical_concurrence: 'Govt Technical Concurrence',
  sanctioned: 'Sanctioned & Budget Approved',
  tender_prep_initiated: 'Tender Preparation Initiated',
  tender_processing: 'Tender Processing',
  tender_published: 'Tender Published',
  closed: 'Closed',
};

export const DPR_STAGE_BY_STATUS: Record<DprProposalStatus, number> = {
  proposal_draft: 1,
  proposal_submitted: 2,
  hq_review: 2,
  proposal_returned: 1,
  proposal_rejected: 1,
  dpr_prep_approved: 3,
  dpr_preparation: 3,
  dpr_submitted: 4,
  tac_round1_review: 4,
  tac_corrections_required: 5,
  tac_round1_cleared: 6,
  dpr_revision: 5,
  tac_round1_final: 6,
  secretariat_submitted: 6,
  tac_round2_review: 7,
  tac_round2_corrections_required: 7,
  tac_round2_compliance: 7,
  govt_technical_concurrence: 8,
  sanctioned: 9,
  tender_prep_initiated: 9,
  tender_processing: 10,
  tender_published: 10,
  closed: 12,
};

/** Mandatory uploads before Division EE can forward proposal to HQ (Stage 1). */
export const DPR_STAGE_1_REQUIRED_DOCUMENT_TYPES = [
  'concept_note',
  'preliminary_estimate',
  'scheme_justification',
  'survey_data',
  'gis_boundary',
] as const;

export type DprStage1DocumentType = typeof DPR_STAGE_1_REQUIRED_DOCUMENT_TYPES[number];

/** Mandatory DPR deliverables before submission to HQ (Stage 3). */
export const DPR_STAGE_3_REQUIRED_DOCUMENT_TYPES = [
  'engineering_design',
  'hydraulic_design',
  'survey_drawings',
  'gis_maps',
  'cost_estimate',
  'boq_draft',
  'env_social',
  'technical_specs',
] as const;

export type DprStage3DocumentType = typeof DPR_STAGE_3_REQUIRED_DOCUMENT_TYPES[number];

/** Stage 5 — DPR revision after TAC observations */
export const DPR_REVISION_STATUSES = ['tac_corrections_required', 'dpr_revision'] as const;
export type DprRevisionStatus = typeof DPR_REVISION_STATUSES[number];

export const DPR_STAGE_3_UPLOAD_STATUSES = [
  'dpr_prep_approved',
  'dpr_preparation',
  ...DPR_REVISION_STATUSES,
] as const;

/** Stage 7 — Round 2 compliance document uploads */
export const DPR_ROUND2_COMPLIANCE_STATUSES = [
  'tac_round2_corrections_required',
  'tac_round2_compliance',
] as const;
export type DprRound2ComplianceStatus = typeof DPR_ROUND2_COMPLIANCE_STATUSES[number];

export const DPR_HQ_VERIFICATION_ITEMS = [
  { key: 'needAssessment', label: 'Need assessment verified' },
  { key: 'budgetAvailability', label: 'Budget availability confirmed' },
  { key: 'schemePriority', label: 'Scheme priority assessed' },
  { key: 'fundingSource', label: 'Funding source validated' },
] as const;

export type HqVerificationKey = typeof DPR_HQ_VERIFICATION_ITEMS[number]['key'];

/** TAC Round 1 technical review checklist (Stage 4). */
export const DPR_TAC_ROUND1_CHECKLIST = [
  { key: 'technicalFeasibility', label: 'Technical feasibility' },
  { key: 'designStandards', label: 'Design standards' },
  { key: 'hydraulicCalculations', label: 'Hydraulic calculations' },
  { key: 'costEstimates', label: 'Cost estimates' },
  { key: 'boqQuantities', label: 'BOQ quantities' },
  { key: 'drawingsLayouts', label: 'Drawings and layouts' },
] as const;

export type TacRound1CheckKey = typeof DPR_TAC_ROUND1_CHECKLIST[number]['key'];

export const DPR_TAC_ROUND1_ACTIONS = [
  'approve',
  'suggest_corrections',
  'request_info',
  'return_revision',
] as const;

export type TacRound1Action = typeof DPR_TAC_ROUND1_ACTIONS[number];

export const DPR_TAC_ACTION_LABELS: Record<TacRound1Action, string> = {
  approve: 'Approve — TAC Cleared (Round 1)',
  suggest_corrections: 'Suggest Corrections',
  request_info: 'Request Additional Information',
  return_revision: 'Return DPR for Revision',
};

/** TAC Round 2 technical & financial examination checklist (Stage 7). */
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

export type TacRound2CheckKey = typeof DPR_TAC_ROUND2_CHECKLIST[number]['key'];

export const DPR_TAC_ROUND2_ACTIONS = [
  'approve',
  'suggest_corrections',
  'request_info',
  'return_revision',
] as const;

export type TacRound2Action = typeof DPR_TAC_ROUND2_ACTIONS[number];

export const DPR_TAC_ROUND2_ACTION_LABELS: Record<TacRound2Action, string> = {
  approve: 'Grant Govt Technical Concurrence',
  suggest_corrections: 'Request Compliance Submission',
  request_info: 'Request Additional Information',
  return_revision: 'Return for Major Revision',
};

export const DPR_DOCUMENT_TYPES = [
  { type: 'concept_note', label: 'Project Concept Note', stage: 1 },
  { type: 'preliminary_estimate', label: 'Preliminary Estimate', stage: 1 },
  { type: 'scheme_justification', label: 'Scheme Justification', stage: 1 },
  { type: 'survey_data', label: 'Survey & Field Data', stage: 1 },
  { type: 'gis_boundary', label: 'GIS Location & Boundaries', stage: 1 },
  { type: 'dpr_prep_order', label: 'DPR Preparation Order', stage: 2 },
  { type: 'engineering_design', label: 'Engineering Design', stage: 3 },
  { type: 'hydraulic_design', label: 'Hydraulic Design', stage: 3 },
  { type: 'survey_drawings', label: 'Survey Drawings', stage: 3 },
  { type: 'gis_maps', label: 'GIS Maps', stage: 3 },
  { type: 'cost_estimate', label: 'Cost Estimates', stage: 3 },
  { type: 'boq_draft', label: 'BOQ Draft', stage: 3 },
  { type: 'env_social', label: 'Environmental & Social', stage: 3 },
  { type: 'technical_specs', label: 'Technical Specifications', stage: 3 },
  { type: 'dpr_complete_pdf', label: 'Complete DPR (PDF for TAC)', stage: 3 },
  { type: 'boq_tac_excel', label: 'Complete BOQ Excel (TAC)', stage: 3 },
  { type: 'tac_compliance', label: 'TAC Compliance Report', stage: 5 },
  { type: 'tac_round2_compliance', label: 'Round 2 Compliance Submission', stage: 7 },
  { type: 'sanction_aa', label: 'Administrative Approval (AA)', stage: 8 },
  { type: 'sanction_es', label: 'Expenditure Sanction (ES)', stage: 8 },
  { type: 'sanction_budget_allocation', label: 'Budget Allocation Order', stage: 8 },
  { type: 'funding_release_order', label: 'Funding Release Order', stage: 8 },
  { type: 'boq_final', label: 'Final BOQ', stage: 9 },
  { type: 'sor_verification', label: 'Schedule of Rates Verification', stage: 9 },
  { type: 'bid_package', label: 'Bid Package', stage: 9 },
  { type: 'tender_specs_final', label: 'Technical Specifications (Final)', stage: 9 },
  { type: 'tender_documents', label: 'Tender Documents', stage: 9 },
  { type: 'tender_task_order', label: 'Tender Preparation Task Order', stage: 9 },
  { type: 'nit', label: 'Notice Inviting Tender (NIT)', stage: 10 },
  { type: 'bid_documents', label: 'Bid Documents', stage: 10 },
  { type: 'tender_tech_eligibility', label: 'Technical Eligibility Criteria', stage: 10 },
  { type: 'tender_financial_criteria', label: 'Financial Evaluation Criteria', stage: 10 },
] as const;

export const DPR_TAC_PACKAGE_TYPES = ['dpr_complete_pdf', 'boq_tac_excel'] as const;

/** Stage 8 — Administrative sanction document checklist */
export const DPR_STAGE_8_SANCTION_DOCUMENT_TYPES = [
  'sanction_aa',
  'sanction_es',
  'sanction_budget_allocation',
  'funding_release_order',
] as const;

export const DPR_SANCTION_RECORD_STATUSES = ['govt_technical_concurrence'] as const;

/** Stage 9 — HQ tender preparation initiation checklist (division addressal) */
export const DPR_TENDER_PREP_CHECKLIST = [
  { key: 'finalBoqPrep', label: 'Final BOQ preparation' },
  { key: 'sorVerification', label: 'Schedule of Rates verification' },
  { key: 'bidPackagePrep', label: 'Bid package preparation' },
  { key: 'techSpecsFinalization', label: 'Technical specifications finalization' },
  { key: 'tenderDocGeneration', label: 'Tender document generation' },
] as const;

export type TenderPrepCheckKey = typeof DPR_TENDER_PREP_CHECKLIST[number]['key'];

export const DPR_TENDER_PREP_STATUSES = ['tender_prep_initiated'] as const;

export const DPR_STAGE_9_PREP_DOCUMENT_TYPES = [
  'boq_final',
  'sor_verification',
  'bid_package',
  'tender_specs_final',
  'tender_documents',
  'tender_task_order',
] as const;

/** Stage 10 — Tender processing & procurement deliverables */
export const DPR_STAGE_10_REQUIRED_DOCUMENT_TYPES = [
  'boq_final',
  'nit',
  'bid_documents',
  'tender_tech_eligibility',
  'tender_financial_criteria',
] as const;

export const DPR_TENDER_PROCESSING_PREP_CHECKLIST = [
  { key: 'boq_final', label: 'Final BOQ' },
  { key: 'nit', label: 'Notice Inviting Tender (NIT)' },
  { key: 'bid_documents', label: 'Bid documents' },
  { key: 'tender_tech_eligibility', label: 'Technical eligibility criteria' },
  { key: 'tender_financial_criteria', label: 'Financial evaluation criteria' },
] as const;

export const DPR_TENDER_APPROVAL_LEVELS = ['je', 'ae', 'ee', 'cleared'] as const;
export type TenderApprovalLevel = typeof DPR_TENDER_APPROVAL_LEVELS[number];

export const DPR_TENDER_UPLOAD_STATUSES = ['tender_prep_initiated', 'tender_processing'] as const;

export const DPR_TENDER_APPROVAL_ACTIONS = ['verify', 'approve', 'return'] as const;

export const DPR_TENDER_APPROVAL_LABELS: Record<string, string> = {
  je: 'JE Verification',
  ae: 'AE Review',
  ee: 'EE Approval',
  cleared: 'Tender Approved — Ready to Publish',
};

export const DPR_ADVANCE_ACTIONS = [
  'submit',
  'approve',
  'return',
  'reject',
  'request_corrections',
  'request_info',
  'forward_tac',
  'forward_secretariat',
  'record_sanction',
  'initiate_tender',
  'publish_tender',
  'close',
] as const;

export type DprAdvanceAction = typeof DPR_ADVANCE_ACTIONS[number];

export function getDprStatusLabel(status: string): string {
  return DPR_STATUS_LABELS[status as DprProposalStatus] ?? status.replace(/_/g, ' ');
}

/** Division-facing labels when proposal is with HQ/TAC (read-only tracking). */
const DPR_DIVISION_VIEWER_STATUS_LABELS: Partial<Record<DprProposalStatus, string>> = {
  tac_round1_review: 'Under Review',
};

export function isDivisionDprViewer(roles: string[]): boolean {
  const hasDivision = roles.some((r) => ['ee', 'je', 'ae'].includes(r));
  const hasHq = roles.some((r) => r === 'super_admin' || ['se', 'ce', 'cgm', 'md'].includes(r));
  return hasDivision && !hasHq;
}

export function getDprViewerStatusLabel(status: string, roles: string[] = []): string {
  if (isDivisionDprViewer(roles) && DPR_DIVISION_VIEWER_STATUS_LABELS[status as DprProposalStatus]) {
    return DPR_DIVISION_VIEWER_STATUS_LABELS[status as DprProposalStatus]!;
  }
  return getDprStatusLabel(status);
}

export function getDprStageForStatus(status: string): number {
  return DPR_STAGE_BY_STATUS[status as DprProposalStatus] ?? 1;
}
