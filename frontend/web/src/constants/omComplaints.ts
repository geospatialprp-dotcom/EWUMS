/** Stage 10 — Consumer complaint management (mirrors backend) */

export const COMPLAINT_SLA_RESOLUTION_MINS = 480;

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

export const OM_COMPLAINT_STATUS_LABELS: Record<OmComplaintStatus, string> = {
  ticket_generated: 'Ticket Generated',
  assigned: 'Assigned',
  resolution: 'Resolution',
  feedback: 'Consumer Feedback',
  closed: 'Closed',
};

export const OM_COMPLAINT_CHANNELS = [
  { code: 'mobile_app' as const, label: 'Mobile App' },
  { code: 'web_portal' as const, label: 'Web Portal' },
  { code: 'call_centre' as const, label: 'Call Centre' },
  { code: 'whatsapp' as const, label: 'WhatsApp' },
];

export const OM_COMPLAINT_TYPES = [
  { code: 'no_water_supply' as const, label: 'No Water Supply' },
  { code: 'low_pressure' as const, label: 'Low Pressure' },
  { code: 'leakage' as const, label: 'Leakage' },
  { code: 'water_quality_issue' as const, label: 'Water Quality Issue' },
  { code: 'billing_issue' as const, label: 'Billing Issue' },
  { code: 'meter_issue' as const, label: 'Meter Issue' },
];

export const OM_COMPLAINT_WORKFLOW: Array<{ status: OmComplaintStatus; label: string }> = [
  { status: 'ticket_generated', label: 'Complaint Registration / Ticket Generated' },
  { status: 'assigned', label: 'Assignment' },
  { status: 'resolution', label: 'Resolution' },
  { status: 'feedback', label: 'Consumer Feedback' },
  { status: 'closed', label: 'Closure' },
];

export function normalizeStatus(status: string): OmComplaintStatus {
  if (status === 'registered' || status === 'open') return 'ticket_generated';
  if (OM_COMPLAINT_WORKFLOW.some((s) => s.status === status)) {
    return status as OmComplaintStatus;
  }
  return 'ticket_generated';
}

export function statusChipColor(status: string): 'default' | 'warning' | 'info' | 'success' | 'error' {
  const s = normalizeStatus(status);
  if (s === 'closed') return 'success';
  if (s === 'feedback') return 'info';
  if (s === 'resolution') return 'warning';
  if (s === 'assigned') return 'info';
  return 'default';
}

export function channelChipColor(channel: string): 'default' | 'primary' | 'secondary' | 'info' {
  if (channel === 'mobile_app') return 'primary';
  if (channel === 'whatsapp') return 'secondary';
  if (channel === 'call_centre') return 'info';
  return 'default';
}
