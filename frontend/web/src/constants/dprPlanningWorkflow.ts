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

/** Stage 1 — Division EE/JE/AE only; Super Admin is view-only. */
export const DPR_DIVISION_INITIATOR_ROLES = ['ee', 'je', 'ae'] as const;

export function canInitiateDprProposal(roles: string[]): boolean {
  if (!roles.length || roles.includes('super_admin')) return false;
  return roles.some((r) => (DPR_DIVISION_INITIATOR_ROLES as readonly string[]).includes(r));
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

export type DprWorkflowStageAction =
  | 'stage1'
  | 'hqReview'
  | 'stage3'
  | 'tacReview'
  | 'revision'
  | 'secretariat'
  | 'tacRound2'
  | 'round2Compliance'
  | 'round2ComplianceAdmin'
  | 'round2Liaison'
  | 'sanction'
  | 'tenderInit'
  | 'tenderProcessing'
  | 'documents';

export function getDprWorkflowGuidance(
  status: string,
  roles: string[],
  opts?: {
    tenderPrepAuthorized?: boolean;
    eeComplianceAssignmentPending?: boolean;
  },
): {
  headline: string;
  steps: string[];
  actions: Array<{ key: DprWorkflowStageAction; label: string; variant?: 'contained' | 'outlined' }>;
} {
  const isSuperAdmin = roles.includes('super_admin');
  const isEe = roles.includes('ee') || roles.includes('je') || roles.includes('ae');
  const isSecretariat = isSecretariatReviewer(roles) && !isSuperAdmin;

  const action = (
    key: DprWorkflowStageAction,
    label: string,
    variant: 'contained' | 'outlined' = 'contained',
  ) => ({ key, label, variant });

  const map: Record<string, ReturnType<typeof getDprWorkflowGuidance>> = {
    proposal_draft: {
      headline: 'Stage 1 — Proposal initiation',
      steps: ['Upload concept note, estimate, and GIS data.', 'Forward proposal for State / HQ review.'],
      actions: isEe && !isSuperAdmin ? [action('stage1', 'Open Stage 1')] : [action('documents', 'View documents', 'outlined')],
    },
    proposal_returned: {
      headline: 'Stage 1 — Returned for revision',
      steps: ['Fix issues noted by HQ.', 'Revise documents and resubmit.'],
      actions: [action('stage1', 'Revise & Resubmit')],
    },
    proposal_submitted: {
      headline: 'Stage 2 — Awaiting State review',
      steps: ['HQ / State officials review the proposal package.'],
      actions: canPerformHqReview(roles) ? [action('hqReview', 'State Review')] : [action('documents', 'View documents', 'outlined')],
    },
    hq_review: {
      headline: 'Stage 2 — State review in progress',
      steps: ['Approve DPR preparation or return to division.'],
      actions: canPerformHqReview(roles) ? [action('hqReview', 'State Review')] : [],
    },
    dpr_prep_approved: {
      headline: 'Stage 3 — Begin DPR preparation',
      steps: ['Upload complete DPR PDF, BOQ, designs, and supporting documents.'],
      actions: [action('stage3', isEe && !isSuperAdmin ? 'Stage 3 — Prepare' : 'Stage 3 — Review')],
    },
    dpr_preparation: {
      headline: 'Stage 3 — DPR preparation',
      steps: ['Complete all mandatory uploads.', 'Submit DPR to HQ when ready.'],
      actions: [action('stage3', isEe && !isSuperAdmin ? 'Stage 3 — Prepare' : 'Stage 3 — Review')],
    },
    dpr_submitted: {
      headline: 'Stage 4 — Forward to TAC',
      steps: ['HQ forwards package to TAC Round 1.'],
      actions: canForwardDprToTac(roles) ? [action('tacReview', 'Forward to TAC')] : [action('tacReview', 'Track TAC status', 'outlined')],
    },
    tac_round1_review: {
      headline: 'Stage 4 — TAC Round 1 review',
      steps: ['TAC examines technical feasibility, BOQ, and designs.', 'Division tracks status here.'],
      actions: [action('tacReview', canPerformTacReview(roles) ? 'TAC Review — Round 1' : 'Track TAC Status', canPerformTacReview(roles) ? 'contained' : 'outlined')],
    },
    tac_corrections_required: {
      headline: 'Stage 5 — TAC corrections required',
      steps: ['Division EE revises DPR and resubmits to TAC.'],
      actions: [action('revision', 'Stage 5 — Revise DPR')],
    },
    dpr_revision: {
      headline: 'Stage 5 — DPR revision',
      steps: ['Upload revised PDF/BOQ and resubmit to TAC.'],
      actions: [action('revision', 'Stage 5 — Revise DPR')],
    },
    tac_round1_cleared: {
      headline: 'Stage 6 — Forward to Secretariat',
      steps: ['HQ forwards cleared DPR to Secretariat / Sachiwalaya.'],
      actions: canForwardToSecretariat(roles) ? [action('secretariat', 'Stage 6 — Forward to Secretariat')] : [action('secretariat', 'Secretariat status', 'outlined')],
    },
    tac_round1_final: {
      headline: 'Stage 6 — Forward to Secretariat',
      steps: ['HQ forwards final DPR to Secretariat.'],
      actions: canForwardToSecretariat(roles) ? [action('secretariat', 'Stage 6 — Forward to Secretariat')] : [action('secretariat', 'Secretariat status', 'outlined')],
    },
    secretariat_submitted: {
      headline: 'Stage 7 — Secretariat examination',
      steps: ['Secretariat begins TAC Round 2 / Govt technical examination.'],
      actions: isSecretariat
        ? [action('tacRound2', 'Stage 7 — Begin Round 2 TAC')]
        : [action('tacRound2', 'Track Secretariat examination', 'outlined')],
    },
    tac_round2_review: {
      headline: 'Stage 7 — TAC Round 2 examination',
      steps: ['Secretariat reviews official DPR and records examination.'],
      actions: isSecretariat
        ? [action('tacRound2', 'Stage 7 — Round 2 Review')]
        : [action('tacRound2', 'Track examination', 'outlined')],
    },
    tac_round2_corrections_required: {
      headline: 'Stage 7 — Round 2 compliance required',
      steps: ['Super Admin may assign EE.', 'EE uploads revised DPR and compliance document.'],
      actions: [
        ...(isSuperAdmin ? [action('round2Liaison', 'Secretariat Liaison', 'outlined')] : []),
        ...(isEe && !isSuperAdmin ? [action('round2Compliance', 'Submit Round 2 Compliance')] : []),
      ],
    },
    tac_round2_compliance: {
      headline: 'Stage 7 — Compliance in progress',
      steps: ['EE prepares compliance response for Secretariat re-examination.'],
      actions: isEe && !isSuperAdmin
        ? [action('round2Compliance', 'Stage 7 — Submit Compliance')]
        : isSuperAdmin
          ? [action('round2Liaison', 'Secretariat Liaison')]
          : [],
    },
    tac_round2_compliance_submitted: {
      headline: 'Stage 7 — Compliance with Super Admin',
      steps: ['Super Admin reviews online before forwarding to Secretariat.'],
      actions: isSuperAdmin
        ? [action('round2ComplianceAdmin', 'Review EE Compliance')]
        : [action('round2Compliance', 'Track compliance', 'outlined')],
    },
    govt_technical_concurrence: {
      headline: 'Stage 8 — Administrative sanction',
      steps: ['Upload AA, ES, budget allocation, funding release.', 'Secretariat records sanction.'],
      actions: isSecretariat
        ? [action('sanction', 'Stage 8 — Record Sanction')]
        : [action('sanction', 'Sanction status', 'outlined')],
    },
    sanctioned: {
      headline: 'Stage 9 — Tender preparation authorization',
      steps: [
        'Super Admin authorizes Division EE.',
        'EE downloads TAC Round 2 sanctioned package.',
        'EE prepares BOQ and tender documents.',
      ],
      actions: isSuperAdmin && !opts?.tenderPrepAuthorized
        ? [action('tenderInit', 'Authorize EE — Tender Prep')]
        : isEe && !isSuperAdmin && opts?.tenderPrepAuthorized
          ? [action('tenderInit', 'Stage 9 — Download & Prepare')]
          : [action('tenderInit', 'Tender prep status', 'outlined')],
    },
    tender_prep_initiated: {
      headline: 'Stage 9–10 — Tender preparation',
      steps: ['Upload tender prep documents.', 'Begin JE → AE → EE verification.'],
      actions: [
        action('tenderInit', 'Tender Prep Status', 'outlined'),
        action('tenderProcessing', 'Stage 10 — Tender Processing'),
      ],
    },
    tender_processing: {
      headline: 'Stage 10 — Tender processing',
      steps: ['JE verifies → AE approves → EE approves.', 'UK Tender portal opens after clearance.'],
      actions: [action('tenderProcessing', 'Tender Processing')],
    },
    tender_published: {
      headline: 'Tender published',
      steps: ['Tender is live on UK Tender portal.', 'Monitor bidding and award.'],
      actions: [action('tenderProcessing', 'View published tender', 'outlined')],
    },
  };

  return map[status] ?? {
    headline: 'DPR workflow',
    steps: ['Use the stage action buttons for this proposal status.'],
    actions: [action('documents', 'View documents', 'outlined')],
  };
}
