/**
 * Division scoping helpers for dev mock API — mirrors migration 046 UJS divisions.
 */

const UTTARAKHAND_STATE_BBOX = [77.57, 28.43, 81.03, 31.45];
const UTTARAKHAND_STATE_MAP_VIEW = {
  center: [78.8, 30.2],
  zoom: 7.2,
  bbox: UTTARAKHAND_STATE_BBOX,
};

const DIVISION_CODE_DISTRICT = {
  'HQ-UJS': 'Dehradun',
  'DIV-HRW': 'Haridwar',
  'DIV-NTL': 'Nainital',
  'DIV-ALM': 'Almora',
  'DIV-TNH': 'Tehri Garhwal',
};

const UTTARAKHAND_DISTRICT_BBOXES = {
  Almora: [79.04, 29.43, 80.08, 29.98],
  Bageshwar: [79.47, 29.70, 80.16, 30.32],
  Chamoli: [79.08, 29.93, 80.10, 31.08],
  Champawat: [79.79, 28.94, 80.32, 29.52],
  Dehradun: [77.57, 29.96, 78.31, 31.03],
  Haridwar: [77.72, 29.58, 78.34, 30.24],
  Nainital: [78.85, 28.98, 79.97, 29.61],
  'Pauri Garhwal': [78.20, 29.43, 79.23, 30.26],
  Pithoragarh: [79.82, 29.44, 81.05, 30.81],
  Rudraprayag: [78.82, 30.18, 79.35, 30.81],
  'Tehri Garhwal': [77.94, 30.05, 79.04, 30.88],
  'Udham Singh Nagar': [78.72, 28.72, 80.08, 29.36],
  Uttarkashi: [77.81, 30.47, 79.41, 31.46],
};

const DIVISION_CODE_MAP_CENTER = {
  'DIV-ALM': [79.65, 29.60],
  'DIV-HRW': [78.00, 29.95],
  'DIV-NTL': [79.40, 29.38],
  'DIV-TNH': [78.48, 30.38],
  'HQ-UJS': [78.05, 30.32],
};

function districtForDivisionCode(code) {
  return DIVISION_CODE_DISTRICT[code] ?? null;
}

function formatDivisionShortName(name) {
  return String(name || '').replace(/\s+Division\s*$/i, '').trim() || name;
}

function fallbackDistrictBbox(districtNames) {
  const boxes = districtNames
    .map((name) => UTTARAKHAND_DISTRICT_BBOXES[name])
    .filter(Boolean);
  if (!boxes.length) return null;
  const minLon = Math.min(...boxes.map((b) => b[0]));
  const minLat = Math.min(...boxes.map((b) => b[1]));
  const maxLon = Math.max(...boxes.map((b) => b[2]));
  const maxLat = Math.max(...boxes.map((b) => b[3]));
  const pad = 0.01;
  return [minLon - pad, minLat - pad, maxLon + pad, maxLat + pad];
}

function bboxToMapView(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const center = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  const span = Math.max(lonSpan, latSpan);
  let zoom = 7.2;
  if (span < 0.35) zoom = 9.5;
  else if (span < 0.6) zoom = 8.8;
  else if (span < 1.0) zoom = 8.2;
  else if (span < 1.8) zoom = 7.6;
  return { center, zoom };
}

function enrichDivisionsForMap(divisions) {
  return divisions.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    region: d.region ?? null,
    district: districtForDivisionCode(d.code),
    isHeadquarters: Boolean(d.isHeadquarters),
  }));
}

function districtNamesFromDivisions(divisions) {
  const names = new Set();
  divisions.forEach((d) => {
    if (d.isHeadquarters) return;
    const district = districtForDivisionCode(d.code);
    if (district) names.add(district);
  });
  return [...names];
}

function filterDistrictBoundaries(allBoundaries, districtNames) {
  if (!districtNames?.length) return allBoundaries;
  const allowed = new Set(districtNames);
  return {
    type: 'FeatureCollection',
    features: (allBoundaries.features ?? []).filter(
      (f) => allowed.has(f.properties?.districtName),
    ),
  };
}

function userCanViewAllDivisions(user) {
  if (!user) return false;
  if (user.canViewAllDivisions) return true;
  if (user.roles?.includes('super_admin')) return true;
  return user.permissions?.includes('division:view_all') ?? false;
}

function getAccessibleDivisionIds(user, allDivisions) {
  if (userCanViewAllDivisions(user)) return null;
  if (user?.divisionId) {
    const match = allDivisions.find((d) => d.id === user.divisionId);
    return match ? [match.id] : [];
  }
  return [];
}

function listDivisionsForUser(user, allDivisions) {
  const accessible = getAccessibleDivisionIds(user, allDivisions);
  if (accessible === null) return [...allDivisions];
  if (!accessible.length) return [];
  return allDivisions.filter((d) => accessible.includes(d.id));
}

function listProjectsForUser(user, allProjects, allDivisions) {
  const accessible = getAccessibleDivisionIds(user, allDivisions);
  if (accessible === null) return [...allProjects];
  if (!accessible.length) return [];
  return allProjects.filter((p) => p.divisionId && accessible.includes(p.divisionId));
}

