export type OmBreakdownGroup = 'mechanical' | 'electrical' | 'pipeline' | 'consumer_service';

export type OmBreakdownStatus =
  | 'ticket_generated'
  | 'assigned'
  | 'site_inspection'
  | 'repair_work'
  | 'verification'
  | 'closed';

export interface OmBreakdownComplaintDef {
  code: string;
  label: string;
}

export interface OmBreakdownGroupDef {
  group: OmBreakdownGroup;
  label: string;
  complaints: OmBreakdownComplaintDef[];
}

export const OM_BREAKDOWN_WORKFLOW: Array<{ status: OmBreakdownStatus; label: string }> = [
  { status: 'ticket_generated', label: 'Complaint Raised / Ticket Generated' },
  { status: 'assigned', label: 'Assignment' },
  { status: 'site_inspection', label: 'Site Inspection' },
  { status: 'repair_work', label: 'Repair Work' },
  { status: 'verification', label: 'Verification' },
  { status: 'closed', label: 'Closure' },
];

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

const COMPLAINT_TO_GROUP = new Map<string, OmBreakdownGroup>();
for (const g of OM_BREAKDOWN_CATALOG) {
  for (const c of g.complaints) {
    COMPLAINT_TO_GROUP.set(c.code, g.group);
  }
}

export function getBreakdownGroupForComplaint(code: string): OmBreakdownGroup | undefined {
  return COMPLAINT_TO_GROUP.get(code);
}

export function getBreakdownComplaintLabel(code: string): string {
  for (const g of OM_BREAKDOWN_CATALOG) {
    const match = g.complaints.find((c) => c.code === code);
    if (match) return match.label;
  }
  return code.replace(/_/g, ' ');
}

export function getNextBreakdownStatus(current: OmBreakdownStatus): OmBreakdownStatus | null {
  const idx = OM_BREAKDOWN_WORKFLOW.findIndex((s) => s.status === current);
  if (idx < 0 || idx >= OM_BREAKDOWN_WORKFLOW.length - 1) return null;
  return OM_BREAKDOWN_WORKFLOW[idx + 1].status;
}

export function normalizeBreakdownStatus(status: string): OmBreakdownStatus {
  if (status === 'open') return 'ticket_generated';
  if (OM_BREAKDOWN_WORKFLOW.some((s) => s.status === status)) {
    return status as OmBreakdownStatus;
  }
  return 'ticket_generated';
}

export const VALID_BREAKDOWN_COMPLAINTS = OM_BREAKDOWN_CATALOG.flatMap((g) => g.complaints.map((c) => c.code));
