import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';

type AssetSummary = {
  total: number;
  active: number;
  critical: number;
  avg_health: number | null;
};

type ProjectSummary = {
  total: number;
  avg_physical: number | null;
  avg_financial: number | null;
  delayed: number;
};

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private assetProjectColumnReady: boolean | null = null;

  constructor(
    @InjectRepository(Asset) private assetsRepo: Repository<Asset>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    private divisionAccess: DivisionAccessService,
  ) {}

  async getExecutiveDashboard(tenantId: string, user: JwtPayload) {
    try {
      return await this.loadExecutiveDashboard(tenantId, user);
    } catch (err) {
      this.logger.error(
        `Executive dashboard failed for user ${user.sub}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return this.emptyExecutiveDashboard();
    }
  }

  private async loadExecutiveDashboard(tenantId: string, user: JwtPayload) {
    const projectIds = await this.divisionAccess.getAccessibleProjectIds(user, tenantId);
    const scopedProjectIds = projectIds ?? [];
    const canScopeAssetsByProject = projectIds === null || await this.assetsHaveProjectLink();

    const assetProjectFilter = projectIds === null || !canScopeAssetsByProject
      ? ''
      : projectIds.length === 0
        ? 'AND 1 = 0'
        : 'AND a.project_id = ANY($2::uuid[])';
    const assetParams: unknown[] = projectIds === null || !canScopeAssetsByProject || !projectIds.length
      ? [tenantId]
      : [tenantId, projectIds];

    const iotAlertFrom = projectIds === null || !canScopeAssetsByProject
      ? `FROM iot_alerts ia
         JOIN iot_devices id ON id.id = ia.device_id`
      : projectIds.length === 0
        ? `FROM iot_alerts ia
           JOIN iot_devices id ON id.id = ia.device_id`
        : `FROM iot_alerts ia
           JOIN iot_devices id ON id.id = ia.device_id
           JOIN assets a ON a.id = id.asset_id AND a.tenant_id = $1 AND a.deleted_at IS NULL`;
    const iotAlertFilter = projectIds === null || !canScopeAssetsByProject
      ? ''
      : projectIds.length === 0
        ? 'AND 1 = 0'
        : 'AND a.project_id = ANY($2::uuid[])';
    const iotAlertParams: unknown[] = projectIds === null || !canScopeAssetsByProject || !projectIds.length
      ? [tenantId]
      : [tenantId, projectIds];

    const projectStatsSql = projectIds === null
      ? `SELECT COUNT(*)::int AS total,
          ROUND(AVG(physical_progress))::int AS avg_physical,
          ROUND(AVG(financial_progress))::int AS avg_financial,
          COUNT(*) FILTER (WHERE physical_progress < 50 AND end_date < CURRENT_DATE)::int AS delayed
         FROM projects WHERE tenant_id = $1`
      : scopedProjectIds.length === 0
        ? `SELECT 0 AS total, 0 AS avg_physical, 0 AS avg_financial, 0 AS delayed`
        : `SELECT COUNT(*)::int AS total,
          ROUND(AVG(physical_progress))::int AS avg_physical,
          ROUND(AVG(financial_progress))::int AS avg_financial,
          COUNT(*) FILTER (WHERE physical_progress < 50 AND end_date < CURRENT_DATE)::int AS delayed
         FROM projects WHERE tenant_id = $1 AND id = ANY($2::uuid[])`;

    const projectStatsParams = projectIds === null || !scopedProjectIds.length
      ? [tenantId]
      : [tenantId, scopedProjectIds];

    const [assetStats, projectStats, criticalAssets, iotAlerts] = await Promise.all([
      this.assetsRepo.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE status = 'critical')::int AS critical,
          ROUND(AVG(health_score))::int AS avg_health
        FROM assets a WHERE a.tenant_id = $1 AND a.deleted_at IS NULL ${assetProjectFilter}`,
        assetParams,
      ),
      this.projectsRepo.query(projectStatsSql, projectStatsParams),
      this.assetsRepo.query(
        `SELECT a.id, a.asset_code, a.name, a.status, a.health_score,
                t.name AS asset_type
         FROM assets a
         JOIN asset_types t ON t.id = a.asset_type_id
         WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
           AND (a.status = 'critical' OR a.health_score < 50)
           ${assetProjectFilter}
         ORDER BY a.health_score ASC LIMIT 10`,
        assetParams,
      ),
      this.assetsRepo.query(
        `SELECT ia.id, ia.severity, ia.message, ia.metric, ia.value, ia.created_at,
                id.name AS device_name
         ${iotAlertFrom}
         WHERE ia.tenant_id = $1 AND ia.acknowledged = false
           ${iotAlertFilter}
         ORDER BY ia.created_at DESC LIMIT 10`,
        iotAlertParams,
      ),
    ]);

    const assets = this.normalizeAssetSummary(assetStats[0]);
    const projects = this.normalizeProjectSummary(projectStats[0]);

    return {
      kpis: [
        { id: 'total_assets', label: 'Total Assets', value: assets.total, trend: '+2.3%', status: 'up' },
        { id: 'active_alerts', label: 'Active Alerts', value: iotAlerts.length, trend: '-12%', status: 'down' },
        { id: 'critical_assets', label: 'Critical Assets', value: assets.critical, trend: null, status: 'warning' },
        { id: 'project_completion', label: 'Avg Project Progress', value: `${projects.avg_physical}%`, trend: '+5%', status: 'up' },
        { id: 'avg_health', label: 'Avg Asset Health', value: `${assets.avg_health}%`, trend: '-0.8%', status: 'down' },
      ],
      assetSummary: assets,
      projectSummary: projects,
      criticalAssets,
      recentAlerts: iotAlerts,
      charts: {
        assetByStatus: await this.assetsRepo.query(
          `SELECT status, COUNT(*)::int AS count
           FROM assets a WHERE a.tenant_id = $1 AND a.deleted_at IS NULL ${assetProjectFilter}
           GROUP BY status`,
          assetParams,
        ),
        projectProgress: projectIds === null
          ? await this.projectsRepo.query(
            `SELECT name, physical_progress, financial_progress
             FROM projects WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5`,
            [tenantId],
          )
          : scopedProjectIds.length === 0
            ? []
            : await this.projectsRepo.query(
              `SELECT name, physical_progress, financial_progress
               FROM projects WHERE tenant_id = $1 AND id = ANY($2::uuid[])
               ORDER BY created_at DESC LIMIT 5`,
              [tenantId, scopedProjectIds],
            ),
      },
    };
  }

  private async assetsHaveProjectLink(): Promise<boolean> {
    if (this.assetProjectColumnReady !== null) return this.assetProjectColumnReady;
    try {
      const rows = await this.assetsRepo.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'project_id'
         ) AS ok`,
      ) as Array<{ ok: boolean }>;
      this.assetProjectColumnReady = Boolean(rows[0]?.ok);
    } catch {
      this.assetProjectColumnReady = false;
    }
    return this.assetProjectColumnReady;
  }

  private normalizeAssetSummary(row: AssetSummary | undefined): AssetSummary {
    return {
      total: row?.total ?? 0,
      active: row?.active ?? 0,
      critical: row?.critical ?? 0,
      avg_health: row?.avg_health ?? 0,
    };
  }

  private normalizeProjectSummary(row: ProjectSummary | undefined): ProjectSummary {
    return {
      total: row?.total ?? 0,
      avg_physical: row?.avg_physical ?? 0,
      avg_financial: row?.avg_financial ?? 0,
      delayed: row?.delayed ?? 0,
    };
  }

  private emptyExecutiveDashboard() {
    const assets = this.normalizeAssetSummary(undefined);
    const projects = this.normalizeProjectSummary(undefined);
    return {
      kpis: [
        { id: 'total_assets', label: 'Total Assets', value: 0, trend: '+2.3%', status: 'up' },
        { id: 'active_alerts', label: 'Active Alerts', value: 0, trend: '-12%', status: 'down' },
        { id: 'critical_assets', label: 'Critical Assets', value: 0, trend: null, status: 'warning' },
        { id: 'project_completion', label: 'Avg Project Progress', value: '0%', trend: '+5%', status: 'up' },
        { id: 'avg_health', label: 'Avg Asset Health', value: '0%', trend: '-0.8%', status: 'down' },
      ],
      assetSummary: assets,
      projectSummary: projects,
      criticalAssets: [],
      recentAlerts: [],
      charts: {
        assetByStatus: [],
        projectProgress: [],
      },
    };
  }
}
