import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DivisionAccessService } from '../divisions/division-access.service';
import { UTTARAKHAND_DISTRICT_BBOXES } from '../gis/constants/district-boundaries.constants';
import { Project } from '../projects/entities/project.entity';

const DEMO_TENANT = 'a0000000-0000-0000-0000-000000000001';
const DEFAULT_DISTRICT = 'Chamoli';
const THARALI_CENTER = { lat: 30.2656, lng: 79.6512 };

const KHASRA_ATTR_KEYS = ['khasra_no', 'khasraNo', 'Khasra', 'khasra', 'survey_no', 'surveyNo', 'plot_no', 'plotNo'];
const HOUSE_ATTR_KEYS = ['house_no', 'houseNo', 'house_number', 'houseNumber', 'door_no', 'building_no', 'buildingNo'];

function pickAttr(attrs: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const val = attrs[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  }
  return '';
}

function sanitizeFhtcToken(value: string): string {
  return value.trim().replace(/[/\s]+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

function projectFhtcPrefix(projectCode?: string | null): string {
  if (!projectCode) return 'KPG';
  if (/kpg/i.test(projectCode)) return 'KPG';
  const match = projectCode.match(/([A-Z]{2,6})\d*$/i);
  return match?.[1]?.toUpperCase() ?? 'UJS';
}

function buildFhtcFromCadastral(
  projectCode: string | null | undefined,
  khasraNo: string,
  houseNo: string,
): { fhtcNumber: string; label: string } {
  const prefix = projectFhtcPrefix(projectCode);
  if (houseNo) {
    const token = sanitizeFhtcToken(houseNo);
    return {
      fhtcNumber: `FHTC-${prefix}-H${token}`,
      label: `House No. ${houseNo}`,
    };
  }
  if (khasraNo) {
    const token = sanitizeFhtcToken(khasraNo);
    return {
      fhtcNumber: `FHTC-${prefix}-KH-${token}`,
      label: `Khasra ${khasraNo}`,
    };
  }
  return { fhtcNumber: '', label: '' };
}

function generateDemoKhasraFromGrid(lat: number, lng: number): { khasraNo: string; houseNo: string } {
  const row = Math.floor((lat - THARALI_CENTER.lat) / 0.00042);
  const col = Math.floor((lng - THARALI_CENTER.lng) / 0.00042);
  const khasraMain = 118 + (Math.abs(row) % 24);
  const sub = (Math.abs(col) % 6) + 1;
  const houseSeq = (Math.abs(row * 7 + col) % 48) + 1;
  return {
    khasraNo: `${khasraMain}/${sub}`,
    houseNo: String(houseSeq),
  };
}

function bboxToMapView(bbox: number[]) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const center = { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
  const span = Math.max(maxLon - minLon, maxLat - minLat);
  let zoom = 9;
  if (span < 0.05) zoom = 13;
  else if (span < 0.15) zoom = 11;
  else if (span < 0.4) zoom = 9.5;
  else if (span < 0.8) zoom = 8.5;
  return { ...center, zoom };
}

@Injectable()
export class ConsumerPortalFhtcMapService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private divisionAccess: DivisionAccessService,
  ) {}

  async listHouseholdPlots(tenantId: string, projectCode?: string) {
    const project = await this.resolveProject(tenantId, projectCode);
    const districtName = await this.resolveDistrictForProject(tenantId, project);
    const districtBoundary = await this.divisionAccess.getDistrictBoundaryGeoJson(tenantId, [districtName]);
    const bbox = (await this.divisionAccess.computeDistrictBbox(tenantId, [districtName]))
      ?? UTTARAKHAND_DISTRICT_BBOXES[districtName]
      ?? UTTARAKHAND_DISTRICT_BBOXES[DEFAULT_DISTRICT];
    const center = bboxToMapView(bbox);

    return {
      projectId: project?.id ?? null,
      projectCode: project?.projectCode ?? null,
      districtName,
      districtBoundary,
      bbox,
      center,
    };
  }

  async resolveFhtcAtLocation(
    tenantId: string,
    lat: number,
    lng: number,
    projectCode?: string,
  ) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('Valid map coordinates are required');
    }

    const project = await this.resolveProject(tenantId, projectCode);
    const districtName = await this.resolveDistrictForProject(tenantId, project);
    const insideDistrict = await this.isPointInDistrict(tenantId, districtName, lat, lng);
    if (!insideDistrict) {
      throw new BadRequestException(
        `Selected location is outside ${districtName} district boundary. Zoom to your house inside the blue boundary.`,
      );
    }

    const cadastral = project?.id
      ? await this.resolveCadastralAtPoint(tenantId, project.id, lat, lng)
      : null;
    if (cadastral) {
      const built = buildFhtcFromCadastral(project?.projectCode, cadastral.khasraNo, cadastral.houseNo);
      if (built.fhtcNumber) {
        return {
          fhtcNumber: built.fhtcNumber,
          khasraNo: cadastral.khasraNo || null,
          houseNo: cadastral.houseNo || null,
          village: cadastral.village,
          ward: cadastral.ward,
          latitude: lat,
          longitude: lng,
          source: 'cadastral' as const,
          districtName,
          snapped: true,
          message: `${built.label} identified at this rooftop — division will verify during approval.`,
        };
      }
    }

    const demoCadastral = generateDemoKhasraFromGrid(lat, lng);
    const built = buildFhtcFromCadastral(project?.projectCode, demoCadastral.khasraNo, demoCadastral.houseNo);
    return {
      fhtcNumber: built.fhtcNumber,
      khasraNo: demoCadastral.khasraNo,
      houseNo: demoCadastral.houseNo,
      village: 'Tharali',
      ward: null,
      latitude: lat,
      longitude: lng,
      source: 'grid' as const,
      districtName,
      snapped: false,
      message: `Khasra ${demoCadastral.khasraNo}, House ${demoCadastral.houseNo} assigned from rooftop tap. Division will verify during approval.`,
    };
  }

  private async resolveCadastralAtPoint(
    tenantId: string,
    projectId: string,
    lat: number,
    lng: number,
  ): Promise<{ khasraNo: string; houseNo: string; village: string | null; ward: string | null } | null> {
    try {
      const rows = await this.projectRepo.query(
        `SELECT pf.attributes,
                ST_Distance(
                  pf.geometry::geography,
                  ST_SetSRID(ST_Point($4, $3), 4326)::geography
                ) AS dist_m
         FROM project_features pf
         JOIN project_feature_classes pfc ON pfc.id = pf.feature_class_id
         WHERE pf.tenant_id = $1
           AND pf.project_id = $2
           AND pf.geometry IS NOT NULL
           AND (
             lower(pfc.code) = ANY($5)
             OR pfc.name ILIKE '%khasra%'
             OR pfc.name ILIKE '%cadastral%'
             OR pfc.name ILIKE '%parcel%'
             OR pfc.name ILIKE '%revenue%'
           )
           AND ST_DWithin(
             pf.geometry::geography,
             ST_SetSRID(ST_Point($4, $3), 4326)::geography,
             25
           )
         ORDER BY
           CASE WHEN ST_Contains(pf.geometry, ST_SetSRID(ST_Point($4, $3), 4326)) THEN 0 ELSE 1 END,
           dist_m ASC
         LIMIT 1`,
        [
          tenantId,
          projectId,
          lat,
          lng,
          [
            'khasra_boundary',
            'khasra',
            'survey_parcel',
            'la_parcels',
            'cadastral_parcels',
            'revenue_parcels',
            'land_parcels',
            'land_ownership',
            'khata_boundary',
          ],
        ],
      ) as Array<{ attributes: Record<string, unknown>; dist_m: number }>;

      const row = rows[0];
      if (!row?.attributes) return null;

      const attrs = row.attributes ?? {};
      const khasraNo = pickAttr(attrs, KHASRA_ATTR_KEYS);
      const houseNo = pickAttr(attrs, HOUSE_ATTR_KEYS);
      const village = pickAttr(attrs, ['village', 'village_name', 'villageName', 'gram']) || null;
      const ward = pickAttr(attrs, ['ward', 'ward_no', 'wardNo', 'area']) || null;

      if (!khasraNo && !houseNo) return null;
      return { khasraNo, houseNo, village, ward };
    } catch {
      return null;
    }
  }

  private async resolveProject(tenantId: string, projectCode?: string) {
    if (projectCode?.trim()) {
      return this.projectRepo.findOne({ where: { tenantId, projectCode: projectCode.trim() } });
    }
    const rows = await this.projectRepo.query(
      `SELECT id, project_code AS "projectCode", name, division_id AS "divisionId"
       FROM projects
       WHERE tenant_id = $1 AND status = 'active'
         AND (project_code ILIKE '%KPG%' OR name ILIKE '%Tharali%')
       ORDER BY name ASC LIMIT 1`,
      [tenantId],
    ) as Array<{ id: string; projectCode: string; name: string; divisionId: string | null }>;
    return rows[0] ?? null;
  }

  private async resolveDistrictForProject(
    tenantId: string,
    project: { divisionId?: string | null } | null,
  ): Promise<string> {
    if (project?.divisionId) {
      const rows = await this.projectRepo.query(
        `SELECT district, code FROM divisions WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, project.divisionId],
      ) as Array<{ district: string | null; code: string }>;
      const row = rows[0];
      if (row?.district?.trim()) return row.district.trim();
      if (row?.code?.includes('KPG') || row?.code?.includes('CHM')) return DEFAULT_DISTRICT;
    }
    return DEFAULT_DISTRICT;
  }

  private async isPointInDistrict(
    tenantId: string,
    districtName: string,
    lat: number,
    lng: number,
  ): Promise<boolean> {
    const fallback = UTTARAKHAND_DISTRICT_BBOXES[districtName];
    try {
      const rows = await this.projectRepo.query(
        `SELECT ST_Within(
           ST_SetSRID(ST_Point($3, $4), 4326),
           COALESCE(
             (
               SELECT ST_UnaryUnion(ST_Collect(geometry))
               FROM district_boundaries
               WHERE tenant_id = $1 AND district_name = $2 AND geometry IS NOT NULL
             ),
             ST_MakeEnvelope($5, $6, $7, $8, 4326)
           )
         ) AS inside`,
        [
          tenantId,
          districtName,
          lng,
          lat,
          ...(fallback ?? UTTARAKHAND_DISTRICT_BBOXES[DEFAULT_DISTRICT]),
        ],
      ) as Array<{ inside: boolean }>;
      return Boolean(rows[0]?.inside);
    } catch {
      if (!fallback) return true;
      return lng >= fallback[0] && lat >= fallback[1] && lng <= fallback[2] && lat <= fallback[3];
    }
  }

  defaultTenant() {
    return DEMO_TENANT;
  }
}
