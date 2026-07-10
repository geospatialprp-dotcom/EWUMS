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

function readFhtcFromAttributes(attrs: Record<string, unknown>, fallbackId: string): string {
  const keys = ['fhtc_number', 'fhtcNumber', 'FHTC', 'fhtc', 'household_no', 'householdNo', 'assetCode'];
  for (const key of keys) {
    const val = attrs[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return `FHTC-HH-${fallbackId.slice(0, 8).toUpperCase()}`;
}

function projectFhtcPrefix(projectCode?: string | null): string {
  if (!projectCode) return 'KPG';
  if (/kpg/i.test(projectCode)) return 'KPG';
  const match = projectCode.match(/([A-Z]{2,6})\d*$/i);
  return match?.[1]?.toUpperCase() ?? 'UJS';
}

function generateFhtcFromGrid(projectCode: string | null | undefined, lat: number, lng: number): string {
  const prefix = projectFhtcPrefix(projectCode);
  const row = Math.floor((lat - THARALI_CENTER.lat) / 0.0009);
  const col = Math.floor((lng - THARALI_CENTER.lng) / 0.0009);
  const seq = Math.abs(row * 1000 + col) % 9999;
  return `FHTC-${prefix}-HH-${String(seq + 1).padStart(4, '0')}`;
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
        village: nearest.village,
        ward: nearest.ward,
        latitude: nearest.latitude,
        longitude: nearest.longitude,
        source: nearest.source,
        distanceMeters: Math.round(nearestDist),
        snapped: true,
      };
    }

    const generated = generateFhtcFromGrid(project?.projectCode, lat, lng);
    return {
      fhtcNumber: generated,
      village: nearest?.village ?? 'Tharali',
      ward: nearest?.ward ?? null,
      latitude: lat,
      longitude: lng,
      source: 'grid' as const,
      distanceMeters: nearest ? Math.round(nearestDist) : null,
      snapped: false,
      message: 'New household plot — FHTC generated from map location. Division will verify during approval.',
    };
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
      return { lat, lng, zoom: 15 };
    }
    return { ...THARALI_CENTER, zoom: 14 };
  }

  defaultTenant() {
    return DEMO_TENANT;
  }
}
