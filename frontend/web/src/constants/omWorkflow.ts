/** 14-stage O&M workflow for rural & urban water supply schemes (JJM, UJS, AMRUT, etc.) */

export type OmStageKey =
  | 'handover'
  | 'asset-registration'
  | 'inspections'
  | 'preventive-maintenance'
  | 'breakdown'
  | 'water-quality'
  | 'energy'
  | 'scada-iot'
  | 'consumer-service'
  | 'complaints'
  | 'contracts'
  | 'lifecycle'
  | 'dashboard'
  | 'reports'
  | 'jal-mitra';

export interface OmWorkflowStage {
  stage: number;
  key: OmStageKey;
  name: string;
  summary: string;
  steps: string[];
  actors?: string[];
  integrations?: string[];
}

export const OM_WORKFLOW_STAGES: OmWorkflowStage[] = [
  {
    stage: 1,
    key: 'handover',
    name: 'Asset Handover & O&M Init',
    summary: 'Post-commissioning handover, certificates, GIS asset register, and O&M agency assignment.',
    steps: [
      'Verify Completion & Commissioning Certificates',
      'Verify As-Built Drawings & GIS Mapping',
      'Verify Asset Register & FHTC Completion',
      'Generate Handover Certificate & O&M Matrix',
    ],
    actors: ['Department', 'Contractor', 'VWSC', 'Third Party Operator'],
  },
  {
    stage: 2,
    key: 'asset-registration',
    name: 'Asset Registration & GIS',
    summary: 'Unique Asset IDs, QR codes, and GIS-linked inventory for all scheme infrastructure.',
    steps: ['Source & Transmission Assets', 'Storage & Mechanical Assets', 'Electrical & Distribution', 'Consumer / FHTC Assets'],
    integrations: ['Enterprise Web GIS', 'QR Asset Tracking'],
  },
  {
    stage: 3,
    key: 'inspections',
    name: 'Routine Inspections',
    summary: 'Daily, weekly, and monthly inspection cycles with geo-tagged evidence.',
    steps: [
      'Daily — Pump/Plant/Field Operator checks (pump hours, levels, flow, chlorine, power, leakage, geo-photos)',
      'Weekly — JE verification (pump house, reservoir, valves, network, electrical safety)',
      'Monthly — AE review (asset health, supply performance, O&M compliance, coverage, energy)',
    ],
    actors: ['Pump Operator', 'Plant Operator', 'Field Operator', 'Junior Engineer', 'Assistant Engineer'],
  },
  {
    stage: 4,
    key: 'preventive-maintenance',
    name: 'Preventive Maintenance',
    summary: 'Auto-generated PM schedules for pumps, reservoirs, and pipeline networks.',
    steps: [
      'Pump — Daily lubrication, temperature & noise checks; monthly bearing & alignment; annual overhauling',
      'Reservoir — Monthly visual inspection; quarterly cleaning & disinfection; annual structural inspection',
      'Pipeline — Monthly leakage survey; quarterly valve operation testing; annual network audit',
    ],
  },
  {
    stage: 5,
    key: 'breakdown',
    name: 'Breakdown Maintenance',
    summary: 'Ticket-based corrective maintenance for mechanical, electrical, pipeline, and service faults.',
    steps: [
      'Complaint Raised → Ticket Generated',
      'Assignment to field / maintenance team',
      'Site Inspection with GIS location & before photos',
      'Repair Work — details, materials & labour',
      'Verification with after photos',
      'Closure',
    ],
  },
  {
    stage: 6,
    key: 'water-quality',
    name: 'Water Quality Monitoring',
    summary: 'Source-to-FHTC sampling, lab results, GIS mapping, and compliance alerts.',
    steps: [
      'Sample Collection at Source / Reservoir / Network / FHTC',
      'Laboratory Testing',
      'Result Upload — Physical, Chemical & Bacteriological parameters',
      'GIS Mapping of sample location',
      'Compliance Verification with automatic limit checks',
      'Corrective Action for non-compliant samples',
    ],
  },
  {
    stage: 7,
    key: 'energy',
    name: 'Energy Management',
    summary: 'Pump energy, kWh/KL, cost analysis, and efficiency reporting.',
    steps: [
      'Daily energy log — consumption, pump hours, cost, power factor, efficiency',
      'Monthly aggregation and cost analysis',
      'Pump efficiency and kWh/KL specific energy reports',
    ],
  },
  {
    stage: 8,
    key: 'scada-iot',
    name: 'SCADA & IoT Integration',
    summary: 'Real-time reservoir, pump, power, and chlorine monitoring with automated alerts.',
    integrations: ['SCADA', 'IoT Sensors'],
    steps: [
      'Real-time reservoir water levels',
      'Pump house status, flow and pressure monitoring',
      'Electrical transformer status and power availability',
      'Chlorination residual chlorine levels',
      'Automated alerts — pump trip, reservoir levels, power failure, leakage, water quality',
    ],
  },
  {
    stage: 9,
    key: 'consumer-service',
    name: 'Consumer Service',
    summary: 'Consumer database, FHTC registry, connections, and meter lifecycle.',
    steps: [
      'Register consumer with Consumer ID, FHTC, mobile, village, GIS & meter details',
      'New Connection — activate pending FHTC connections',
      'Disconnection / Reconnection lifecycle',
      'Meter Replacement with updated meter register',
      'Ownership Transfer with new owner details',
    ],
  },
  {
    stage: 10,
    key: 'complaints',
    name: 'Complaint Management',
    summary: 'Omnichannel complaints with SLA tracking and consumer feedback.',
    steps: [
      'Complaint Registration',
      'Ticket Generation',
      'Assignment',
      'Resolution',
      'Consumer Feedback',
      'Closure',
    ],
    integrations: ['Mobile App', 'Web Portal', 'Call Centre', 'WhatsApp'],
  },
  {
    stage: 11,
    key: 'contracts',
    name: 'O&M Contract Management',
    summary: 'Contractor SLA, attendance, response time, and KPI compliance.',
    steps: [
      'Attendance Monitoring',
      'SLA Compliance Tracking',
      'Breakdown Response & Maintenance KPIs',
      'Water Quality & NRW / Energy KPIs',
      'Performance Review',
    ],
  },
  {
    stage: 12,
    key: 'lifecycle',
    name: 'Asset Lifecycle & Renewal',
    summary: 'Asset health index, remaining useful life, and capital renewal planning.',
    steps: [
      'Asset Health Index',
      'Remaining Useful Life',
      'Rehabilitation Plans',
      'Replacement Plans',
      'Annual Capital Renewal Plan',
    ],
  },
  {
    stage: 13,
    key: 'dashboard',
    name: 'GIS O&M Dashboard',
    summary: 'Real-time operational map and KPI dashboard for scheme performance.',
    steps: [
      'Asset Health Status',
      'Active Breakdowns',
      'Water Supply Status',
      'Reservoir Levels & Pump Status',
      'Water Quality & Energy',
      'Complaints & SLA Compliance',
      'Asset Renewal Requirements',
    ],
    integrations: ['Enterprise Web GIS'],
  },
  {
    stage: 14,
    key: 'reports',
    name: 'Reports & Outputs',
    summary: 'Registers, audit reports, NRW analysis, and annual O&M plans.',
    steps: [
      'O&M Asset Register',
      'Preventive Maintenance & Breakdown Registers',
      'Complaint & Water Quality Registers',
      'Energy, SCADA & Asset Health Reports',
      'Expenditure, SLA & NRW Analysis',
      'Annual O&M & Renewal Plans',
      'GIS-Based Reports & Audit Outputs',
    ],
  },
  {
    stage: 15,
    key: 'jal-mitra',
    name: 'Jal Mitra AI Assistant',
    summary: 'Multilingual consumer chatbot analytics — sessions, languages, intents, escalation, and AI accuracy.',
    steps: [
      'Monitor 24×7 consumer chat sessions',
      'Language-wise usage (Garhwali, Kumaoni, Hindi, English)',
      'Complaint and FAQ intent tracking',
      'Escalation rate to JE/AE/EE officers',
      'RAG / LLM reply performance',
    ],
    integrations: ['Consumer Portal', 'WhatsApp', 'Voice', 'Knowledge Base'],
  },
];

