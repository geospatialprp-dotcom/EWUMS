/**

 * In-memory dev store for projects + divisions (persisted to .dev-mock-store.json).

 */

const fs = require('fs');

const path = require('path');

const crypto = require('crypto');

const {

  listDivisionsForUser,

  listProjectsForUser,

} = require('./dev-mock-divisions');



const STORE_PATH = path.join(__dirname, '.dev-mock-store.json');

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

const API_PREFIX = '/api/v1';

const STORE_SCHEMA_VERSION = 3;



/** Matches database/migrations/046_ujs_divisions_access.sql */

const DEFAULT_DIVISIONS = [

  { id: 'd1000000-0000-0000-0000-000000000001', code: 'HQ-UJS', name: 'UJS State HQ (Dehradun)', region: 'Uttarakhand', isHeadquarters: true, status: 'active' },

  { id: 'd1000000-0000-0000-0000-000000000002', code: 'DIV-HRW', name: 'Haridwar Division', region: 'Haridwar', isHeadquarters: false, status: 'active' },

  { id: 'd1000000-0000-0000-0000-000000000003', code: 'DIV-NTL', name: 'Nainital Division', region: 'Kumaon', isHeadquarters: false, status: 'active' },

  { id: 'd1000000-0000-0000-0000-000000000004', code: 'DIV-ALM', name: 'Almora Division', region: 'Kumaon', isHeadquarters: false, status: 'active' },

  { id: 'd1000000-0000-0000-0000-000000000005', code: 'DIV-TNH', name: 'Tehri Garhwal Division', region: 'Garhwal', isHeadquarters: false, status: 'active' },

];



const DEFAULT_PROJECTS = [

  {

    id: 'f0000000-0000-0000-0000-000000000001',

    tenantId: TENANT_ID,

    projectCode: 'PRJ-ZAPR-2025-26',

    name: 'Zone A Pipeline Rehabilitation',

    description: 'Haridwar division water supply scheme (dev mock)',

    status: 'active',

    divisionId: 'd1000000-0000-0000-0000-000000000002',

    startDate: '2025-01-01',

    endDate: '2025-12-31',

    budget: 2500000,

    spent: 1625000,

    physicalProgress: 65,

    financialProgress: 58,

    orthomosaicConfig: null,

    milestones: [

      { id: 'm0000000-0000-0000-0000-000000000001', name: 'Survey & Design', dueDate: '2025-03-31', completedDate: null, status: 'completed', progress: 100, sortOrder: 1, dprLinked: false },

      { id: 'm0000000-0000-0000-0000-000000000002', name: 'Procurement', dueDate: '2025-06-30', completedDate: null, status: 'completed', progress: 100, sortOrder: 2, dprLinked: false },

      { id: 'm0000000-0000-0000-0000-000000000003', name: 'Pipeline Laying', dueDate: '2025-10-31', completedDate: null, status: 'in_progress', progress: 70, sortOrder: 3, dprLinked: false },

      { id: 'm0000000-0000-0000-0000-000000000004', name: 'Testing & Commissioning', dueDate: '2025-12-15', completedDate: null, status: 'pending', progress: 0, sortOrder: 4, dprLinked: false },

    ],

  },

  {

    id: 'f0000000-0000-0000-0000-000000000002',

    tenantId: TENANT_ID,

    projectCode: 'PRJ-NTL-2025-26',

    name: 'Nainital Lake Catchment Water Supply',

    description: 'Nainital division scheme (dev mock)',

    status: 'active',

    divisionId: 'd1000000-0000-0000-0000-000000000003',

    startDate: '2025-02-01',

    endDate: '2026-01-31',

    budget: 1800000,

    spent: 720000,

    physicalProgress: 42,

    financialProgress: 40,

    orthomosaicConfig: null,

    milestones: [],

  },

  {

    id: 'f0000000-0000-0000-0000-000000000003',

    tenantId: TENANT_ID,

    projectCode: 'PRJ-ALM-2025-26',

    name: 'Almora Hill Town Distribution Network',

    description: 'Almora division scheme (dev mock)',

    status: 'active',

    divisionId: 'd1000000-0000-0000-0000-000000000004',

    startDate: '2025-03-01',

    endDate: '2026-02-28',

    budget: 1200000,

    spent: 360000,

    physicalProgress: 30,

    financialProgress: 28,

    orthomosaicConfig: null,

    milestones: [],

  },

  {

    id: 'f0000000-0000-0000-0000-000000000004',

    tenantId: TENANT_ID,

    projectCode: 'PRJ-TGR-2025-26',

    name: 'Tehri Garhwal Gravity Main Extension',

    description: 'Tehri Garhwal division scheme (dev mock)',

    status: 'active',

    divisionId: 'd1000000-0000-0000-0000-000000000005',

    startDate: '2025-04-01',

    endDate: '2026-03-31',

    budget: 950000,

    spent: 190000,

    physicalProgress: 20,

    financialProgress: 18,

    orthomosaicConfig: null,

    milestones: [],

  },

];



