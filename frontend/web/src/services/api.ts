import axios from 'axios';
import { acceptLanguageHeader } from '../i18n';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized: (() => void) | null = null;
let activeDivisionIdGetter: (() => string | null) | null = null;

export function setActiveDivisionIdGetter(getter: () => string | null) {
  activeDivisionIdGetter = getter;
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('egip_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const divisionId = activeDivisionIdGetter?.();
  if (divisionId) {
    config.headers['X-Active-Division-Id'] = divisionId;
  }
  config.headers['Accept-Language'] = acceptLanguageHeader();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      if (!url.includes('/auth/login')) {
        onUnauthorized?.();
      }
    }
    return Promise.reject(error);
  },
);

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };
}

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  status: string;
  roles: Array<{ id: string; code: string; name: string }>;
  createdAt: string;
}

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  permissions: Array<{ id: string; resource: string; action: string; key: string }>;
}

export interface WorkflowInboxItem {
  taskId: string;
  stepOrder: number;
  stepName: string;
  assignedRole: string;
  createdAt: string;
  instance: {
    id: string;
    title: string;
    resourceType: string;
    resourceId: string | null;
    status: string;
    currentStep: number;
    payload: Record<string, unknown>;
    submittedBy: string;
    submittedAt: string;
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  profile: () => api.get('/auth/profile'),
};

export const assetsApi = {
  list: (params?: { status?: string; assetType?: string; bbox?: string }) =>
    api.get('/assets', { params }),
  get: (id: string) => api.get(`/assets/${id}`),
  types: () => api.get('/assets/types'),
  create: (data: object) => api.post('/assets', data),
  spatialQuery: (data: {
    operation: string;
    geometry: object;
    distance?: number;
    assetType?: string;
    status?: string;
  }) => api.post('/assets/spatial-query', data),
};

export const gisApi = {
  mapAccess: (divisionId?: string) => api.get('/gis/map-access', {
    params: divisionId ? { divisionId } : undefined,
  }),
  mapAudit: (data: {
    action: string;
    layerId?: string;
    layerName?: string;
    projectId?: string;
    details?: Record<string, unknown>;
  }) => api.post('/gis/map-audit', data),
  layers: () => api.get('/gis/layers'),
  layerFeatures: (layerId: string) => api.get<LayerFeaturesResponse | Array<Record<string, unknown>>>(`/gis/layers/${layerId}/features`),
  checkLayerJurisdiction: async (layerId: string) => {
    const res = await api.get<LayerFeaturesResponse | Array<Record<string, unknown>>>(`/gis/layers/${layerId}/features`);
    const data = res.data;
    if (Array.isArray(data)) {
      return { allowed: true, jurisdiction: null as LayerJurisdictionMeta | null };
    }
    const blocked = Boolean(data.jurisdiction?.blockedOutsideDistrict);
    return {
      allowed: !blocked,
      jurisdiction: data.jurisdiction ?? null,
      message: blocked
        ? (data.jurisdiction?.message ?? 'This layer is outside your authorized district boundary.')
        : null,
    };
  },
  spatialQuery: (data: {
    operation: 'intersect' | 'within' | 'contains' | 'buffer';
    geometry: object;
    layerId: string;
    distance?: number;
  }) => api.post<import('../utils/spatialAnalysis').SpatialQueryResponse>('/gis/spatial-query', data),
};

export interface MapAccessDivision {
  id: string;
  code: string;
  name: string;
  region: string | null;
  district: string | null;
  isHeadquarters: boolean;
}

export interface LayerJurisdictionMeta {
  restricted: boolean;
  districtNames: string[];
  totalCount: number;
  visibleCount: number;
  hiddenOutsideBoundary: number;
  blockedOutsideDistrict?: boolean;
  message: string | null;
}

export interface LayerFeaturesResponse {
  features: Array<{
    type: 'Feature';
    id?: string;
    geometry: object;
    properties?: Record<string, unknown>;
  }>;
  jurisdiction: LayerJurisdictionMeta;
}

export interface MapAccessContext {
  accessScope: 'global' | 'state' | 'circle' | 'division';
  canViewAllDivisions: boolean;
  jurisdictionLabel: string;
  jurisdictionRestricted?: boolean;
  boundaryNotice?: string | null;
  districtNames: string[];
  activeDistrictName: string | null;
  districtBoundaries: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      id?: string;
      geometry: object;
      properties?: Record<string, unknown>;
    }>;
  };
  divisions: MapAccessDivision[];
  activeDivisionId: string | null;
  mapView: { center: [number, number]; zoom: number };
  bbox: [number, number, number, number];
  allowedProjectCount: number | null;
}

export const dashboardApi = {
  executive: () => api.get('/dashboard/executive'),
};

export const tenantsApi = {
  current: () => api.get('/tenants/current'),
};

export interface Division {
  id: string;
  code: string;
  name: string;
  region?: string | null;
  isHeadquarters?: boolean;
  status?: string;
}

export const divisionsApi = {
  list: () => api.get<Division[]>('/divisions'),
  access: () => api.get<{
    divisionSchemaReady: boolean;
    divisionId: string | null;
    divisionCode: string | null;
    divisionName: string | null;
    canViewAllDivisions: boolean;
    roles: string[];
    setupHint?: string | null;
  }>('/divisions/access'),
  staffLogins: () => api.get<{
    headOffice: DivisionStaffLogin[];
    divisions: Array<{ divisionName: string; accounts: DivisionStaffLogin[] }>;
  }>('/divisions/staff-logins'),
};

