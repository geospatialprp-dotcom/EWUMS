/**

 * Minimal dev API server — no database required.

 * Use when full NestJS backend cannot start yet.

 *

 * Run: npm run dev:mock

 * Login: admin@egip.local / Admin@123  (HQ — all divisions)

 *        je@egip.local / Je@123         (Haridwar division only)

 */



const http = require('http');

const fs = require('fs');

const path = require('path');

const mockStore = require('./dev-mock-store');

const {

  buildDivisionAccess,

  buildMapAccess,

  parseRequestUrl,

  resolveUserFromAuthHeader,

} = require('./dev-mock-divisions');



const PORT = 3000;

const API_PREFIX = '/api/v1';



const HQ_DIVISION_ID = 'd1000000-0000-0000-0000-000000000001';

const HRW_DIVISION_ID = 'd1000000-0000-0000-0000-000000000002';

const NTL_DIVISION_ID = 'd1000000-0000-0000-0000-000000000003';



const HQ_PERMISSIONS = [

  'user:read', 'user:create', 'user:update', 'user:delete',

  'asset:read', 'asset:create', 'asset:update', 'asset:delete',

  'layer:read', 'layer:create', 'layer:update', 'layer:delete',

  'project:read', 'project:create', 'project:update', 'project:delete',

  'report:read', 'audit:read', 'division:view_all',

  'construction:read', 'construction:create', 'construction:submit', 'construction:approve', 'construction:measure', 'construction:accounts',

];



const DEMO_USERS = {

  'admin@egip.local': {

    password: 'Admin@123',

    user: {

      id: 'c0000000-0000-0000-0000-000000000001',

      email: 'admin@egip.local',

      firstName: 'System',

      lastName: 'Administrator',

      tenantId: 'a0000000-0000-0000-0000-000000000001',

      roles: ['super_admin'],

      permissions: HQ_PERMISSIONS,

      accessScope: 'global',

      canViewAllDivisions: true,

      divisionId: HQ_DIVISION_ID,

      divisionCode: 'HQ-UJS',

      divisionName: 'UJS State HQ (Dehradun)',

    },

  },

  'ee@egip.local': {

    password: 'Ee@123',

    user: {

      id: 'c0000000-0000-0000-0000-000000000008',

      email: 'ee@egip.local',

      firstName: 'Executive',

      lastName: 'Engineer',

      tenantId: 'a0000000-0000-0000-0000-000000000001',

      roles: ['ee'],

      permissions: ['project:read', 'project:create', 'project:update', 'layer:read', 'division:view_all'],

      accessScope: 'state',

      canViewAllDivisions: true,

      divisionId: HQ_DIVISION_ID,

      divisionCode: 'HQ-UJS',

      divisionName: 'UJS State HQ (Dehradun)',

    },

  },

  'gis@egip.local': {

    password: 'Gis@123',

    user: {

      id: 'c0000000-0000-0000-0000-000000000002',

      email: 'gis@egip.local',

      firstName: 'GIS',

      lastName: 'Administrator',

      tenantId: 'a0000000-0000-0000-0000-000000000001',

      roles: ['gis_admin'],

      permissions: ['layer:read', 'layer:create', 'layer:update', 'layer:delete', 'project:read', 'project:update', 'project:create', 'asset:read', 'report:read', 'division:view_all'],

      accessScope: 'state',

      canViewAllDivisions: true,

      divisionId: HQ_DIVISION_ID,

      divisionCode: 'HQ-UJS',

      divisionName: 'UJS State HQ (Dehradun)',

    },

  },

  'je@egip.local': {

    password: 'Je@123',

    user: {

      id: 'c0000000-0000-0000-0000-000000000003',

      email: 'je@egip.local',

      firstName: 'Junior',

      lastName: 'Engineer',

      tenantId: 'a0000000-0000-0000-0000-000000000001',

      roles: ['je'],

      permissions: ['project:read', 'project:update', 'layer:read', 'construction:read', 'construction:create', 'construction:submit'],

      accessScope: 'division',

      canViewAllDivisions: false,

      divisionId: HRW_DIVISION_ID,

      divisionCode: 'DIV-HRW',

      divisionName: 'Haridwar Division',

    },

  },

  'ae@egip.local': {

    password: 'Ae@123',

    user: {

      id: 'c0000000-0000-0000-0000-000000000004',

      email: 'ae@egip.local',

      firstName: 'Assistant',

      lastName: 'Engineer',

      tenantId: 'a0000000-0000-0000-0000-000000000001',

      roles: ['ae'],

      permissions: ['project:read', 'layer:read', 'construction:read'],

      accessScope: 'division',

      canViewAllDivisions: false,

      divisionId: HRW_DIVISION_ID,

      divisionCode: 'DIV-HRW',

      divisionName: 'Haridwar Division',

    },

  },

  'accounts@egip.local': {

    password: 'Accounts@123',

    user: {

      id: 'c0000000-0000-0000-0000-000000000005',

      email: 'accounts@egip.local',

      firstName: 'Division',

      lastName: 'Accounts',

      tenantId: 'a0000000-0000-0000-0000-000000000001',

      roles: ['accounts'],

      permissions: ['project:read', 'construction:accounts', 'construction:read'],

      accessScope: 'division',

      canViewAllDivisions: false,

      divisionId: NTL_DIVISION_ID,

      divisionCode: 'DIV-NTL',

      divisionName: 'Nainital Division',

    },

  },

};



