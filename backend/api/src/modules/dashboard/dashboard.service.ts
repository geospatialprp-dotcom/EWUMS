import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';
import { Asset } from '../assets/entities/asset.entity';
import { Project } from '../projects/entities/project.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Asset) private assetsRepo: Repository<Asset>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    private divisionAccess: DivisionAccessService,
  ) {}

  async getExecutiveDashboard(tenantId: string, user: JwtPayload) {
    const projectIds = await this.divisionAccess.getAccessibleProjectIds(user, tenantId);
    const assetProjectFilter = projectIds === null
      ? ''
      : projectIds.length === 0
        ? 'AND 1 = 0'
        : 'AND a.project_id = ANY($2::uuid[])';
    const assetParams: unknown[] = projectIds === null || !projectIds.length
      ? [tenantId]
      : [tenantId, projectIds];

    const iotAlertFilter = projectIds === null
      ? ''
      : projectIds.length === 0
        ? 'AND 1 = 0'
        : 'AND a.project_id = ANY($2::uuid[])';
    const iotAlertParams: unknown[] = projectIds === null || !projectIds.length
      ? [tenantId]
      : [tenantId, projectIds];

    const projectQb = this.projectsRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId });
    await this.divisionAccess.applyDivisionScope(projectQb, user, 'p', tenantId);
    const scopedProjects = await projectQb.select(['p.id']).getMany();
    const scopedProjectIds = scopedProjects.map((p) => p.id);

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
         FROM iot_alerts ia
         JOIN iot_devices id ON id.id = ia.device_id
         LEFT JOIN assets a ON a.id = id.asset_id AND a.tenant_id = $1
         WHERE ia.tenant_id = $1 AND ia.acknowledged = false
           ${iotAlertFilter}
         ORDER BY ia.created_at DESC LIMIT 10`,
        iotAlertParams,
      ),
    ]);

    const assets = assetStats[0];
    const projects = projectStats[0];

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
}
