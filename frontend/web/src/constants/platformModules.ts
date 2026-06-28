/** Final integrated S2T2R platform modules (21-module catalog) */

export type PlatformModuleStatus = 'live' | 'partial' | 'planned';

export type PlatformModuleGroup = {
  key: string;
  label: string;
  description: string;
};

export type PlatformModule = {
  id: number;
  key: string;
  title: string;
  description: string;
  group: string;
  status: PlatformModuleStatus;
  route: string;
  hash?: string;
  permission?: string;
  highlights: string[];
};

export const PLATFORM_MODULE_GROUPS: PlatformModuleGroup[] = [
  {
    key: 'planning-construction',
    label: 'Planning & Construction',
    description: 'DPR through final bill — scheme planning, execution measurement, and contractor payments.',
  },
  {
    key: 'gis-assets',
    label: 'GIS & Spatial Assets',
    description: 'Enterprise web GIS, asset registry, and scheme feature classes.',
  },
  {
    key: 'operations',
    label: 'Operations & Monitoring',
    description: 'Post-commissioning O&M, SCADA, water quality, and consumer services.',
  },
  {
    key: 'commercial',
    label: 'Commercial & Finance',
    description: 'Billing, revenue collection, arrears, and ERP general ledger integration.',
  },
  {
    key: 'intelligence',
    label: 'Analytics & Lifecycle',
    description: 'Executive dashboards, asset health, renewal planning, and predictive signals.',
  },
  {
    key: 'platform-services',
    label: 'Field & Platform Services',
    description: 'Mobile workforce, documents, QR tracking, and AI-assisted maintenance.',
  },
];

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 1,
    key: 'dpr-planning',
    title: 'DPR & Planning Management',
    description: 'DPR proposal, TAC review, Secretariat sanction, and tender initiation pipeline.',
    group: 'planning-construction',
    status: 'live',
    route: '/dpr-planning',
    permission: 'dpr_proposal:read',
    highlights: ['12-stage approval workflow', 'TAC & Secretariat review', 'AA/ES sanction recording', 'Tender initiation'],
  },
  {
    id: 2,
    key: 'construction',
    title: 'Construction Management',
    description: 'End-to-end construction workspace with dashboard, progress sync, and GIS-linked assets.',
    group: 'planning-construction',
    status: 'live',
    route: '/projects',
    hash: 'dashboard',
    permission: 'construction:read',
    highlights: ['Construction dashboard', 'Physical & financial progress', 'Workflow approvals', 'GIS construction layers'],
  },
  {
    id: 3,
    key: 'mb-management',
    title: 'MB Management',
    description: 'Measurement book entries linked to DPR and BOQ with verification workflow.',
    group: 'planning-construction',
    status: 'live',
    route: '/projects',
    hash: 'mb',
    permission: 'construction:read',
    highlights: ['MB creation & linkage to DPR', 'BOQ item-wise quantities', 'Verification & approval', 'Audit trail'],
  },
  {
    id: 4,
    key: 'boq-reconciliation',
    title: 'BOQ & Quantity Reconciliation',
    description: 'Government BOQ, L1 contractor BOQ, Excel import, and executed quantity reconciliation.',
    group: 'planning-construction',
    status: 'live',
    route: '/projects',
    hash: 'reconciliation',
    permission: 'construction:read',
    highlights: ['Original / tender BOQ', 'L1 contractor BOQ', 'Excel import', 'Executed vs billed variance'],
  },
  {
    id: 5,
    key: 'ra-bill',
    title: 'RA Bill & Contractor Payment',
    description: 'Running account bills from measured quantities with retention and payment tracking.',
    group: 'planning-construction',
    status: 'live',
    route: '/projects',
    hash: 'ra-bills',
    permission: 'construction:read',
    highlights: ['RA bill generation', 'BOQ rate application', 'Cumulative quantities', 'Payment workflow'],
  },
  {
    id: 6,
    key: 'final-bill',
    title: 'Final Bill & Project Closure',
    description: 'Final bill compilation, completion certificates, and project closure documentation.',
    group: 'planning-construction',
    status: 'live',
    route: '/projects',
    hash: 'final',
    permission: 'construction:read',
    highlights: ['Final bill panel', 'Completion & commissioning', 'Handover readiness', 'Closure reports'],
  },
  {
    id: 21,
    key: 'land-acquisition',
    title: 'Land Acquisition Management',
    description: 'GIS-integrated pipeline tracing, parcel identification, statutory clearances, compensation, and possession tracking.',
    group: 'planning-construction',
    status: 'live',
    route: '/land-acquisition',
    permission: 'la_case:read',
    highlights: ['Auto alignment trace', 'Cadastral parcel intersect', 'Clearance detection', 'DPR Stage 3/8 gates'],
  },
  {
    id: 7,
    key: 'gis-asset',
    title: 'GIS Asset Management',
    description: 'Map explorer, asset registry, project feature classes, and spatial O&M layers.',
    group: 'gis-assets',
    status: 'live',
    route: '/map',
    permission: 'asset:read',
    highlights: ['Web GIS map viewer', 'Asset registry', 'Feature class management', 'Digitize & attribute editing'],
  },
  {
    id: 8,
    key: 'om-management',
    title: 'O&M Management',
    description: '14-stage O&M workflow from handover through inspections, PM, breakdown, and contracts.',
    group: 'operations',
    status: 'live',
    route: '/om',
    permission: 'om:read',
    highlights: ['Asset handover', 'PM & breakdown', 'Contractor SLA', 'O&M reports catalogue'],
  },
  {
    id: 9,
    key: 'scada-iot',
    title: 'SCADA & IoT Monitoring',
    description: 'Real-time pump, tank, flow, and pressure telemetry with alert management.',
    group: 'operations',
    status: 'live',
    route: '/om',
    hash: 'scada-iot',
    permission: 'om:read',
    highlights: ['SCADA site panels', 'Pump & tank status', 'Threshold alerts', 'Monitoring reports'],
  },
  {
    id: 10,
    key: 'water-quality',
    title: 'Water Quality Monitoring',
    description: 'Source-to-FHTC sampling, lab parameters, compliance checks, and GIS sample mapping.',
    group: 'operations',
    status: 'live',
    route: '/om',
    hash: 'water-quality',
    permission: 'om:read',
    highlights: ['Physical / chemical / bacteriological tests', 'Compliance limits', 'Sample GIS location', 'Corrective actions'],
  },
  {
    id: 11,
    key: 'consumer-management',
    title: 'Consumer Management',
    description: 'FHTC consumer accounts, service requests, meter linkage, and GIS consumer registry.',
    group: 'operations',
    status: 'live',
    route: '/om',
    hash: 'consumer-service',
    permission: 'om:read',
    highlights: ['Consumer service requests', 'FHTC & household data', 'Meter details', 'Consumer portal'],
  },
  {
    id: 12,
    key: 'complaint-management',
    title: 'Complaint Management',
    description: 'Multi-channel complaints with SLA tracking, assignment, and resolution workflow.',
    group: 'operations',
    status: 'live',
    route: '/om',
    hash: 'complaints',
    permission: 'om:read',
    highlights: ['Complaint register', 'Channel & type catalog', 'SLA timers', 'Resolution evidence'],
  },
  {
    id: 13,
    key: 'billing-revenue',
    title: 'Billing & Revenue Management',
    description: 'Tariffs, meter readings, bill generation, collection, arrears, and 15.12 revenue reports.',
    group: 'commercial',
    status: 'live',
    route: '/billing',
    permission: 'om:read',
    highlights: ['Revenue KPIs dashboard', 'Demand & collection registers', 'GIS revenue analytics', 'Mobile billing'],
  },
  {
    id: 14,
    key: 'finance-erp',
    title: 'Finance & ERP Integration',
    description: 'Chart of accounts, auto-posting from billing, journal entries, and accounting reports.',
    group: 'commercial',
    status: 'live',
    route: '/billing',
    hash: 'accounting',
    permission: 'om:read',
    highlights: ['ERP GL chart of accounts', 'Auto-posting rules', 'Cash / bank / demand ledgers', 'Financial audit reports'],
  },
  {
    id: 15,
    key: 'asset-lifecycle',
    title: 'Asset Lifecycle Management',
    description: 'Health assessments, remaining useful life, and capital renewal / rehabilitation plans.',
    group: 'intelligence',
    status: 'live',
    route: '/om',
    hash: 'lifecycle',
    permission: 'om:read',
    highlights: ['Health index scoring', 'Renewal & replacement plans', 'Asset aging analysis', 'Annual capital planning'],
  },
  {
    id: 16,
    key: 'dashboard-analytics',
    title: 'Dashboard & Analytics',
    description: 'Executive command center, O&M GIS dashboard, and cross-module KPI analytics.',
    group: 'intelligence',
    status: 'live',
    route: '/dashboard',
    highlights: ['Executive KPIs', 'Project progress charts', 'O&M operational dashboard', 'Revenue efficiency analytics'],
  },
  {
    id: 17,
    key: 'mobile-workforce',
    title: 'Mobile Workforce Management',
    description: 'Field meter reading, mobile payments, GPS capture, offline sync, and signature capture.',
    group: 'platform-services',
    status: 'partial',
    route: '/mobile-billing',
    permission: 'om:read',
    highlights: ['Mobile billing app', 'Offline queue & sync', 'GPS & photo evidence', 'Field inspection capture (roadmap)'],
  },
  {
    id: 18,
    key: 'digital-documents',
    title: 'Digital Document Management',
    description: 'Handover document repository, construction uploads, and workflow-linked file storage.',
    group: 'platform-services',
    status: 'partial',
    route: '/om',
    hash: 'handover',
    permission: 'om:read',
    highlights: ['Handover e-repository', 'Construction planning uploads', 'Approval workflow on documents', 'Enterprise DMS (roadmap)'],
  },
  {
    id: 19,
    key: 'qr-asset-tracking',
    title: 'QR Code Asset Tracking',
    description: 'Unique asset IDs with QR payloads for field scan, inspection, and maintenance linkage.',
    group: 'platform-services',
    status: 'partial',
    route: '/om',
    hash: 'asset-registration',
    permission: 'om:read',
    highlights: ['QR generation on registration', 'Asset scan API', 'GIS-linked asset identity', 'Mobile scan app (roadmap)'],
  },
  {
    id: 20,
    key: 'ai-predictive-maintenance',
    title: 'AI-Based Predictive Maintenance',
    description: 'Health-index driven failure risk scoring and renewal prioritization using operational data.',
    group: 'platform-services',
    status: 'partial',
    route: '/om',
    hash: 'lifecycle',
    permission: 'om:read',
    highlights: ['Asset health index', 'Critical asset alerts', 'Renewal prioritization', 'ML failure prediction (roadmap)'],
  },
];

export function platformModuleStatusLabel(status: PlatformModuleStatus): string {
  if (status === 'live') return 'Live';
  if (status === 'partial') return 'Partial';
  return 'Planned';
}

export function platformModuleStatusColor(status: PlatformModuleStatus): 'success' | 'warning' | 'default' {
  if (status === 'live') return 'success';
  if (status === 'partial') return 'warning';
  return 'default';
}

export function buildPlatformModulePath(mod: PlatformModule, projectId?: string): string {
  if (mod.group === 'planning-construction' && projectId) {
    return mod.hash
      ? `/projects/${projectId}/construction#${mod.hash}`
      : `/projects/${projectId}/construction`;
  }
  return mod.hash ? `${mod.route}#${mod.hash}` : mod.route;
}

export const PLATFORM_MODULE_STATS = {
  total: PLATFORM_MODULES.length,
  live: PLATFORM_MODULES.filter((m) => m.status === 'live').length,
  partial: PLATFORM_MODULES.filter((m) => m.status === 'partial').length,
  planned: PLATFORM_MODULES.filter((m) => m.status === 'planned').length,
};
