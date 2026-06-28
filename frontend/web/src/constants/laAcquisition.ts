import {
  LA_STATUSES,
  laWorkflowStepLabel,
  normalizeLaStatus,
  type LaWorkflowProgress,
} from './laWorkflow';

export { LA_STATUSES, laWorkflowStepLabel, normalizeLaStatus };
export type { LaWorkflowProgress };

export function laStatusLabel(code?: string): string {
  return laWorkflowStepLabel(code);
}

export function laStatusColor(status?: string): 'default' | 'warning' | 'success' | 'error' | 'info' {
  const s = normalizeLaStatus(status);
  if (!s || s === 'pipeline_designed') return 'default';
  if (s === 'construction_started') return 'success';
  if (['possession_taken', 'mutation_completed', 'construction_permission'].includes(s)) return 'success';
  if (s.startsWith('approval_')) return 'info';
  if (['clearances_identified', 'proposal_generated', 'award_passed', 'compensation_paid'].includes(s)) return 'info';
  if (['gis_trace', 'parcel_intersect', 'ownership_detected'].includes(s)) return 'warning';
  return 'default';
}

export type LaReadiness = {
  hasCase?: boolean;
  caseId?: string;
  caseNo?: string;
  status?: string;
  statusLabel?: string;
  complete?: boolean;
  canSubmitDprStage3?: boolean;
  canRecordSanction?: boolean;
  parcelsTotal?: number;
  parcelsPossession?: number;
  clearancesPending?: string[];
  estimatedCompensation?: number;
  missingActions?: string[];
};
