/** Stage 5 — Breakdown maintenance catalogue (mirrors backend) */

export type OmBreakdownGroup = 'mechanical' | 'electrical' | 'pipeline' | 'consumer_service';

export type OmBreakdownStatus =
  | 'ticket_generated'
  | 'assigned'
  | 'site_inspection'
  | 'repair_work'
  | 'verification'
  | 'closed';

export const OM_BREAKDOWN_STATUS_LABELS: Record<OmBreakdownStatus, string> = {
  ticket_generated: 'Ticket Generated',
  assigned: 'Assigned',
  site_inspection: 'Site Inspection',
  repair_work: 'Repair Work',
  verification: 'Verification',
  closed: 'Closed',
};

export const OM_BREAKDOWN_WORKFLOW: Array<{ status: OmBreakdownStatus; label: string }> = [
  { status: 'ticket_generated', label: 'Complaint Raised / Ticket Generated' },
  { status: 'assigned', label: 'Assignment' },
  { status: 'site_inspection', label: 'Site Inspection' },
  { status: 'repair_work', label: 'Repair Work' },
  { status: 'verification', label: 'Verification' },
  { status: 'closed', label: 'Closure' },
];

export interface OmBreakdownComplaintDef {
  code: string;
  label: string;
}

export interface OmBreakdownGroupDef {
  group: OmBreakdownGroup;
  label: string;
  complaints: OmBreakdownComplaintDef[];
}

export const OM_BREAKDOWN_CATALOG: OmBreakdownGroupDef[] = [
  {
    group: 'mechanical',
    label: 'Mechanical',
    complaints: [
      { code: 'pump_failure', label: 'Pump Failure' },
      { code: 'motor_failure', label: 'Motor Failure' },
      { code: 'flow_meter_failure', label: 'Flow Meter Failure' },
    ],
  },
  {
    group: 'electrical',
    label: 'Electrical',
    complaints: [
      { code: 'transformer_failure', label: 'Transformer Failure' },
      { code: 'panel_failure', label: 'Panel Failure' },
      { code: 'power_failure', label: 'Power Supply Failure' },
    ],
  },
  {
    group: 'pipeline',
    label: 'Pipeline',
    complaints: [
      { code: 'pipe_burst', label: 'Pipe Burst' },
      { code: 'leakage', label: 'Leakage' },
      { code: 'valve_failure', label: 'Valve Failure' },
    ],
  },
  {
    group: 'consumer_service',
    label: 'Consumer Service',
    complaints: [
      { code: 'no_water_supply', label: 'No Water Supply' },
      { code: 'low_pressure', label: 'Low Pressure' },
      { code: 'water_quality', label: 'Water Quality Complaint' },
    ],
  },
];

export function statusChipColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'closed') return 'success';
  if (status === 'ticket_generated') return 'warning';
  if (status === 'verification') return 'info';
  return 'default';
}

export function normalizeStatus(status: string): OmBreakdownStatus {
  if (status === 'open') return 'ticket_generated';
  return status as OmBreakdownStatus;
}
