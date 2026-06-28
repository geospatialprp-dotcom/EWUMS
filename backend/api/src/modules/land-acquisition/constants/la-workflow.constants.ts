export type LaWorkflowGroup =
  | 'design'
  | 'gis'
  | 'clearance'
  | 'approval'
  | 'award'
  | 'handover'
  | 'construction';

export type LaWorkflowStepDef = {
  code: string;
  label: string;
  group: LaWorkflowGroup;
  groupLabel?: string;
};

/** End-to-end land acquisition workflow — GIS → clearances → multi-level approval → award → handover → construction */
export const LA_WORKFLOW_PIPELINE: readonly LaWorkflowStepDef[] = [
  { code: 'pipeline_designed', label: 'Pipeline Designed', group: 'design' },
  { code: 'gis_trace', label: 'Auto GIS Trace', group: 'gis' },
  { code: 'parcel_intersect', label: 'Intersect with Parcel Layer', group: 'gis' },
  { code: 'ownership_detected', label: 'Detect Ownership', group: 'gis' },
  { code: 'clearances_identified', label: 'Identify Required Clearances', group: 'clearance' },
  { code: 'proposal_generated', label: 'Generate Acquisition Proposal', group: 'clearance' },
  { code: 'approval_je', label: 'JE', group: 'approval', groupLabel: 'Approval Workflow' },
  { code: 'approval_ae', label: 'AE', group: 'approval' },
  { code: 'approval_ee', label: 'EE', group: 'approval' },
  { code: 'approval_se', label: 'SE', group: 'approval' },
  { code: 'approval_revenue', label: 'Revenue Department', group: 'approval' },
  { code: 'approval_forest', label: 'Forest Department', group: 'approval' },
  { code: 'approval_dm', label: 'District Magistrate', group: 'approval' },
  { code: 'approval_state', label: 'State Government', group: 'approval' },
  { code: 'award_passed', label: 'Award Passed', group: 'award' },
  { code: 'compensation_paid', label: 'Compensation Paid', group: 'award' },
  { code: 'possession_taken', label: 'Possession Taken', group: 'handover' },
  { code: 'mutation_completed', label: 'Mutation Completed', group: 'handover' },
  { code: 'construction_permission', label: 'Construction Permission Granted', group: 'construction' },
  { code: 'construction_started', label: 'Construction Started', group: 'construction' },
] as const;

/** Map legacy status codes from earlier LA releases */
export const LA_LEGACY_STATUS_MAP: Record<string, string> = {
  draft: 'pipeline_designed',
  alignment_traced: 'gis_trace',
  parcels_identified: 'parcel_intersect',
  survey_verified: 'ownership_detected',
  clearances_mapped: 'clearances_identified',
  proposal_prepared: 'proposal_generated',
  notification: 'approval_je',
  award: 'award_passed',
  payment: 'compensation_paid',
  possession: 'possession_taken',
  closed: 'construction_started',
};

export const LA_STATUSES = LA_WORKFLOW_PIPELINE.map((step, stage) => ({
  code: step.code,
  label: step.label,
  stage,
  group: step.group,
}));

export const LA_STATUS_ORDER = LA_WORKFLOW_PIPELINE.map((s) => s.code);

export const LA_WORKFLOW_TRANSITIONS: Record<string, { next: string; label: string }> = {
  pipeline_designed: { next: 'gis_trace', label: 'Confirm GIS Trace' },
  gis_trace: { next: 'parcel_intersect', label: 'Confirm Parcel Intersection' },
  parcel_intersect: { next: 'ownership_detected', label: 'Confirm Ownership Detection' },
  ownership_detected: { next: 'clearances_identified', label: 'Confirm Clearance Identification' },
  clearances_identified: { next: 'proposal_generated', label: 'Confirm Acquisition Proposal' },
  proposal_generated: { next: 'approval_je', label: 'Submit for JE Approval' },
  approval_je: { next: 'approval_ae', label: 'JE Approved — Forward to AE' },
  approval_ae: { next: 'approval_ee', label: 'AE Approved — Forward to EE' },
  approval_ee: { next: 'approval_se', label: 'EE Approved — Forward to SE' },
  approval_se: { next: 'approval_revenue', label: 'SE Approved — Forward to Revenue' },
  approval_revenue: { next: 'approval_forest', label: 'Revenue Cleared — Forward to Forest' },
  approval_forest: { next: 'approval_dm', label: 'Forest Cleared — Forward to DM' },
  approval_dm: { next: 'approval_state', label: 'DM Approved — Forward to State' },
  approval_state: { next: 'award_passed', label: 'State Approved — Record Award' },
  award_passed: { next: 'compensation_paid', label: 'Confirm Compensation Paid' },
  compensation_paid: { next: 'possession_taken', label: 'Confirm Possession Taken' },
  possession_taken: { next: 'mutation_completed', label: 'Confirm Mutation Completed' },
  mutation_completed: { next: 'construction_permission', label: 'Grant Construction Permission' },
  construction_permission: { next: 'construction_started', label: 'Confirm Construction Started' },
};

/** Minimum LA readiness for DPR Stage 3 TAC submit */
export const LA_DPR_STAGE3_MIN_STATUS = 'parcel_intersect';

/** Minimum LA readiness for DPR Stage 8 sanction */
export const LA_DPR_STAGE8_MIN_STATUS = 'clearances_identified';

export type LaWorkflowStepState = 'done' | 'current' | 'pending';

export type LaWorkflowProgressStep = LaWorkflowStepDef & {
  state: LaWorkflowStepState;
  index: number;
};

export function normalizeLaStatus(status: string): string {
  return LA_LEGACY_STATUS_MAP[status] ?? status;
}

export function getLaStatusLabel(code: string): string {
  const normalized = normalizeLaStatus(code);
  return LA_STATUSES.find((s) => s.code === normalized)?.label ?? code;
}

export function getLaStageForStatus(status: string): number {
  const normalized = normalizeLaStatus(status);
  return LA_STATUSES.find((s) => s.code === normalized)?.stage ?? 0;
}

export function laStatusAtLeast(current: string, minimum: string): boolean {
  const ci = LA_STATUS_ORDER.indexOf(normalizeLaStatus(current));
  const mi = LA_STATUS_ORDER.indexOf(normalizeLaStatus(minimum));
  if (ci < 0 || mi < 0) return false;
  return ci >= mi;
}

export function buildLaWorkflowProgress(status: string): {
  status: string;
  statusLabel: string;
  activeIndex: number;
  steps: LaWorkflowProgressStep[];
  approvalGroupLabel: string;
} {
  const normalized = normalizeLaStatus(status);
  const activeIndex = LA_STATUS_ORDER.indexOf(normalized);
  const safeIndex = activeIndex < 0 ? 0 : activeIndex;

  const steps: LaWorkflowProgressStep[] = LA_WORKFLOW_PIPELINE.map((step, index) => ({
    ...step,
    index,
    state: index < safeIndex ? 'done' : index === safeIndex ? 'current' : 'pending',
  }));

  return {
    status: normalized,
    statusLabel: getLaStatusLabel(normalized),
    activeIndex: safeIndex,
    steps,
    approvalGroupLabel: 'Approval Workflow',
  };
}