function buildDivisionAccess(user, allDivisions) {
  const canViewAll = userCanViewAllDivisions(user);
  const division = user?.divisionId
    ? allDivisions.find((d) => d.id === user.divisionId) ?? null
    : null;
  return {
    divisionSchemaReady: true,
    circleSchemaReady: true,
    divisionId: division?.id ?? user?.divisionId ?? null,
    divisionCode: division?.code ?? user?.divisionCode ?? null,
    divisionName: division?.name ?? user?.divisionName ?? null,
    circleId: null,
    circleCode: null,
    circleName: null,
    accessScope: user?.accessScope ?? (canViewAll ? 'global' : 'division'),
    canViewAllDivisions: canViewAll,
    roles: user?.roles ?? [],
    setupHint: null,
  };
}

function buildMapAccess(user, allDivisions, allProjects, allDistrictBoundaries, focusDivisionId) {
  const canViewAll = userCanViewAllDivisions(user);
  const divisions = listDivisionsForUser(user, allDivisions);
  const divisionIds = divisions.map((d) => d.id);

  let extentDivisionIds = divisionIds;
  const focusId = focusDivisionId?.trim() || '';
  if (focusId && divisionIds.includes(focusId)) {
    extentDivisionIds = [focusId];
  }

  const scopedDivisions = divisions.filter((d) => extentDivisionIds.includes(d.id));
  const divisionFocused = Boolean(focusId && divisionIds.includes(focusId));
  const districtNames = (canViewAll && !divisionFocused)
    ? null
    : districtNamesFromDivisions(scopedDivisions);

  let bbox;
  if (divisionFocused && districtNames?.length) {
    bbox = fallbackDistrictBbox(districtNames) ?? [...UTTARAKHAND_STATE_BBOX];
  } else if (canViewAll || user?.accessScope === 'global' || user?.accessScope === 'state') {
    bbox = [...UTTARAKHAND_STATE_BBOX];
  } else if (districtNames?.length) {
    bbox = fallbackDistrictBbox(districtNames) ?? [...UTTARAKHAND_STATE_BBOX];
  } else {
    bbox = [...UTTARAKHAND_STATE_BBOX];
  }

  const mapView = bboxToMapView(bbox);
  const accessibleProjects = listProjectsForUser(user, allProjects, allDivisions);
  const activeDivisionId = divisionFocused
    ? focusId
    : (user?.divisionId && divisionIds.includes(user.divisionId)
      ? user.divisionId
      : divisionIds[0] ?? null);

  const activeDivision = divisions.find((d) => d.id === activeDivisionId) ?? divisions[0] ?? null;
  const activeDistrictName = districtNames?.length === 1
    ? districtNames[0]
    : (districtNames?.[0] ?? null);

  let jurisdictionLabel;
  if (divisionFocused && activeDivision) {
    jurisdictionLabel = activeDistrictName
      ? `${activeDistrictName} District · ${formatDivisionShortName(activeDivision.name)}`
      : formatDivisionShortName(activeDivision.name);
  } else if (canViewAll) {
    jurisdictionLabel = 'Uttarakhand — Full State Access';
  } else if (activeDistrictName && activeDivision) {
    jurisdictionLabel = `${activeDistrictName} District · ${formatDivisionShortName(activeDivision.name)}`;
  } else if (divisions.length === 1) {
    jurisdictionLabel = activeDistrictName
      ? `${activeDistrictName} District · ${formatDivisionShortName(divisions[0].name)}`
      : formatDivisionShortName(divisions[0].name);
  } else if (divisions.length > 1) {
    jurisdictionLabel = `${divisions.length} Authorized Divisions`;
  } else {
    jurisdictionLabel = 'No jurisdiction assigned';
  }

  const resolvedDistrictNames = districtNames ?? [];
  const jurisdictionRestricted = resolvedDistrictNames.length > 0
    && (!canViewAll || divisionFocused);

  return {
    accessScope: user?.accessScope ?? (canViewAll ? 'global' : 'division'),
    canViewAllDivisions: canViewAll,
    jurisdictionLabel,
    jurisdictionRestricted,
    boundaryNotice: null,
    districtNames: resolvedDistrictNames,
    activeDistrictName,
    districtBoundaries: filterDistrictBoundaries(allDistrictBoundaries, districtNames),
    divisions: enrichDivisionsForMap(divisions),
    activeDivisionId,
    mapView,
    bbox,
    allowedProjectCount: canViewAll ? null : accessibleProjects.length,
  };
}

function parseRequestUrl(rawUrl) {
  const [pathname, query = ''] = (rawUrl || '').split('?');
  const params = new URLSearchParams(query);
  return { pathname, params };
}

function resolveUserFromAuthHeader(authHeader, demoUsers, fallbackUser) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token.startsWith('dev.')) return fallbackUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const account = Object.values(demoUsers).find((entry) => entry.user.id === payload.sub);
    return account?.user ?? fallbackUser;
  } catch {
    return fallbackUser;
  }
}

module.exports = {
  UTTARAKHAND_STATE_MAP_VIEW,
  buildDivisionAccess,
  buildMapAccess,
  listDivisionsForUser,
  listProjectsForUser,
  parseRequestUrl,
  resolveUserFromAuthHeader,
  userCanViewAllDivisions,
};