const MOCK_BASEMAP_GROUP_ID = 'e0000000-0000-0000-0000-000000000002';

const MOCK_OSM_LAYER_ID = 'b0000000-0000-0000-0000-000000000001';

const MOCK_GOOGLE_LAYER_ID = 'b0000000-0000-0000-0000-000000000002';

const MOCK_NONE_LAYER_ID = 'b0000000-0000-0000-0000-000000000003';



const MOCK_LAYER_CATALOG = [

  {

    id: MOCK_BASEMAP_GROUP_ID,

    name: 'Basemaps',

    isExpanded: true,

    layers: [

      {

        id: MOCK_OSM_LAYER_ID,

        name: 'OpenStreetMap',

        sourceType: 'xyz',

        sourceConfig: {

          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',

          attribution: '© OpenStreetMap contributors',

        },

        defaultStyle: {},

        minZoom: null,

        maxZoom: null,

      },

      {

        id: MOCK_GOOGLE_LAYER_ID,

        name: 'Google Imagery',

        sourceType: 'google',

        sourceConfig: {

          mapType: 'satellite',

          attribution: 'Imagery © Google',

          maxZoom: 22,

        },

        defaultStyle: {},

        minZoom: null,

        maxZoom: null,

      },

      {

        id: MOCK_NONE_LAYER_ID,

        name: 'None',

        sourceType: 'none',

        sourceConfig: {},

        defaultStyle: {},

        minZoom: null,

        maxZoom: null,

      },

    ],

  },

];



const DISTRICT_NAME_TO_CODE = {

  Almora: 'ALM',

  Bageshwar: 'BGW',

  Chamoli: 'CHM',

  Champawat: 'CHP',

  Dehradun: 'DDN',

  Haridwar: 'HRW',

  Nainital: 'NTL',

  'Pauri Garhwal': 'PGR',

  Pithoragarh: 'PTG',

  Rudraprayag: 'RDP',

  'Tehri Garhwal': 'TGR',

  'Udham Singh Nagar': 'USN',

  Uttarkashi: 'UTK',

};



