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
];

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

export const LA_STATUSES = LA_WORKFLOW_PIPELINE.map((step) => ({
  code: step.code,
  label: step.label,
  group: step.group,
}));

export type LaWorkflowStepState = 'done' | 'current' | 'pending';

export type LaWorkflowProgress = {
  status?: string;
  statusLabel?: string;
  activeIndex?: number;
  steps?: Array<LaWorkflowStepDef & { state: LaWorkflowStepState; index: number }>;
  approvalGroupLabel?: string;
};

export function normalizeLaStatus(status?: string): string {
  if (!status) return 'pipeline_designed';
  return LA_LEGACY_STATUS_MAP[status] ?? status;
}

export function laWorkflowStepLabel(code?: string): string {
  const normalized = normalizeLaStatus(code);
  return LA_STATUSES.find((s) => s.code === normalized)?.label ?? code ?? '—';
}

export function laWorkflowStepIndex(code?: string): number {
  const normalized = normalizeLaStatus(code);
  const idx = LA_WORKFLOW_PIPELINE.findIndex((s) => s.code === normalized);
  return idx < 0 ? 0 : idx;
}

export function buildLaWorkflowProgressLocal(status?: string): LaWorkflowProgress {
  const normalized = normalizeLaStatus(status);
  const activeIndex = laWorkflowStepIndex(normalized);
  return {
    status: normalized,
    statusLabel: laWorkflowStepLabel(normalized),
    activeIndex,
    approvalGroupLabel: 'Approval Workflow',
    steps: LA_WORKFLOW_PIPELINE.map((step, index) => ({
      ...step,
      index,
      state: index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'pending',
    })),
  };
}