export const OM_ASSET_CATEGORIES = [
  { group: 'Source Infrastructure', items: ['Spring Sources', 'Gadhera Source', 'River Intakes', 'Bore Wells', 'Collection Chambers'] },
  { group: 'Transmission Infrastructure', items: ['Gravity Mains', 'Rising Mains', 'Valve Chambers', 'Air Valves', 'Scour Valves'] },
  { group: 'Storage Infrastructure', items: ['GLSR', 'OHT', 'CWR'] },
  { group: 'Mechanical Infrastructure', items: ['Pumps', 'Motors', 'Flow Meters', 'Chlorination Systems'] },
  { group: 'Electrical Infrastructure', items: ['Transformers', 'HT Lines', 'LT Panels', 'DG Sets', 'Solar Systems'] },
  { group: 'Distribution Infrastructure', items: ['Distribution Mains', 'Sub-Mains', 'Service Connections'] },
  { group: 'Consumer Infrastructure', items: ['FHTC Connections', 'Consumer Meters'] },
] as const;

export const OM_REPORT_TYPES = [
  'O&M Asset Register',
  'Preventive Maintenance Register',
  'Breakdown Register',
  'Complaint Register',
  'Water Quality Register',
  'Energy Consumption Register',
  'SCADA Monitoring Reports',
  'Asset Health Reports',
  'O&M Expenditure Reports',
  'SLA Performance Reports',
  'Annual O&M Plan',
  'Asset Renewal Plan',
  'GIS-Based O&M Reports',
  'NRW Analysis Reports',
  'Consumer Service Reports',
  'Audit Reports',
] as const;