function loadUttarakhandDistrictBoundaries() {

  const geoPath = path.join(__dirname, '..', '..', 'database', 'gis', 'uttarakhand-districts-source.geojson');

  if (!fs.existsSync(geoPath)) {

    console.warn('[dev-server] Uttarakhand GeoJSON not found:', geoPath);

    return { type: 'FeatureCollection', features: [] };

  }

  try {

    const raw = JSON.parse(fs.readFileSync(geoPath, 'utf8'));

    const features = (raw.features ?? []).map((feature) => {

      const districtName = feature.properties?.district ?? 'District';

      const districtCode = DISTRICT_NAME_TO_CODE[districtName]

        ?? feature.properties?.dt_code

        ?? districtName.slice(0, 3).toUpperCase();

      return {

        type: 'Feature',

        id: districtCode,

        geometry: feature.geometry,

        properties: { districtCode, districtName },

      };

    });

    console.log(`[dev-server] Loaded ${features.length} Uttarakhand district boundaries`);

    return { type: 'FeatureCollection', features };

  } catch (err) {

    console.warn('[dev-server] Failed to load Uttarakhand boundaries:', err.message);

    return { type: 'FeatureCollection', features: [] };

  }

}



const UTTARAKHAND_DISTRICT_BOUNDARIES = loadUttarakhandDistrictBoundaries();



const MOCK_EXECUTIVE_DASHBOARD = {

  kpis: [

    { id: 'total_assets', label: 'Total Assets', value: 0, trend: '—', status: 'up' },

    { id: 'active_alerts', label: 'Active Alerts', value: 0, trend: '—', status: 'down' },

    { id: 'critical_assets', label: 'Critical Assets', value: 0, trend: null, status: 'warning' },

    { id: 'project_completion', label: 'Avg Project Progress', value: '0%', trend: '—', status: 'up' },

    { id: 'avg_health', label: 'Avg Asset Health', value: '—', trend: null, status: 'down' },

  ],

  criticalAssets: [],

  recentAlerts: [],

  charts: {

    assetByStatus: [

      { status: 'active', count: 0 },

      { status: 'maintenance', count: 0 },

    ],

    projectProgress: [],

  },

};



function corsOrigin(req) {

  const origin = req.headers.origin;

  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {

    return origin;

  }

  return 'http://localhost:5173';

}



function makeToken(user) {

  const payload = Buffer.from(JSON.stringify({

    sub: user.id,

    email: user.email,

    tenantId: user.tenantId,

    roles: user.roles,

    permissions: user.permissions,

    dev: true,

  })).toString('base64url');

  return `dev.${payload}.egip`;

}



function sendJson(req, res, status, data) {

  res.writeHead(status, {

    'Content-Type': 'application/json',

    'Access-Control-Allow-Origin': corsOrigin(req),

    'Access-Control-Allow-Credentials': 'true',

    'Vary': 'Origin',

  });

  res.end(JSON.stringify(data));

}



function readBody(req) {

  return new Promise((resolve) => {

    let body = '';

    req.on('data', (chunk) => { body += chunk; });

    req.on('end', () => {

      try { resolve(JSON.parse(body || '{}')); }

      catch { resolve({}); }

    });

  });

}



function resolveRequestUser(req) {

  return resolveUserFromAuthHeader(

    req.headers.authorization,

    DEMO_USERS,

    DEMO_USERS['admin@egip.local'].user,

  );

}