function defaultStore() {

  return {

    schemaVersion: STORE_SCHEMA_VERSION,

    projects: [...DEFAULT_PROJECTS],

    divisions: [...DEFAULT_DIVISIONS],

  };

}



function normalizeStoredProjects(projects) {

  const divisionIds = DEFAULT_DIVISIONS.filter((d) => !d.isHeadquarters).map((d) => d.id);

  return projects.map((project, index) => {

    if (project.divisionId && DEFAULT_DIVISIONS.some((d) => d.id === project.divisionId)) {

      return project;

    }

    return {

      ...project,

      divisionId: divisionIds[index % divisionIds.length] ?? divisionIds[0] ?? null,

    };

  });

}



function needsStoreReset(parsed) {

  if (!parsed || parsed.schemaVersion !== STORE_SCHEMA_VERSION) return true;

  const codes = new Set((parsed.divisions ?? []).map((d) => d.code));

  if (!codes.has('DIV-HRW') || !codes.has('HQ-UJS')) return true;

  return (parsed.projects ?? []).some((p) => !p.divisionId);

}



function loadStore() {

  if (fs.existsSync(STORE_PATH)) {

    try {

      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));

      if (needsStoreReset(parsed)) {

        console.log('[dev-mock-store] Resetting store to UJS division schema v2');

        const fresh = defaultStore();

        fs.writeFileSync(STORE_PATH, JSON.stringify(fresh, null, 2), 'utf8');

        return fresh;

      }

      return {

        schemaVersion: STORE_SCHEMA_VERSION,

        projects: normalizeStoredProjects(Array.isArray(parsed.projects) ? parsed.projects : [...DEFAULT_PROJECTS]),

        divisions: Array.isArray(parsed.divisions) ? parsed.divisions : [...DEFAULT_DIVISIONS],

      };

    } catch {

      // fall through

    }

  }

  return defaultStore();

}



let store = loadStore();



function persistStore() {

  try {

    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');

  } catch (err) {

    console.warn('[dev-mock-store] Could not persist:', err.message);

  }

}



function uuid() {

  return crypto.randomUUID();

}



function buildProjectCode(name) {

  const initials = String(name || 'PRJ')

    .split(/\s+/)

    .filter(Boolean)

    .map((w) => w[0]?.toUpperCase() ?? '')

    .join('')

    .slice(0, 10) || 'PRJ';

  const now = new Date();

  const year = now.getFullYear();

  const fyEnd = ((now.getMonth() >= 3 ? year + 1 : year) % 100).toString().padStart(2, '0');

  const fyStart = ((now.getMonth() >= 3 ? year : year - 1) % 100).toString().padStart(2, '0');

  return `PRJ-${initials}-${fyStart}-${fyEnd}`;

}



function listProjects(user) {

  const projects = user

    ? listProjectsForUser(user, store.projects, store.divisions)

    : store.projects;

  return projects.map((p) => ({ ...p, milestones: [...(p.milestones ?? [])] }));

}



function getProject(id, user) {

  const project = listProjects(user).find((p) => p.id === id);

  if (!project) return null;

  return { ...project, milestones: [...(project.milestones ?? [])] };

}



function portfolioReadiness(user) {

  const projectCount = listProjects(user).length;

  return {

    phase: 'ready',

    constructionUnlocked: true,

    canCreateProject: true,

    publishedTenderCount: 0,

    pipelineProposalCount: 0,

    projectCount,

    readySchemes: [],

  };

}



function createProject(body, user) {

  const project = {

    id: uuid(),

    tenantId: TENANT_ID,

    projectCode: body.projectCode?.trim() || buildProjectCode(body.name),

    name: String(body.name || 'Untitled Scheme').trim(),

    description: body.description?.trim() || null,

    status: body.status?.trim() || 'active',

    divisionId: body.divisionId || user?.divisionId || null,

    startDate: body.startDate || null,

    endDate: body.endDate || null,

    budget: body.budget ?? null,

    spent: body.spent ?? 0,

    physicalProgress: 0,

    financialProgress: 0,

    orthomosaicConfig: body.orthomosaicConfig ?? null,

    milestones: [],

  };

  store.projects.unshift(project);

  persistStore();

  return { ...project, divisionStaffLogins: [] };

}



function updateProject(id, body, user) {

  const existing = getProject(id, user);

  if (!existing) return null;

  const index = store.projects.findIndex((p) => p.id === id);

  const current = store.projects[index];

  const updated = {

    ...current,

    ...body,

    id: current.id,

    tenantId: current.tenantId,

    milestones: current.milestones,

  };

  store.projects[index] = updated;

  persistStore();

  return { ...updated, milestones: [...updated.milestones] };

}



function deleteProject(id, user) {

  if (!getProject(id, user)) return false;

  const before = store.projects.length;

  store.projects = store.projects.filter((p) => p.id !== id);

  if (store.projects.length !== before) persistStore();

  return store.projects.length !== before;

}



