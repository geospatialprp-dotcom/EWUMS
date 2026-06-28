export type OmComplaintChannel = 'mobile_app' | 'web_portal' | 'call_centre' | 'whatsapp';

export type OmComplaintType =
  | 'no_water_supply'
  | 'low_pressure'
  | 'leakage'
  | 'water_quality_issue'
  | 'billing_issue'
  | 'meter_issue';

export type OmComplaintStatus =
  | 'ticket_generated'
  | 'assigned'
  | 'resolution'
  | 'feedback'
  | 'closed';

export interface OmComplaintTypeDef {
  code: OmComplaintType;
  label: string;
}

export interface OmComplaintChannelDef {
  code: OmComplaintChannel;
  label: string;
}

export const OM_COMPLAINT_CHANNELS: OmComplaintChannelDef[] = [
  { code: 'mobile_app', label: 'Mobile App' },
  { code: 'web_portal', label: 'Web Portal' },
  { code: 'call_centre', label: 'Call Centre' },
  { code: 'whatsapp', label: 'WhatsApp' },
];

export const OM_COMPLAINT_TYPES: OmComplaintTypeDef[] = [
  { code: 'no_water_supply', label: 'No Water Supply' },
  { code: 'low_pressure', label: 'Low Pressure' },
  { code: 'leakage', label: 'Leakage' },
  { code: 'water_quality_issue', label: 'Water Quality Issue' },
  { code: 'billing_issue', label: 'Billing Issue' },
  { code: 'meter_issue', label: 'Meter Issue' },
];

export const OM_COMPLAINT_WORKFLOW: Array<{ status: OmComplaintStatus; label: string }> = [
  { status: 'ticket_generated', label: 'Complaint Registration / Ticket Generated' },
  { status: 'assigned', label: 'Assignment' },
  { status: 'resolution', label: 'Resolution' },
  { status: 'feedback', label: 'Consumer Feedback' },
  { status: 'closed', label: 'Closure' },
];

export const VALID_COMPLAINT_TYPES = OM_COMPLAINT_TYPES.map((t) => t.code);
export const VALID_COMPLAINT_CHANNELS = OM_COMPLAINT_CHANNELS.map((c) => c.code);

export function getComplaintTypeLabel(code: string): string {
  return OM_COMPLAINT_TYPES.find((t) => t.code === code)?.label ?? code.replace(/_/g, ' ');
}

export function getComplaintChannelLabel(code: string): string {
  return OM_COMPLAINT_CHANNELS.find((c) => c.code === code)?.label ?? code.replace(/_/g, ' ');
}

export function getNextComplaintStatus(current: OmComplaintStatus): OmComplaintStatus | null {
  const idx = OM_COMPLAINT_WORKFLOW.findIndex((s) => s.status === current);
  if (idx < 0 || idx >= OM_COMPLAINT_WORKFLOW.length - 1) return null;
  return OM_COMPLAINT_WORKFLOW[idx + 1].status;
}

export function normalizeComplaintStatus(status: string): OmComplaintStatus {
  if (status === 'registered' || status === 'open') return 'ticket_generated';
  if (OM_COMPLAINT_WORKFLOW.some((s) => s.status === status)) {
    return status as OmComplaintStatus;
  }
  return 'ticket_generated';
}

export function getComplaintWorkflowStep(status: OmComplaintStatus): number {
  const idx = OM_COMPLAINT_WORKFLOW.findIndex((s) => s.status === status);
  return idx < 0 ? 0 : idx;
}