export type OrthomosaicConfig = {
  sourceType?: 'xyz' | 'file';
  tileUrl?: string;
  fileName?: string | null;
  fileUrl?: string | null;
  name?: string | null;
  attribution?: string | null;
  maxZoom?: number | null;
};

export interface DivisionStaffLogin {
  role: string;
  roleLabel: string;
  email: string;
  password: string;
  created: boolean;
}

export type PortfolioReadinessPhase = 'no_dpr' | 'awaiting_tender' | 'ready';

export type PortfolioReadiness = {
  phase: PortfolioReadinessPhase;
  constructionUnlocked: boolean;
  canCreateProject: boolean;
  publishedTenderCount: number;
  pipelineProposalCount: number;
  projectCount: number;
  readySchemes: Array<{
    id: string;
    proposalNo: string;
    title: string;
    divisionId: string | null;
  }>;
};

export const projectsApi = {
  list: () => api.get('/projects'),
  portfolioReadiness: () => api.get<PortfolioReadiness>('/projects/portfolio-readiness'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: {
    name: string;
    projectCode?: string;
    description?: string;
    status?: string;
    divisionId?: string;
    dprProposalId?: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    spent?: number;
    orthomosaicConfig?: OrthomosaicConfig | null;
  }) => api.post<{
    id: string;
    projectCode: string;
    divisionId?: string | null;
    divisionStaffLogins?: DivisionStaffLogin[];
  }>('/projects', data),
  update: (id: string, data: {
    name?: string;
    projectCode?: string;
    description?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    spent?: number;
    orthomosaicConfig?: OrthomosaicConfig | null;
  }) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  uploadOrthomosaic: (projectId: string, file: File, name?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name?.trim()) formData.append('name', name.trim());
    return api.post(`/projects/${projectId}/orthomosaic/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      maxContentLength: 300 * 1024 * 1024,
      maxBodyLength: 300 * 1024 * 1024,
    });
  },
  removeOrthomosaic: (projectId: string) => api.delete(`/projects/${projectId}/orthomosaic`),
  createMilestone: (projectId: string, data: MilestonePayload) =>
    api.post(`/projects/${projectId}/milestones`, data),
  updateMilestone: (projectId: string, milestoneId: string, data: MilestonePayload) =>
    api.patch(`/projects/${projectId}/milestones/${milestoneId}`, data),
  deleteMilestone: (projectId: string, milestoneId: string) =>
    api.delete(`/projects/${projectId}/milestones/${milestoneId}`),
};

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'on_hold'
  | 'delayed';

export interface MilestonePayload {
  name?: string;
  dueDate?: string;
  completedDate?: string;
  status?: MilestoneStatus;
  progress?: number;
  sortOrder?: number;
}

export type AttributeFieldType = 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'select' | 'image';

export interface AttributeField {
  name: string;
  label: string;
  type: AttributeFieldType;
  required?: boolean;
  options?: string[];
}

export interface FeatureClassRecord {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description?: string;
  geometryType: 'Point' | 'LineString' | 'Polygon' | 'Any';
  attributeSchema: AttributeField[];
  featureCount?: number;
  sortOrder: number;
}

export interface ProjectFeatureRecord {
  type: 'Feature';
  id: string;
  geometry: object | null;
  properties: {
    featureClassId: string;
    featureClassCode: string;
    featureClassName: string;
    geometryType: string;
    attributes: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
}

export const featureClassesApi = {
  list: (projectId: string) =>
    api.get<FeatureClassRecord[]>(`/projects/${projectId}/feature-classes`),
  get: (projectId: string, classId: string) =>
    api.get<FeatureClassRecord>(`/projects/${projectId}/feature-classes/${classId}`),
  create: (projectId: string, data: object) =>
    api.post<FeatureClassRecord>(`/projects/${projectId}/feature-classes`, data),
  scaffoldLaGisLayers: (projectId: string) =>
    api.post<{
      totalTemplates: number;
      created: number;
      skipped: number;
      items: Array<{
        code: string;
        name: string;
        status: 'created' | 'skipped';
        id?: string;
        reason?: string;
        matchedAlias?: string;
      }>;
    }>(`/projects/${projectId}/feature-classes/scaffold-la-gis-layers`),
  update: (projectId: string, classId: string, data: object) =>
    api.patch<FeatureClassRecord>(`/projects/${projectId}/feature-classes/${classId}`, data),
  remove: (projectId: string, classId: string) =>
    api.delete(`/projects/${projectId}/feature-classes/${classId}`),
  listFeatures: (projectId: string, classId: string) =>
    api.get<ProjectFeatureRecord[]>(`/projects/${projectId}/feature-classes/${classId}/features`),
  createFeature: (projectId: string, classId: string, data: object) =>
    api.post<ProjectFeatureRecord>(`/projects/${projectId}/feature-classes/${classId}/features`, data),
  importFeatures: (projectId: string, classId: string, data: { features: object[] }) =>
    api.post<{ imported: number; failed: Array<{ index: number; reason: string }>; total: number }>(
      `/projects/${projectId}/feature-classes/${classId}/features/import`,
      data,
    ),
  updateFeature: (projectId: string, featureId: string, data: object) =>
    api.patch<ProjectFeatureRecord>(`/projects/${projectId}/features/${featureId}`, data),
  removeFeature: (projectId: string, featureId: string) =>
    api.delete(`/projects/${projectId}/features/${featureId}`),
};

export const usersApi = {
  list: () => api.get<UserRecord[]>('/users'),
  get: (id: string) => api.get<UserRecord>(`/users/${id}`),
  create: (data: object) => api.post<UserRecord>('/users', data),
  update: (id: string, data: object) => api.patch<UserRecord>(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`),
};