function createMilestone(projectId, body, user) {

  const project = getProject(projectId, user);

  if (!project) return null;

  const storeProject = store.projects.find((p) => p.id === projectId);

  const milestone = {

    id: uuid(),

    name: String(body.name || 'Milestone').trim(),

    dueDate: body.dueDate || null,

    completedDate: body.completedDate || null,

    status: body.status || 'pending',

    progress: Number(body.progress) || 0,

    sortOrder: storeProject.milestones.length + 1,

    dprLinked: false,

  };

  storeProject.milestones.push(milestone);

  persistStore();

  return milestone;

}



function updateMilestone(projectId, milestoneId, body, user) {

  if (!getProject(projectId, user)) return null;

  const project = store.projects.find((p) => p.id === projectId);

  const index = project.milestones.findIndex((m) => m.id === milestoneId);

  if (index < 0) return null;

  project.milestones[index] = { ...project.milestones[index], ...body, id: milestoneId };

  persistStore();

  return { ...project.milestones[index] };

}



function deleteMilestone(projectId, milestoneId, user) {

  if (!getProject(projectId, user)) return false;

  const project = store.projects.find((p) => p.id === projectId);

  const before = project.milestones.length;

  project.milestones = project.milestones.filter((m) => m.id !== milestoneId);

  if (project.milestones.length !== before) persistStore();

  return project.milestones.length !== before;

}



function listDivisions(user) {

  return user

    ? listDivisionsForUser(user, store.divisions)

    : [...store.divisions];

}



function handleProjectsRoute(req, res, url, method, sendJson, readBody, user) {

  if (url === `${API_PREFIX}/projects` && method === 'GET') {

    sendJson(req, res, 200, listProjects(user));

    return true;

  }

  if (url === `${API_PREFIX}/projects/portfolio-readiness` && method === 'GET') {

    sendJson(req, res, 200, portfolioReadiness(user));

    return true;

  }

  if (url === `${API_PREFIX}/projects` && method === 'POST') {

    readBody(req).then((body) => {

      sendJson(req, res, 201, createProject(body, user));

    });

    return true;

  }



  const projectMatch = url.match(/^\/api\/v1\/projects\/([^/]+)$/);

  if (projectMatch) {

    const projectId = projectMatch[1];

    if (method === 'GET') {

      const project = getProject(projectId, user);

      if (!project) {

        sendJson(req, res, 404, { statusCode: 404, message: 'Project not found' });

        return true;

      }

      sendJson(req, res, 200, project);

      return true;

    }

    if (method === 'PATCH') {

      readBody(req).then((body) => {

        const updated = updateProject(projectId, body, user);

        if (!updated) {

          sendJson(req, res, 404, { statusCode: 404, message: 'Project not found' });

          return;

        }

        sendJson(req, res, 200, updated);

      });

      return true;

    }

    if (method === 'DELETE') {

      if (!deleteProject(projectId, user)) {

        sendJson(req, res, 404, { statusCode: 404, message: 'Project not found' });

        return true;

      }

      sendJson(req, res, 200, { deleted: true });

      return true;

    }

  }



  const milestoneCreateMatch = url.match(/^\/api\/v1\/projects\/([^/]+)\/milestones$/);

  if (milestoneCreateMatch && method === 'POST') {

    const projectId = milestoneCreateMatch[1];

    readBody(req).then((body) => {

      const milestone = createMilestone(projectId, body, user);

      if (!milestone) {

        sendJson(req, res, 404, { statusCode: 404, message: 'Project not found' });

        return;

      }

      sendJson(req, res, 201, milestone);

    });

    return true;

  }



  const milestoneMatch = url.match(/^\/api\/v1\/projects\/([^/]+)\/milestones\/([^/]+)$/);

  if (milestoneMatch) {

    const [, projectId, milestoneId] = milestoneMatch;

    if (method === 'PATCH') {

      readBody(req).then((body) => {

        const updated = updateMilestone(projectId, milestoneId, body, user);

        if (!updated) {

          sendJson(req, res, 404, { statusCode: 404, message: 'Milestone not found' });

          return;

        }

        sendJson(req, res, 200, updated);

      });

      return true;

    }

    if (method === 'DELETE') {

      if (!deleteMilestone(projectId, milestoneId, user)) {

        sendJson(req, res, 404, { statusCode: 404, message: 'Milestone not found' });

        return true;

      }

      sendJson(req, res, 200, { deleted: true });

      return true;

    }

  }



  return false;

}



module.exports = {

  TENANT_ID,

  listProjects,

  listDivisions,

  portfolioReadiness,

  handleProjectsRoute,

  getAllDivisions: () => [...store.divisions],

  getAllProjects: () => store.projects.map((p) => ({ ...p })),

  getStoreStats: () => ({ projects: store.projects.length, divisions: store.divisions.length }),

};