const server = http.createServer(async (req, res) => {

  if (req.method === 'OPTIONS') {

    res.writeHead(204, {

      'Access-Control-Allow-Origin': corsOrigin(req),

      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',

      'Access-Control-Allow-Headers': 'Content-Type, Authorization',

      'Access-Control-Allow-Credentials': 'true',

      'Vary': 'Origin',

    });

    res.end();

    return;

  }



  const { pathname: url, params } = parseRequestUrl(req.url || '');

  const user = resolveRequestUser(req);

  const allDivisions = mockStore.getAllDivisions();

  const allProjects = mockStore.getAllProjects();



  if (req.method === 'GET' && url === `${API_PREFIX}/health`) {

    sendJson(req, res, 200, {

      status: 'ok',

      mode: 'dev-mock',

      version: 5,

      divisions: allDivisions.length,

      districts: UTTARAKHAND_DISTRICT_BOUNDARIES.features.length,

      ...mockStore.getStoreStats(),

    });

    return;

  }



  if (req.method === 'GET' && url === `${API_PREFIX}/auth/platform-stats`) {

    sendJson(req, res, 200, {

      tenants: 1,

      users: Object.keys(DEMO_USERS).length,

      assets: 0,

      layers: 0,

      mode: 'dev-mock',

    });

    return;

  }



  if (req.method === 'POST' && url === `${API_PREFIX}/auth/login`) {

    const body = await readBody(req);

    const email = String(body.email || '').trim().toLowerCase();

    const account = DEMO_USERS[email];

    if (!account || account.password !== body.password) {

      sendJson(req, res, 401, { statusCode: 401, message: 'Invalid credentials' });

      return;

    }

    sendJson(req, res, 200, {

      accessToken: makeToken(account.user),

      user: account.user,

    });

    return;

  }



  if (req.method === 'GET' && url === `${API_PREFIX}/auth/profile`) {

    sendJson(req, res, 200, user);

    return;

  }



  if (req.method === 'GET' && url === `${API_PREFIX}/gis/layers`) {

    sendJson(req, res, 200, MOCK_LAYER_CATALOG);

    return;

  }



  if (req.method === 'GET' && url === `${API_PREFIX}/gis/map-access`) {

    const focusDivisionId = params.get('divisionId') || params.get('division') || undefined;

    sendJson(req, res, 200, buildMapAccess(

      user,

      allDivisions,

      allProjects,

      UTTARAKHAND_DISTRICT_BOUNDARIES,

      focusDivisionId,

    ));

    return;

  }



  if (mockStore.handleProjectsRoute(req, res, url, req.method, sendJson, readBody, user)) {

    return;

  }



  if (req.method === 'GET' && url === `${API_PREFIX}/divisions/access`) {

    sendJson(req, res, 200, buildDivisionAccess(user, allDivisions));

    return;

  }



  if (req.method === 'GET' && url === `${API_PREFIX}/divisions`) {

    sendJson(req, res, 200, mockStore.listDivisions(user));

    return;

  }



  if (req.method === 'GET' && url === `${API_PREFIX}/dashboard/executive`) {

    sendJson(req, res, 200, MOCK_EXECUTIVE_DASHBOARD);

    return;

  }



  if (req.method === 'GET' && /^\/api\/v1\/gis\/layers\/[^/]+\/features$/.test(url)) {

    sendJson(req, res, 200, {

      type: 'FeatureCollection',

      features: [],

      jurisdiction: { allowed: true, message: null },

    });

    return;

  }



  if (req.method === 'PATCH' && url.startsWith(`${API_PREFIX}/`)) {

    sendJson(req, res, 501, { statusCode: 501, message: 'Not implemented in dev mock for this route' });

    return;

  }



  if (req.method === 'POST' && url.startsWith(`${API_PREFIX}/`)) {

    sendJson(req, res, 501, { statusCode: 501, message: 'Not implemented in dev mock for this route' });

    return;

  }



  if (req.method === 'DELETE' && url.startsWith(`${API_PREFIX}/`)) {

    sendJson(req, res, 501, { statusCode: 501, message: 'Not implemented in dev mock for this route' });

    return;

  }



  if (req.method === 'GET' && url.startsWith(`${API_PREFIX}/`)) {

    sendJson(req, res, 200, []);

    return;

  }



  sendJson(req, res, 404, { statusCode: 404, message: 'Not found' });

});



server.listen(PORT, '0.0.0.0', () => {

  console.log(`EGIP DEV API (mock) on http://localhost:${PORT}`);

  console.log('HQ login: admin@egip.local / Admin@123');

  console.log('Field login: je@egip.local / Je@123 (Haridwar division only)');

  console.log('Stop NestJS on port 3000 if you see database errors — use this mock server instead.');

});

