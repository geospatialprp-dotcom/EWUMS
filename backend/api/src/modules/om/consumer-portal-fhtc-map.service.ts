import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { OmConsumer } from './entities/om-consumer.entity';

const DEMO_TENANT = 'a0000000-0000-0000-0000-000000000001';
const THARALI_CENTER = { lat: 30.2656, lng: 79.6512 };

type PlotPoint = {
  id: string;
  fhtcNumber: string;
  village: string | null;
  ward: string | null;
  latitude: number;
  longitude: number;
  source: 'consumer' | 'gis' | 'grid';
  connectionStatus?: string | null;
};

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

function readFhtcFromAttributes(attrs: Record<string, unknown>, fallbackId: string): string {
  const keys = ['fhtc_number', 'fhtcNumber', 'FHTC', 'fhtc', 'household_no', 'householdNo', 'assetCode'];
  for (const key of keys) {
    const val = attrs[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return `FHTC-HH-${fallbackId.slice(0, 8).toUpperCase()}`;
}

function sanitizeFhtcToken(value: string): string {
  return value.trim().replace(/[/\s]+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
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

function projectFhtcPrefix(projectCode?: string | null): string {
  if (!projectCode) return 'KPG';
  if (/kpg/i.test(projectCode)) return 'KPG';
  const match = projectCode.match(/([A-Z]{2,6})\d*$/i);
  return match?.[1]?.toUpperCase() ?? 'UJS';
}


function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111_320;
  const dLon = (lng2 - lng1) * 111_320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dLon, dLat);
}

@Injectable()
export class ConsumerPortalFhtcMapService {
  constructor(
    @InjectRepository(OmConsumer) private consumerRepo: Repository<OmConsumer>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
  ) {}

  async listHouseholdPlots(tenantId: string, projectCode?: string) {
    const project = await this.resolveProject(tenantId, projectCode);
    const plots = await this.loadPlots(tenantId, project?.id ?? null, project?.projectCode ?? null);
    const center = this.plotCenter(plots, project);
    return {
      projectId: project?.id ?? null,
      projectCode: project?.projectCode ?? null,
      center,
      plots,
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
    if (lat < 28 || lat > 32 || lng < 77 || lng > 81) {
      throw new BadRequestException('Selected location is outside Uttarakhand service area');
    }

    const project = await this.resolveProject(tenantId, projectCode);
    const plots = await this.loadPlots(tenantId, project?.id ?? null, project?.projectCode ?? null);

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
          distanceMeters: 0,
          snapped: true,
          message: `${built.label} identified from satellite plot — division will verify during approval.`,
        };
      }
    }

    let nearest: PlotPoint | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const plot of plots) {
      const dist = distanceMeters(lat, lng, plot.latitude, plot.longitude);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = plot;
      }
    }

    const snapThresholdM = 85;
    if (nearest && nearestDist <= snapThresholdM) {
      return {
        fhtcNumber: nearest.fhtcNumber,
        khasraNo: null,
        houseNo: null,
        village: nearest.village,
        ward: nearest.ward,
        latitude: nearest.latitude,
        longitude: nearest.longitude,
        source: nearest.source,
        distanceMeters: Math.round(nearestDist),
        snapped: true,
        message: `Existing household ${nearest.fhtcNumber} at this plot.`,
      };
    }

    const demoCadastral = generateDemoKhasraFromGrid(lat, lng);
    const built = buildFhtcFromCadastral(project?.projectCode, demoCadastral.khasraNo, demoCadastral.houseNo);
    return {
      fhtcNumber: built.fhtcNumber,
      khasraNo: demoCadastral.khasraNo,
      houseNo: demoCadastral.houseNo,
      village: nearest?.village ?? 'Tharali',
      ward: nearest?.ward ?? null,
      latitude: lat,
      longitude: lng,
      source: 'grid' as const,
      distanceMeters: nearest ? Math.round(nearestDist) : null,
      snapped: false,
      message: `Khasra ${demoCadastral.khasraNo}, House ${demoCadastral.houseNo} assigned from rooftop location. Division will verify during approval.`,
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
      `SELECT id, project_code AS "projectCode", name
       FROM projects
       WHERE tenant_id = $1 AND status = 'active'
         AND (project_code ILIKE '%KPG%' OR name ILIKE '%Tharali%')
       ORDER BY name ASC LIMIT 1`,
      [tenantId],
    ) as Array<{ id: string; projectCode: string; name: string }>;
    return rows[0] ?? null;
  }

  private async loadPlots(
    tenantId: string,
    projectId: string | null,
    projectCode: string | null,
  ): Promise<PlotPoint[]> {
    const plots: PlotPoint[] = [];
    const seen = new Set<string>();

    const consumerQb = this.consumerRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.latitude IS NOT NULL AND c.longitude IS NOT NULL');
    if (projectId) consumerQb.andWhere('c.project_id = :projectId', { projectId });
    const consumers = await consumerQb.getMany();

    consumers.forEach((c) => {
      if (c.latitude == null || c.longitude == null) return;
      const key = `${c.fhtcNumber}@${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`;
      if (seen.has(key)) return;
      seen.add(key);
      plots.push({
        id: c.id,
        fhtcNumber: c.fhtcNumber,
        village: c.village,
        ward: c.ward,
        latitude: c.latitude,
        longitude: c.longitude,
        source: 'consumer',
        connectionStatus: c.connectionStatus,
      });
    });

    if (projectId) {
      try {
        const rows = await this.projectRepo.query(
          `SELECT pf.id,
                  ST_Y(ST_PointOnSurface(pf.geometry)) AS lat,
                  ST_X(ST_PointOnSurface(pf.geometry)) AS lng,
                  pf.attributes
           FROM project_features pf
           JOIN project_feature_classes pfc ON pfc.id = pf.feature_class_id
           WHERE pf.tenant_id = $1
             AND pf.project_id = $2
             AND pf.geometry IS NOT NULL
             AND (
               pfc.code ILIKE '%fhtc%'
               OR pfc.name ILIKE '%FHTC%'
               OR pfc.name ILIKE '%household%'
             )`,
          [tenantId, projectId],
        ) as Array<{ id: string; lat: number; lng: number; attributes: Record<string, unknown> }>;

        rows.forEach((row) => {
          if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return;
          const fhtc = readFhtcFromAttributes(row.attributes ?? {}, row.id);
          const key = `${fhtc}@${row.lat.toFixed(5)},${row.lng.toFixed(5)}`;
          if (seen.has(key)) return;
          seen.add(key);
          plots.push({
            id: row.id,
            fhtcNumber: fhtc,
            village: typeof row.attributes?.village === 'string' ? row.attributes.village : null,
            ward: typeof row.attributes?.ward === 'string' ? row.attributes.ward : null,
            latitude: Number(row.lat),
            longitude: Number(row.lng),
            source: 'gis',
          });
        });
      } catch {
        // PostGIS optional — consumers still shown.
      }
    }

    if (plots.length < 8) {
      this.demoGridPlots(projectCode).forEach((plot) => {
        const key = `${plot.fhtcNumber}@${plot.latitude.toFixed(5)},${plot.longitude.toFixed(5)}`;
        if (seen.has(key)) return;
        seen.add(key);
        plots.push(plot);
      });
    }

    return plots;
  }

  private demoGridPlots(projectCode: string | null): PlotPoint[] {
    const prefix = projectFhtcPrefix(projectCode);
    const demos: PlotPoint[] = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const seq = row * 4 + col + 1;
        const lat = THARALI_CENTER.lat + row * 0.0012 - 0.001;
        const lng = THARALI_CENTER.lng + col * 0.0011 - 0.0015;
        demos.push({
          id: `demo-${seq}`,
          fhtcNumber: `FHTC-${prefix}-HH-${String(seq).padStart(4, '0')}`,
          village: 'Tharali',
          ward: `Ward ${seq}`,
          latitude: lat,
          longitude: lng,
          source: 'grid',
          connectionStatus: 'pending',
        });
      }
    }
    return demos;
  }

  private plotCenter(plots: PlotPoint[], project: { id: string } | null) {
    if (plots.length) {
      const lat = plots.reduce((s, p) => s + p.latitude, 0) / plots.length;
      const lng = plots.reduce((s, p) => s + p.longitude, 0) / plots.length;
      return { lat, lng, zoom: 17 };
    }
      return { ...THARALI_CENTER, zoom: 17 };
  }

  defaultTenant() {
    return DEMO_TENANT;
  }
}