export const rolesApi = {
  list: () => api.get<RoleRecord[]>('/roles'),
  permissions: () => api.get('/roles/permissions'),
};

export const workflowsApi = {
  definitions: () => api.get('/workflows/definitions'),
  inbox: () => api.get<WorkflowInboxItem[]>('/workflows/inbox'),
  submissions: () => api.get('/workflows/submissions'),
  instances: () => api.get('/workflows/instances'),
  submit: (data: { definitionCode: string; title: string; resourceId?: string; payload?: object }) =>
    api.post('/workflows/submit', data),
  actOnTask: (taskId: string, data: { action: 'approve' | 'reject'; comments?: string }) =>
    api.post(`/workflows/tasks/${taskId}/act`, data),
};

export const auditApi = {
  logs: (limit?: number) => api.get('/audit/logs', { params: { limit } }),
};

export type SchemeType = 'gravity' | 'pumping';
export type ProjectComponent = 'source_development' | 'gravity_main' | 'pumping_main' | 'reservoir' | 'distribution' | 'fhtc';

export const constructionApi = {
  overview: (projectId: string) => api.get(`/projects/${projectId}/construction/overview`),
  dashboard: (projectId: string) => api.get(`/projects/${projectId}/construction/dashboard`),
  boqReconciliation: (projectId: string) => api.get(`/projects/${projectId}/construction/boq-reconciliation`),
  reports: (projectId: string) => api.get(`/projects/${projectId}/construction/reports`),
  workPackages: (projectId: string) => api.get(`/projects/${projectId}/construction/work-packages`),
  createWorkPackage: (projectId: string, data: object) =>
    api.post(`/projects/${projectId}/construction/work-packages`, data),
  updateWorkPackage: (projectId: string, id: string, data: object) =>
    api.put(`/projects/${projectId}/construction/work-packages/${id}`, data),
  workPlanning: (projectId: string) => api.get(`/projects/${projectId}/construction/work-planning`),
  updateWorkPlanning: (projectId: string, data: object) =>
    api.put(`/projects/${projectId}/construction/work-planning`, data),
  boq: (projectId: string, params?: { schemeType?: SchemeType; component?: ProjectComponent; boqSource?: 'government' | 'l1_contractor' }) =>
    api.get(`/projects/${projectId}/construction/boq`, { params }),
  importBoq: (projectId: string, data: { fileName?: string; replaceExisting?: boolean; boqSource?: string; items: object[] }) =>
    api.post(`/projects/${projectId}/construction/boq/import`, data),
  uploadBoqExcel: (projectId: string, file: File, boqSource: 'government' | 'l1_contractor' = 'government') => {
    const form = new FormData();
    form.append('file', file);
    form.append('boqSource', boqSource);
    return api.post(`/projects/${projectId}/construction/boq/upload-excel`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  listDprs: (projectId: string) => api.get(`/projects/${projectId}/construction/dprs`),
  getDpr: (projectId: string, id: string) => api.get(`/projects/${projectId}/construction/dprs/${id}`),
  createDpr: (projectId: string, data: object) => api.post(`/projects/${projectId}/construction/dprs`, data),
  updateDpr: (projectId: string, id: string, data: object) => api.put(`/projects/${projectId}/construction/dprs/${id}`, data),
  submitDpr: (projectId: string, id: string) => api.post(`/projects/${projectId}/construction/dprs/${id}/submit`),
  dprWorkflow: (projectId: string, id: string, data: { action: 'approve' | 'reject'; comments?: string }) =>
    api.post(`/projects/${projectId}/construction/dprs/${id}/workflow`, data),
  listMbs: (projectId: string) => api.get(`/projects/${projectId}/construction/measurement-books`),
  getMb: (projectId: string, id: string) => api.get(`/projects/${projectId}/construction/measurement-books/${id}`),
  createMb: (projectId: string, data: object) => api.post(`/projects/${projectId}/construction/measurement-books`, data),
  updateMb: (projectId: string, id: string, data: object) => api.put(`/projects/${projectId}/construction/measurement-books/${id}`, data),
  submitMb: (projectId: string, id: string) => api.post(`/projects/${projectId}/construction/measurement-books/${id}/submit`),
  mbWorkflow: (projectId: string, id: string, data: { action: 'approve' | 'reject'; comments?: string }) =>
    api.post(`/projects/${projectId}/construction/measurement-books/${id}/workflow`, data),
  listRaBills: (projectId: string) => api.get(`/projects/${projectId}/construction/ra-bills`),
  getRaBill: (projectId: string, id: string) => api.get(`/projects/${projectId}/construction/ra-bills/${id}`),
  generateRaBill: (projectId: string, data: object) =>
    api.post(`/projects/${projectId}/construction/ra-bills/generate`, data),
  submitRaBill: (projectId: string, id: string) => api.post(`/projects/${projectId}/construction/ra-bills/${id}/submit`),
  deleteRaBill: (projectId: string, id: string) => api.delete(`/projects/${projectId}/construction/ra-bills/${id}`),
  raBillWorkflow: (projectId: string, id: string, data: { action: 'approve' | 'reject'; comments?: string }) =>
    api.post(`/projects/${projectId}/construction/ra-bills/${id}/workflow`, data),
  listInvoices: (projectId: string) => api.get(`/projects/${projectId}/construction/invoices`),
  getInvoice: (projectId: string, id: string) => api.get(`/projects/${projectId}/construction/invoices/${id}`),
  createInvoice: (projectId: string, data: object) => api.post(`/projects/${projectId}/construction/invoices`, data),
  invoiceFromMb: (projectId: string, mbId: string, invoiceNumber: string) =>
    api.post(`/projects/${projectId}/construction/invoices/from-mb/${mbId}`, { invoiceNumber }),
  submitInvoice: (projectId: string, id: string) => api.post(`/projects/${projectId}/construction/invoices/${id}/submit`),
  invoiceWorkflow: (projectId: string, id: string, data: { action: 'approve' | 'reject'; comments?: string }) =>
    api.post(`/projects/${projectId}/construction/invoices/${id}/workflow`, data),
  listAssets: (projectId: string, assetType?: string) =>
    api.get(`/projects/${projectId}/construction/assets`, { params: { assetType } }),
  createAsset: (projectId: string, data: object) => api.post(`/projects/${projectId}/construction/assets`, data),
  updateAsset: (projectId: string, assetId: string, data: object) =>
    api.put(`/projects/${projectId}/construction/assets/${assetId}`, data),
  deleteAsset: (projectId: string, assetId: string) =>
    api.delete(`/projects/${projectId}/construction/assets/${assetId}`),
  listDocuments: (projectId: string, params?: { resourceType?: string; resourceId?: string }) =>
    api.get(`/projects/${projectId}/construction/documents`, { params }),
  completion: (projectId: string) => api.get(`/projects/${projectId}/construction/completion`),
  finalBillPreparation: (projectId: string) =>
    api.get(`/projects/${projectId}/construction/final-bill-preparation`),
  verifyCompletion: (projectId: string, data: {
    asBuiltVerified?: boolean;
    reservoirCommissioned?: boolean;
    pumpingCommissioned?: boolean;
  }) => api.patch(`/projects/${projectId}/construction/completion/verify`, data),
  generateFinalBill: (projectId: string, data: {
    invoiceNumber: string;
    recoveries?: number;
    remarks?: string;
  }) => api.post(`/projects/${projectId}/construction/final-bill/generate`, data),
  uploadDocument: (projectId: string, data: object) => api.post(`/projects/${projectId}/construction/documents`, data),
  uploadDocumentFile: (projectId: string, formData: FormData) => api.post(
    `/projects/${projectId}/construction/documents/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  ),
  fetchDocumentFile: async (projectId: string, docId: string, download = false) => {
    const { data } = await api.get(
      `/projects/${projectId}/construction/documents/${docId}/file`,
      { responseType: 'blob', params: download ? { download: '1' } : undefined },
    );
    return data as Blob;
  },
};

export const omApi = {
  stages: () => api.get('/om/stages'),
  dashboard: () => api.get('/om/dashboard'),
  listHandovers: (projectId?: string) => api.get('/om/handovers', { params: projectId ? { projectId } : undefined }),
  getHandover: (id: string) => api.get(`/om/handovers/${id}`),
  getHandoverPrefill: (projectId: string) => api.get(`/om/handovers/prefill/${projectId}`),
  createHandover: (data: object) => api.post('/om/handovers', data),
  updateHandover: (id: string, data: object) => api.patch(`/om/handovers/${id}`, data),
  generateHandover: (id: string) => api.post(`/om/handovers/${id}/generate`),
  submitHandover: (id: string) => api.post(`/om/handovers/${id}/submit`),
  actOnHandover: (id: string, data: { action: 'approve' | 'reject'; comments?: string }) =>
    api.post(`/om/handovers/${id}/workflow`, data),
  listHandoverDocuments: (handoverId: string) => api.get(`/om/handovers/${handoverId}/documents`),
  uploadHandoverDocument: (handoverId: string, docType: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', docType);
    return api.post(`/om/handovers/${handoverId}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  actOnHandoverDocument: (handoverId: string, docId: string, data: { action: 'approve' | 'reject'; comments?: string }) =>
    api.patch(`/om/handovers/${handoverId}/documents/${docId}`, data),
  fetchHandoverDocumentFile: async (handoverId: string, docId: string) => {
    const { data } = await api.get(`/om/handovers/${handoverId}/documents/${docId}/file`, { responseType: 'blob' });
    return data as Blob;
  },
  getAssetCatalog: () => api.get('/om/assets/catalog'),
  listSchemeAssets: (params?: { projectId?: string; projectCode?: string; handoverId?: string; category?: string; typeCode?: string }) =>
    api.get('/om/assets', { params }),
  getSchemeAsset: (id: string) => api.get(`/om/assets/${id}`),
  registerAsset: (data: object) => api.post('/om/assets', data),
  updateSchemeAsset: (id: string, data: object) => api.patch(`/om/assets/${id}`, data),
  importConstructionAssets: (params: { projectId?: string; projectCode?: string; handoverId?: string }) =>
    api.post('/om/assets/import-construction', params),
  getAssetQr: (id: string) => api.get(`/om/assets/${id}/qr`),
  getInspectionCatalog: () => api.get('/om/inspections/catalog'),
  inspectionSummary: (projectId?: string) =>
    api.get('/om/inspections/summary', { params: projectId ? { projectId } : undefined }),
  listInspections: (params?: {
    projectId?: string;
    projectCode?: string;
    inspectionType?: string;
    from?: string;
    to?: string;
  }) => api.get('/om/inspections', { params }),
  getInspection: (id: string) => api.get(`/om/inspections/${id}`),
  createInspection: (data: object) => api.post('/om/inspections', data),
  getPmCatalog: () => api.get('/om/maintenance/catalog'),
  pmSummary: (projectId?: string) =>
    api.get('/om/maintenance/summary', { params: projectId ? { projectId } : undefined }),
  listPmSchedules: (params?: {
    projectId?: string;
    projectCode?: string;
    category?: string;
    frequency?: string;
    status?: string;
  }) => api.get('/om/maintenance/schedules', { params }),
  generatePmSchedules: (data: object) => api.post('/om/maintenance/generate', data),
  completePmSchedule: (id: string, data?: object) =>
    api.patch(`/om/maintenance/schedules/${id}/complete`, data ?? {}),
  listBreakdowns: (params?: {
    status?: string;
    projectId?: string;
    projectCode?: string;
    categoryGroup?: string;
  }) => api.get('/om/breakdown-tickets', { params }),
  getBreakdown: (id: string) => api.get(`/om/breakdown-tickets/${id}`),
  getBreakdownCatalog: () => api.get('/om/breakdown/catalog'),
  breakdownSummary: (projectId?: string) =>
    api.get('/om/breakdown/summary', { params: projectId ? { projectId } : undefined }),
  createBreakdown: (data: object) => api.post('/om/breakdown-tickets', data),
  advanceBreakdown: (id: string, data?: object) =>
    api.patch(`/om/breakdown-tickets/${id}/advance`, data ?? {}),
  getWqCatalog: () => api.get('/om/water-quality/catalog'),
  wqSummary: (projectId?: string) =>
    api.get('/om/water-quality/summary', { params: projectId ? { projectId } : undefined }),
  listWqTests: (params?: {
    projectId?: string;
    projectCode?: string;
    samplePoint?: string;
    status?: string;
    compliantOnly?: string;
    alertsOnly?: string;
  }) => api.get('/om/water-quality/tests', { params }),
  getWqTest: (id: string) => api.get(`/om/water-quality/tests/${id}`),
  createWqTest: (data: object) => api.post('/om/water-quality/tests', data),
  advanceWqTest: (id: string, data?: object) =>
    api.patch(`/om/water-quality/tests/${id}/advance`, data ?? {}),
  getEnergyCatalog: () => api.get('/om/energy/catalog'),
  energySummary: (projectId?: string, from?: string, to?: string) =>
    api.get('/om/energy/summary', { params: { projectId, from, to } }),
  listEnergyReadings: (params?: {
    projectId?: string;
    projectCode?: string;
    from?: string;
    to?: string;
  }) => api.get('/om/energy/readings', { params }),
  createEnergyReading: (data: object) => api.post('/om/energy/readings', data),
  generateEnergyReport: (
    type: string,
    params?: { projectId?: string; projectCode?: string; from?: string; to?: string },
  ) => api.get(`/om/energy/reports/${type}`, { params }),
  getScadaCatalog: () => api.get('/om/scada/catalog'),
  scadaDashboard: (params?: { projectId?: string; projectCode?: string }) =>
    api.get('/om/scada/dashboard', { params }),
  scadaSummary: (projectId?: string) =>
    api.get('/om/scada/summary', { params: projectId ? { projectId } : undefined }),
  listScadaReadings: (params?: {
    projectId?: string;
    projectCode?: string;
    siteCategory?: string;
    metricKey?: string;
  }) => api.get('/om/scada/readings', { params }),
  ingestScadaReading: (data: object) => api.post('/om/scada/readings', data),
  simulateScada: (params?: { projectId?: string; projectCode?: string }) =>
    api.post('/om/scada/simulate', {}, { params }),
  listScadaAlerts: (params?: {
    projectId?: string;
    projectCode?: string;
    status?: string;
    alertType?: string;
  }) => api.get('/om/scada/alerts', { params }),
  acknowledgeScadaAlert: (id: string) => api.patch(`/om/scada/alerts/${id}/acknowledge`),
  resolveScadaAlert: (id: string) => api.patch(`/om/scada/alerts/${id}/resolve`),
  getConsumerCatalog: () => api.get('/om/consumers/catalog'),
  consumerSummary: (projectId?: string) =>
    api.get('/om/consumers/summary', { params: projectId ? { projectId } : undefined }),
  listConsumers: (params?: {
    projectId?: string;
    projectCode?: string;
    village?: string;
    status?: string;
  }) => api.get('/om/consumers', { params }),
  listOpenConsumerServiceRequests: (params?: {
    projectId?: string;
    projectCode?: string;
    status?: string;
    requestType?: string;
  }) => api.get('/om/consumers/service-requests', { params }),
  getConsumer: (id: string) => api.get(`/om/consumers/${id}`),
  registerConsumer: (data: object) => api.post('/om/consumers', data),
  listConsumerServiceRequests: (consumerId: string, status?: string) =>
    api.get(`/om/consumers/${consumerId}/service-requests`, { params: status ? { status } : undefined }),
  createConsumerServiceRequest: (consumerId: string, data: object) =>
    api.post(`/om/consumers/${consumerId}/service-requests`, data),
  completeConsumerServiceRequest: (consumerId: string, requestId: string) =>
    api.patch(`/om/consumers/${consumerId}/service-requests/${requestId}/complete`, {}),
  getComplaintCatalog: () => api.get('/om/complaints/catalog'),
  complaintSummary: (projectId?: string) =>
    api.get('/om/complaints/summary', { params: projectId ? { projectId } : undefined }),
  listComplaints: (params?: {
    projectId?: string;
    projectCode?: string;
    status?: string;
    channel?: string;
    complaintType?: string;
  }) => api.get('/om/complaints', { params }),
  listComplaintAssignees: (projectCode?: string) =>
    api.get('/om/complaints/assignees', { params: projectCode ? { projectCode } : undefined }),
  getComplaint: (id: string) => api.get(`/om/complaints/${id}`),
  registerComplaint: (data: object) => api.post('/om/complaints', data),
  advanceComplaint: (id: string, data?: object) =>
    api.patch(`/om/complaints/${id}/advance`, data ?? {}),
  getContractCatalog: () => api.get('/om/contracts/catalog'),
  contractSummary: (projectId?: string) =>
    api.get('/om/contracts/summary', { params: projectId ? { projectId } : undefined }),
  listContracts: (params?: { projectId?: string; projectCode?: string; status?: string }) =>
    api.get('/om/contracts', { params }),
  getContract: (id: string) => api.get(`/om/contracts/${id}`),
  createContract: (data: object) => api.post('/om/contracts', data),
  contractPerformance: (id: string) => api.get(`/om/contracts/${id}/performance`),
  listContractAttendance: (id: string) => api.get(`/om/contracts/${id}/attendance`),
  recordContractAttendance: (id: string, data: object) => api.post(`/om/contracts/${id}/attendance`, data),
  listContractKpiEntries: (id: string) => api.get(`/om/contracts/${id}/kpi-entries`),
  recordContractKpi: (id: string, data: object) => api.post(`/om/contracts/${id}/kpi-entries`, data),
  listContractReviews: (id: string) => api.get(`/om/contracts/${id}/reviews`),
  createContractReview: (id: string, data: object) => api.post(`/om/contracts/${id}/reviews`, data),
  getLifecycleCatalog: () => api.get('/om/lifecycle/catalog'),
  lifecycleSummary: (projectId?: string) =>
    api.get('/om/lifecycle/summary', { params: projectId ? { projectId } : undefined }),
  listLifecycleAssets: (params?: {
    projectId?: string;
    projectCode?: string;
    lifecycleCategory?: string;
  }) => api.get('/om/lifecycle/assets', { params }),
  getLifecycleAsset: (id: string) => api.get(`/om/lifecycle/assets/${id}`),
  assessLifecycleAsset: (id: string, data: object) => api.post(`/om/lifecycle/assets/${id}/assess`, data),
  listAssetAssessments: (id: string) => api.get(`/om/lifecycle/assets/${id}/assessments`),
  listRenewalPlans: (params?: {
    projectId?: string;
    projectCode?: string;
    planType?: string;
    planYear?: number;
    status?: string;
  }) => api.get('/om/lifecycle/plans', { params }),
  createRenewalPlan: (data: object) => api.post('/om/lifecycle/plans', data),
  generateRenewalPlans: (data?: object) => api.post('/om/lifecycle/plans/generate', data ?? {}),
  generateAnnualRenewalPlan: (data: object) => api.post('/om/lifecycle/plans/generate-annual', data),
  updateRenewalPlan: (id: string, data: object) => api.patch(`/om/lifecycle/plans/${id}`, data),
  getGisDashboardCatalog: () => api.get('/om/gis-dashboard/catalog'),
  gisDashboard: (params?: { projectId?: string; projectCode?: string }) =>
    api.get('/om/gis-dashboard', { params }),
  getReportsCatalog: () => api.get('/om/reports/catalog'),
  generateReport: (
    type: string,
    params?: { projectId?: string; projectCode?: string; from?: string; to?: string; planYear?: number },
  ) => api.get(`/om/reports/${type}`, { params }),
  getBillingCatalog: () => api.get('/om/billing/catalog'),
  billingSummary: (projectId?: string) =>
    api.get('/om/billing/summary', { params: projectId ? { projectId } : undefined }),
  listBillingAccounts: (params?: { projectId?: string; projectCode?: string }) =>
    api.get('/om/billing/accounts', { params }),
  createConsumerAccount: (data: object) => api.post('/om/billing/accounts', data),
  linkBillingAccount: (consumerId: string, data: object) =>
    api.patch(`/om/billing/accounts/${consumerId}`, data),
  listBillingTariffs: (params?: { projectId?: string; projectCode?: string; status?: string }) =>
    api.get('/om/billing/tariffs', { params }),
  createBillingTariff: (data: object) => api.post('/om/billing/tariffs', data),
  listMeterReadings: (params?: { projectId?: string; projectCode?: string; consumerId?: string }) =>
    api.get('/om/billing/meter-readings', { params }),
  recordMeterReading: (consumerId: string, data: object) =>
    api.post(`/om/billing/consumers/${consumerId}/meter-readings`, data),
  listBills: (params?: { projectId?: string; projectCode?: string; consumerId?: string; status?: string }) =>
    api.get('/om/billing/bills', { params }),
  getBill: (id: string) => api.get(`/om/billing/bills/${id}`),
  generateBills: (data: object) => api.post('/om/billing/bills/generate', data),
  updateBillStatus: (id: string, status: string) =>
    api.patch(`/om/billing/bills/${id}/status`, { status }),
  deliverBill: (id: string, channels: string[]) =>
    api.post(`/om/billing/bills/${id}/deliver`, { channels }),
  recordBillingPayment: (data: object) => api.post('/om/billing/payments', data),
  listBillingPayments: (params?: { projectId?: string; projectCode?: string; consumerId?: string }) =>
    api.get('/om/billing/payments', { params }),
  getBillingPayment: (id: string) => api.get(`/om/billing/payments/${id}`),
  getRevenueRegister: (params?: { projectId?: string; projectCode?: string; periodFrom?: string; periodTo?: string }) =>
    api.get('/om/billing/revenue-register', { params }),
  getDemandRegister: (params?: {
    projectId?: string;
    projectCode?: string;
    village?: string;
    groupBy?: string;
    periodFrom?: string;
    periodTo?: string;
  }) => api.get('/om/billing/demand-register', { params }),
  generateDemandRegister: (data: object) => api.post('/om/billing/demand-register/generate', data),
  getBillingArrears: (params?: { projectId?: string; projectCode?: string; bucket?: string }) =>
    api.get('/om/billing/arrears', { params }),
  sendArrearAction: (billId: string, action: string) =>
    api.post(`/om/billing/arrears/${billId}/action`, { action }),
  getGisRevenue: (params?: { projectId?: string; projectCode?: string }) =>
    api.get('/om/billing/gis-revenue', { params }),
  generateBillingReport: (
    type: string,
    params?: { projectId?: string; projectCode?: string; from?: string; to?: string },
  ) => api.get(`/om/billing/reports/${type}`, { params }),
  getAccountingCatalog: () => api.get('/om/billing/accounting/catalog'),
  getAccountingSummary: () => api.get('/om/billing/accounting/summary'),
  listChartOfAccounts: () => api.get('/om/billing/accounting/chart-of-accounts'),
  listAccountingPostings: (params?: { sourceType?: string; limit?: number }) =>
    api.get('/om/billing/accounting/postings', { params }),
  listJournalEntries: (params?: { from?: string; to?: string; limit?: number }) =>
    api.get('/om/billing/accounting/journal-entries', { params }),
  createAccountingAdjustment: (data: object) => api.post('/om/billing/accounting/adjustments', data),
  generateAccountingReport: (
    type: string,
    params?: { from?: string; to?: string; projectId?: string },
  ) => api.get(`/om/billing/accounting/reports/${type}`, { params }),
  getMobileBillingCatalog: () => api.get('/om/billing/mobile/catalog'),
  getMobileBillingSummary: (params?: { projectId?: string; projectCode?: string }) =>
    api.get('/om/billing/mobile/summary', { params }),
  uploadMobileMeterPhoto: (formData: FormData) =>
    api.post('/om/billing/mobile/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  recordMobileMeterReading: (consumerId: string, data: object) =>
    api.post(`/om/billing/mobile/consumers/${consumerId}/meter-readings`, data),
  recordMobilePayment: (data: object) => api.post('/om/billing/mobile/payments', data),
  getMobilePaymentGatewayConfig: () => api.get('/om/billing/mobile/payment-gateway/config'),
  createMobilePaymentGatewayOrder: (data: object) => api.post('/om/billing/mobile/payment-gateway/orders', data),
  verifyMobilePaymentGateway: (data: object) => api.post('/om/billing/mobile/payment-gateway/verify', data),
  syncMobileBillingBatch: (data: object) => api.post('/om/billing/mobile/sync', data),
  jalMitraAnalytics: () => api.get('/om/jal-mitra/analytics'),
  scanDueBillReminders: () => api.post('/om/notifications/scan-due-bills'),
};

export const dprPlanningApi = {
  getCatalog: () => api.get('/dpr-planning/catalog'),
  dashboard: () => api.get('/dpr-planning/dashboard'),
  listProposals: (params?: { divisionId?: string; status?: string }) =>
    api.get('/dpr-planning/proposals', { params }),
  getProposal: (id: string) => api.get(`/dpr-planning/proposals/${id}`),
  listEvents: (id: string) => api.get(`/dpr-planning/proposals/${id}/events`),
  listDocuments: (id: string) => api.get(`/dpr-planning/proposals/${id}/documents`),
  createProposal: (data: object) => api.post('/dpr-planning/proposals', data),
  updateProposal: (id: string, data: object) => api.patch(`/dpr-planning/proposals/${id}`, data),
  submitToHq: (id: string, data?: object) => api.post(`/dpr-planning/proposals/${id}/submit`, data ?? {}),
  reviewByHq: (id: string, data: object) => api.post(`/dpr-planning/proposals/${id}/hq-review`, data),
  forwardToTac: (id: string, data?: object) => api.post(`/dpr-planning/proposals/${id}/forward-to-tac`, data ?? {}),
  forwardToSecretariat: (id: string, data: object) => api.post(`/dpr-planning/proposals/${id}/forward-to-secretariat`, data),
  beginTacRound2Examination: (id: string, data?: object) =>
    api.post(`/dpr-planning/proposals/${id}/begin-tac-round2`, data ?? {}),
  reviewByTacRound2: (id: string, data: object) => api.post(`/dpr-planning/proposals/${id}/tac-round2-review`, data),
  beginRound2Compliance: (id: string) => api.post(`/dpr-planning/proposals/${id}/begin-round2-compliance`),
  submitRound2Compliance: (id: string, data: object) =>
    api.post(`/dpr-planning/proposals/${id}/submit-round2-compliance`, data),
  recordAdministrativeSanction: (id: string, data: object) =>
    api.post(`/dpr-planning/proposals/${id}/record-sanction`, data),
  initiateTenderPreparation: (id: string, data: object) =>
    api.post(`/dpr-planning/proposals/${id}/initiate-tender-prep`, data),
  downloadTenderTaskOrder: async (id: string) => {
    const { data } = await api.get(`/dpr-planning/proposals/${id}/tender-task-order`, { responseType: 'blob' });
    return data as Blob;
  },
  beginTenderProcessing: (id: string, data?: object) =>
    api.post(`/dpr-planning/proposals/${id}/begin-tender-processing`, data ?? {}),
  reviewTenderApproval: (id: string, data: object) =>
    api.post(`/dpr-planning/proposals/${id}/tender-approval-review`, data),
  publishTenderProposal: (id: string, data?: object) =>
    api.post(`/dpr-planning/proposals/${id}/publish-tender`, data ?? {}),
  downloadTacRound2Report: async (id: string) => {
    const { data } = await api.get(`/dpr-planning/proposals/${id}/tac-round2-report`, { responseType: 'blob' });
    return data as Blob;
  },
  reviewByTac: (id: string, data: object) => api.post(`/dpr-planning/proposals/${id}/tac-review`, data),
  downloadTacComplianceReport: async (id: string) => {
    const { data } = await api.get(`/dpr-planning/proposals/${id}/tac-compliance-report`, { responseType: 'blob' });
    return data as Blob;
  },
  beginDprPreparation: (id: string) => api.post(`/dpr-planning/proposals/${id}/begin-preparation`),
  beginDprRevision: (id: string) => api.post(`/dpr-planning/proposals/${id}/begin-revision`),
  resubmitRevisedDprToTac: (id: string, data?: object) =>
    api.post(`/dpr-planning/proposals/${id}/resubmit-revised-dpr`, data ?? {}),
  submitDprToHq: (id: string, data?: object) => api.post(`/dpr-planning/proposals/${id}/submit-dpr`, data ?? {}),
  setTacValidationMode: (id: string, validationMode: 'excel_auto' | 'pdf_only') =>
    api.post(`/dpr-planning/proposals/${id}/tac-package/validation-mode`, { validationMode }),
  getPdfValidation: (id: string) => api.get(`/dpr-planning/proposals/${id}/pdf-validation`),
  saveStage3HqRemarks: (id: string, data: { remarks: string }) => api.post(`/dpr-planning/proposals/${id}/stage3-hq-remarks`, data),
  uploadCompleteDprPdf: (id: string, file: File, remarks?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (remarks) form.append('remarks', remarks);
    return api.post(`/dpr-planning/proposals/${id}/tac-package/dpr-pdf`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadTacBoqExcel: (id: string, file: File, remarks?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (remarks) form.append('remarks', remarks);
    return api.post(`/dpr-planning/proposals/${id}/tac-package/boq-excel`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
  },
  getBoqValidation: (id: string) => api.get(`/dpr-planning/proposals/${id}/boq-validation`),
  listBoqValidationHistory: (id: string) => api.get(`/dpr-planning/proposals/${id}/boq-validation/history`),
  downloadBoqValidationExport: async (id: string) => {
    const { data } = await api.get(`/dpr-planning/proposals/${id}/boq-validation/export`, { responseType: 'blob' });
    return data as Blob;
  },
  listDocumentVersions: (id: string, documentType: string) =>
    api.get(`/dpr-planning/proposals/${id}/documents/${documentType}/versions`),
  uploadDocument: (id: string, data: object) => api.post(`/dpr-planning/proposals/${id}/documents`, data),
  uploadDocumentFile: (id: string, documentType: string, file: File, remarks?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    if (remarks) formData.append('remarks', remarks);
    return api.post(`/dpr-planning/proposals/${id}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  fetchDocumentFile: async (proposalId: string, documentId: string) => {
    const { data } = await api.get(`/dpr-planning/proposals/${proposalId}/documents/${documentId}/file`, {
      responseType: 'blob',
    });
    return data as Blob;
  },
  advanceProposal: (id: string, data: object) => api.patch(`/dpr-planning/proposals/${id}/advance`, data),
};

export const landAcquisitionApi = {
  getCatalog: () => api.get('/land-acquisition/catalog'),
  dashboard: () => api.get('/land-acquisition/dashboard'),
  gisDashboard: () => api.get('/land-acquisition/gis-dashboard'),
  aiAlerts: () => api.get('/land-acquisition/ai-alerts'),
  caseGisDashboard: (id: string) => api.get(`/land-acquisition/cases/${id}/gis-dashboard`),
  caseAiAlerts: (id: string) => api.get(`/land-acquisition/cases/${id}/ai-alerts`),
  listCases: (params?: { status?: string }) => api.get('/land-acquisition/cases', { params }),
  getCase: (id: string) => api.get(`/land-acquisition/cases/${id}`),
  getMapGeoJson: (id: string) => api.get(`/land-acquisition/cases/${id}/map-geojson`),
  getProposalReadiness: (proposalId: string) => api.get(`/land-acquisition/proposals/${proposalId}/readiness`),
  createCase: (data: object) => api.post('/land-acquisition/cases', data),
  linkProject: (id: string, data: { projectId: string }) =>
    api.patch(`/land-acquisition/cases/${id}/link-project`, data),
  traceAlignment: (id: string, data?: object) => api.post(`/land-acquisition/cases/${id}/trace-alignment`, data ?? {}),
  previewAutoRoute: (id: string, data: object) => api.post(`/land-acquisition/cases/${id}/preview-auto-route`, data),
  recommendRoutes: (id: string, data: object) => api.post(`/land-acquisition/cases/${id}/recommend-routes`, data),
  autoRoute: (id: string, data: object) => api.post(`/land-acquisition/cases/${id}/auto-route`, data),
  identifyParcels: (id: string, data?: object) => api.post(`/land-acquisition/cases/${id}/identify-parcels`, data ?? {}),
  detectClearances: (id: string) => api.post(`/land-acquisition/cases/${id}/detect-clearances`),
  estimateCompensation: (id: string) => api.post(`/land-acquisition/cases/${id}/estimate-compensation`),
  generateDocuments: (id: string) => api.post(`/land-acquisition/cases/${id}/generate-documents`),
  getDocument: (caseId: string, code: string) => api.get(`/land-acquisition/cases/${caseId}/documents/${code}`),
  advanceCase: (id: string, data?: object) => api.post(`/land-acquisition/cases/${id}/advance`, data ?? {}),
  updateParcel: (parcelId: string, data: object) => api.patch(`/land-acquisition/parcels/${parcelId}`, data),
  updateClearance: (clearanceId: string, data: object) => api.patch(`/land-acquisition/clearances/${clearanceId}`, data),
};

export default api;
