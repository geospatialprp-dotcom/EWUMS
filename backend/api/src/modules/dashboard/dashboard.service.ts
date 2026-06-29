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

type DivisionSummaryRow = {
  id: string;
  code: string;
  name: string;
  project_count: number;
  avg_progress: number;
  asset_count: number;
  open_complaints: number;
  collection_pct: number | null;
};

type SchemeSummaryRow = {
  id: string;
  project_code: string;
  name: string;
  status: string;
  physical_progress: number;
  financial_progress: number;
  asset_count: number;
};

type ActivityRow = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  created_at: string;
  severity?: string;
};

type PendingTaskRow = {
  id: string;
  title: string;
  step_name: string;
  assigned_role: string;
  created_at: string;
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
    const divisionIds = await this.divisionAccess.getAccessibleDivisionIds(user, tenantId);
    const scopedProjectIds = projectIds ?? [];
    const canScopeAssetsByProject = projectIds === null || await this.assetsHaveProjectLink();
    const showDivisionSummaries = divisionIds === null;

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

    const [
      assetStats,
      projectStats,
      criticalAssets,
      iotAlerts,
      pendingApprovals,
      openComplaints,
      collectionPct,
      divisionSummaries,
      schemeSummaries,
      collectionTrend,
      projectStatusChart,
      recentActivity,
      pendingTasks,
    ] = await Promise.all([
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
      this.countPendingApprovals(tenantId, projectIds),
      this.countOpenComplaints(tenantId, projectIds),
      this.getCollectionEfficiency(tenantId, projectIds),
      showDivisionSummaries
        ? this.loadDivisionSummaries(tenantId)
        : Promise.resolve([] as DivisionSummaryRow[]),
      !showDivisionSummaries
        ? this.loadSchemeSummaries(tenantId, projectIds)
        : Promise.resolve([] as SchemeSummaryRow[]),
      this.loadCollectionTrend(tenantId, projectIds),
      this.loadProjectStatusChart(tenantId, projectIds),
      this.loadRecentActivity(tenantId, projectIds),
      this.loadPendingTasks(tenantId, projectIds),
    ]);

    const assets = this.normalizeAssetSummary(assetStats[0]);
    const projects = this.normalizeProjectSummary(projectStats[0]);
    const collectionLabel = collectionPct != null ? `${collectionPct}%` : '—';

    return {
      scope: showDivisionSummaries ? 'statewide' : 'division',
      kpis: [
        {
          id: 'active_projects',
          label: 'Active Projects',
          value: projects.total,
          trend: projects.delayed > 0 ? `${projects.delayed} delayed` : 'On track',
          status: projects.delayed > 0 ? 'warning' : 'up',
        },
        {
          id: 'total_assets',
          label: 'Assets',
          value: assets.total,
          trend: `${assets.active} active`,
          status: 'up',
        },
        {
          id: 'pending_approvals',
          label: 'Pending Approvals',
          value: pendingApprovals,
          trend: pendingApprovals > 0 ? 'Needs action' : 'All clear',
          status: pendingApprovals > 0 ? 'warning' : 'up',
        },
        {
          id: 'collection',
          label: 'Revenue Collection',
          value: collectionLabel,
          trend: collectionPct != null && collectionPct >= 90 ? 'Above target' : 'This month',
          status: collectionPct != null && collectionPct >= 90 ? 'up' : 'neutral',
        },
        {
          id: 'open_complaints',
          label: 'Open Complaints',
          value: openComplaints,
          trend: openComplaints > 0 ? 'Monitor SLA' : 'No open tickets',
          status: openComplaints > 5 ? 'down' : openComplaints > 0 ? 'warning' : 'up',
        },
      ],
      assetSummary: assets,
      projectSummary: projects,
      divisionSummaries: showDivisionSummaries ? divisionSummaries : null,
      schemeSummaries: !showDivisionSummaries ? schemeSummaries : null,
      criticalAssets,
      recentAlerts: iotAlerts,
      recentActivity,
      pendingTasks,
      charts: {
        assetByStatus: await this.assetsRepo.query(
          `SELECT status, COUNT(*)::int AS count
           FROM assets a WHERE a.tenant_id = $1 AND a.deleted_at IS NULL ${assetProjectFilter}
           GROUP BY status ORDER BY count DESC`,
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
        projectStatus: projectStatusChart,
        collectionTrend,
      },
    };
  }

  private async countPendingApprovals(tenantId: string, projectIds: string[] | null): Promise<number> {
    try {
      const hasWorkflow = await this.tableExists('workflow_tasks');
      if (!hasWorkflow) return 0;

      if (projectIds === null) {
        const rows = await this.projectsRepo.query(
          `SELECT COUNT(*)::int AS cnt FROM workflow_tasks wt
           JOIN workflow_instances wi ON wi.id = wt.instance_id
           WHERE wi.tenant_id = $1 AND wt.status = 'pending'`,
          [tenantId],
        );
        return rows[0]?.cnt ?? 0;
      }
      if (projectIds.length === 0) return 0;

      const rows = await this.projectsRepo.query(
        `SELECT COUNT(*)::int AS cnt FROM workflow_tasks wt
         JOIN workflow_instances wi ON wi.id = wt.instance_id
         LEFT JOIN ra_bills rb ON wi.resource_type = 'ra_bill' AND rb.id = wi.resource_id
         LEFT JOIN assets a ON wi.resource_type = 'asset' AND a.id = wi.resource_id AND a.deleted_at IS NULL
         WHERE wi.tenant_id = $1 AND wt.status = 'pending'
           AND (
             rb.project_id = ANY($2::uuid[])
             OR a.project_id = ANY($2::uuid[])
             OR (wi.payload->>'projectId')::uuid = ANY($2::uuid[])
           )`,
        [tenantId, projectIds],
      );
      return rows[0]?.cnt ?? 0;
    } catch {
      return 0;
    }
  }

  private async countOpenComplaints(tenantId: string, projectIds: string[] | null): Promise<number> {
    try {
      const hasTable = await this.tableExists('om_consumer_complaints');
      if (!hasTable) return 0;

      if (projectIds === null) {
        const rows = await this.projectsRepo.query(
          `SELECT COUNT(*)::int AS cnt FROM om_consumer_complaints
           WHERE tenant_id = $1 AND status != 'closed'`,
          [tenantId],
        );
        return rows[0]?.cnt ?? 0;
      }
      if (projectIds.length === 0) return 0;

      const rows = await this.projectsRepo.query(
        `SELECT COUNT(*)::int AS cnt FROM om_consumer_complaints
         WHERE tenant_id = $1 AND status != 'closed' AND project_id = ANY($2::uuid[])`,
        [tenantId, projectIds],
      );
      return rows[0]?.cnt ?? 0;
    } catch {
      return 0;
    }
  }

  private async getCollectionEfficiency(tenantId: string, projectIds: string[] | null): Promise<number | null> {
    try {
      const hasBills = await this.tableExists('om_consumer_bills');
      const hasPayments = await this.tableExists('om_billing_payments');
      if (!hasBills || !hasPayments) return null;

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const projectFilter = projectIds === null
        ? ''
        : projectIds.length === 0
          ? 'AND 1 = 0'
          : 'AND c.project_id = ANY($3::uuid[])';
      const params: unknown[] = projectIds === null || !projectIds.length
        ? [tenantId, monthStartStr]
        : [tenantId, monthStartStr, projectIds];

      const demandRows = await this.projectsRepo.query(
        `SELECT COALESCE(SUM(b.total_amount), 0)::float AS demand
         FROM om_consumer_bills b
         JOIN om_consumers c ON c.id = b.consumer_id
         WHERE b.tenant_id = $1 AND b.billing_period_from >= $2::date ${projectFilter}`,
        params,
      );
      const collectionRows = await this.projectsRepo.query(
        `SELECT COALESCE(SUM(p.amount), 0)::float AS collection
         FROM om_billing_payments p
         JOIN om_consumers c ON c.id = p.consumer_id
         WHERE p.tenant_id = $1 AND p.payment_date >= $2::date ${projectFilter}`,
        params,
      );

      const demand = Number(demandRows[0]?.demand ?? 0);
      const collection = Number(collectionRows[0]?.collection ?? 0);
      if (demand <= 0) return null;
      return Math.round((collection / demand) * 1000) / 10;
    } catch {
      return null;
    }
  }

  private async loadDivisionSummaries(tenantId: string): Promise<DivisionSummaryRow[]> {
    try {
      const hasDivisions = await this.tableExists('divisions');
      if (!hasDivisions) return [];

      const rows = await this.projectsRepo.query(
        `SELECT
           d.id,
           d.code,
           d.name,
           COUNT(DISTINCT p.id)::int AS project_count,
           COALESCE(ROUND(AVG(p.physical_progress))::int, 0) AS avg_progress,
           COUNT(DISTINCT a.id)::int AS asset_count,
           (
             SELECT COUNT(*)::int FROM om_consumer_complaints oc
             WHERE oc.tenant_id = d.tenant_id AND oc.status != 'closed'
               AND oc.project_id IN (
                 SELECT id FROM projects WHERE division_id = d.id AND tenant_id = d.tenant_id
               )
           ) AS open_complaints
         FROM divisions d
         LEFT JOIN projects p ON p.division_id = d.id AND p.tenant_id = d.tenant_id
         LEFT JOIN assets a ON a.project_id = p.id AND a.tenant_id = d.tenant_id AND a.deleted_at IS NULL
         WHERE d.tenant_id = $1 AND d.is_headquarters = false AND d.status = 'active'
         GROUP BY d.id, d.code, d.name, d.tenant_id
         ORDER BY d.name`,
        [tenantId],
      ) as Array<Omit<DivisionSummaryRow, 'collection_pct'> & { open_complaints: number }>;

      return Promise.all(rows.map(async (row) => ({
        ...row,
        collection_pct: await this.getDivisionCollectionPct(tenantId, row.id),
      })));
    } catch {
      return [];
    }
  }

  private async getDivisionCollectionPct(tenantId: string, divisionId: string): Promise<number | null> {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const demandRows = await this.projectsRepo.query(
        `SELECT COALESCE(SUM(b.total_amount), 0)::float AS demand
         FROM om_consumer_bills b
         JOIN om_consumers c ON c.id = b.consumer_id
         JOIN projects p ON p.id = c.project_id
         WHERE b.tenant_id = $1 AND p.division_id = $2 AND b.billing_period_from >= $3::date`,
        [tenantId, divisionId, monthStartStr],
      );
      const collectionRows = await this.projectsRepo.query(
        `SELECT COALESCE(SUM(pay.amount), 0)::float AS collection
         FROM om_billing_payments pay
         JOIN om_consumers c ON c.id = pay.consumer_id
         JOIN projects pr ON pr.id = c.project_id
         WHERE pay.tenant_id = $1 AND pr.division_id = $2 AND pay.payment_date >= $3::date`,
        [tenantId, divisionId, monthStartStr],
      );

      const demand = Number(demandRows[0]?.demand ?? 0);
      const collection = Number(collectionRows[0]?.collection ?? 0);
      if (demand <= 0) return null;
      return Math.round((collection / demand) * 1000) / 10;
    } catch {
      return null;
    }
  }

  private async loadSchemeSummaries(tenantId: string, projectIds: string[] | null): Promise<SchemeSummaryRow[]> {
    try {
      if (projectIds !== null && projectIds.length === 0) return [];

      const sql = projectIds === null
        ? `SELECT p.id, p.project_code, p.name, p.status,
                  ROUND(p.physical_progress)::int AS physical_progress,
                  ROUND(p.financial_progress)::int AS financial_progress,
                  (SELECT COUNT(*)::int FROM assets a
                   WHERE a.project_id = p.id AND a.tenant_id = p.tenant_id AND a.deleted_at IS NULL) AS asset_count
           FROM projects p WHERE p.tenant_id = $1 ORDER BY p.name LIMIT 12`
        : `SELECT p.id, p.project_code, p.name, p.status,
                  ROUND(p.physical_progress)::int AS physical_progress,
                  ROUND(p.financial_progress)::int AS financial_progress,
                  (SELECT COUNT(*)::int FROM assets a
                   WHERE a.project_id = p.id AND a.tenant_id = p.tenant_id AND a.deleted_at IS NULL) AS asset_count
           FROM projects p WHERE p.tenant_id = $1 AND p.id = ANY($2::uuid[]) ORDER BY p.name LIMIT 12`;

      const params = projectIds === null ? [tenantId] : [tenantId, projectIds];
      return await this.projectsRepo.query(sql, params);
    } catch {
      return [];
    }
  }

  private async loadCollectionTrend(tenantId: string, projectIds: string[] | null) {
    try {
      const hasPayments = await this.tableExists('om_billing_payments');
      if (!hasPayments) return this.demoCollectionTrend();

      const projectFilter = projectIds === null
        ? ''
        : projectIds.length === 0
          ? 'AND 1 = 0'
          : 'AND c.project_id = ANY($2::uuid[])';
      const params: unknown[] = projectIds === null || !projectIds?.length
        ? [tenantId]
        : [tenantId, projectIds];

      const rows = await this.projectsRepo.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', pay.payment_date), 'Mon') AS month,
           EXTRACT(EPOCH FROM DATE_TRUNC('month', pay.payment_date))::bigint AS sort_key,
           ROUND(COALESCE(SUM(pay.amount), 0))::int AS collection
         FROM om_billing_payments pay
         JOIN om_consumers c ON c.id = pay.consumer_id
         WHERE pay.tenant_id = $1
           AND pay.payment_date >= (CURRENT_DATE - INTERVAL '6 months')
           ${projectFilter}
         GROUP BY DATE_TRUNC('month', pay.payment_date)
         ORDER BY sort_key`,
        params,
      );

      if (!rows.length) return this.demoCollectionTrend();
      return rows.map((r: { month: string; collection: number }) => ({
        month: r.month,
        collection: r.collection,
      }));
    } catch {
      return this.demoCollectionTrend();
    }
  }

  private demoCollectionTrend() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, i) => ({
      month,
      collection: 820000 + i * 45000 + (i % 2) * 30000,
    }));
  }

  private async loadProjectStatusChart(tenantId: string, projectIds: string[] | null) {
    try {
      if (projectIds !== null && projectIds.length === 0) return [];

      const sql = projectIds === null
        ? `SELECT status, COUNT(*)::int AS count FROM projects WHERE tenant_id = $1 GROUP BY status ORDER BY count DESC`
        : `SELECT status, COUNT(*)::int AS count FROM projects
           WHERE tenant_id = $1 AND id = ANY($2::uuid[]) GROUP BY status ORDER BY count DESC`;

      const params = projectIds === null ? [tenantId] : [tenantId, projectIds];
      return await this.projectsRepo.query(sql, params);
    } catch {
      return [];
    }
  }

  private async loadRecentActivity(tenantId: string, projectIds: string[] | null): Promise<ActivityRow[]> {
    const activities: ActivityRow[] = [];
    try {
      const hasAudit = await this.tableExists('audit_logs');
      if (hasAudit) {
        const rows = await this.projectsRepo.query(
          `SELECT id, action, resource_type, details, created_at
           FROM audit_logs WHERE tenant_id = $1
           ORDER BY created_at DESC LIMIT 8`,
          [tenantId],
        ) as Array<{ id: string; action: string; resource_type: string; details: unknown; created_at: string }>;

        for (const row of rows) {
          activities.push({
            id: row.id,
            type: 'audit',
            title: row.action.replace(/_/g, ' '),
            subtitle: row.resource_type,
            created_at: row.created_at,
          });
        }
      }
    } catch {
      /* graceful */
    }

    try {
      const hasAlerts = await this.tableExists('iot_alerts');
      if (hasAlerts && activities.length < 8) {
        const alertParams = projectIds === null || !projectIds?.length
          ? [tenantId]
          : [tenantId, projectIds];
        const alertFilter = projectIds === null
          ? ''
          : projectIds!.length === 0
            ? 'AND 1 = 0'
            : `AND EXISTS (
                 SELECT 1 FROM iot_devices id
                 JOIN assets a ON a.id = id.asset_id
                 WHERE id.id = ia.device_id AND a.project_id = ANY($2::uuid[])
               )`;

        const alerts = await this.projectsRepo.query(
          `SELECT ia.id, ia.severity, ia.message, ia.created_at
           FROM iot_alerts ia
           WHERE ia.tenant_id = $1 ${alertFilter}
           ORDER BY ia.created_at DESC LIMIT 4`,
          alertParams,
        ) as Array<{ id: string; severity: string; message: string; created_at: string }>;

        for (const a of alerts) {
          activities.push({
            id: a.id,
            type: 'alert',
            title: a.message,
            subtitle: 'IoT Alert',
            created_at: a.created_at,
            severity: a.severity,
          });
        }
      }
    } catch {
      /* graceful */
    }

    return activities
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }

  private async loadPendingTasks(tenantId: string, projectIds: string[] | null): Promise<PendingTaskRow[]> {
    try {
      const hasWorkflow = await this.tableExists('workflow_tasks');
      if (!hasWorkflow) return [];

      if (projectIds === null) {
        return await this.projectsRepo.query(
          `SELECT wt.id, wi.title, wt.step_name, wt.assigned_role, wt.created_at
           FROM workflow_tasks wt
           JOIN workflow_instances wi ON wi.id = wt.instance_id
           WHERE wi.tenant_id = $1 AND wt.status = 'pending'
           ORDER BY wt.created_at DESC LIMIT 6`,
          [tenantId],
        );
      }
      if (projectIds.length === 0) return [];

      return await this.projectsRepo.query(
        `SELECT wt.id, wi.title, wt.step_name, wt.assigned_role, wt.created_at
         FROM workflow_tasks wt
         JOIN workflow_instances wi ON wi.id = wt.instance_id
         LEFT JOIN ra_bills rb ON wi.resource_type = 'ra_bill' AND rb.id = wi.resource_id
         LEFT JOIN assets a ON wi.resource_type = 'asset' AND a.id = wi.resource_id AND a.deleted_at IS NULL
         WHERE wi.tenant_id = $1 AND wt.status = 'pending'
           AND (
             rb.project_id = ANY($2::uuid[])
             OR a.project_id = ANY($2::uuid[])
             OR (wi.payload->>'projectId')::uuid = ANY($2::uuid[])
           )
         ORDER BY wt.created_at DESC LIMIT 6`,
        [tenantId, projectIds],
      );
    } catch {
      return [];
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const rows = await this.projectsRepo.query(
        `SELECT to_regclass($1) AS t`,
        [`public.${tableName}`],
      ) as Array<{ t: string | null }>;
      return Boolean(rows[0]?.t);
    } catch {
      return false;
    }
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
      scope: 'division' as const,
      kpis: [
        { id: 'active_projects', label: 'Active Projects', value: 0, trend: 'On track', status: 'up' },
        { id: 'total_assets', label: 'Assets', value: 0, trend: '0 active', status: 'up' },
        { id: 'pending_approvals', label: 'Pending Approvals', value: 0, trend: 'All clear', status: 'up' },
        { id: 'collection', label: 'Revenue Collection', value: '—', trend: 'This month', status: 'neutral' },
        { id: 'open_complaints', label: 'Open Complaints', value: 0, trend: 'No open tickets', status: 'up' },
      ],
      assetSummary: assets,
      projectSummary: projects,
      divisionSummaries: null,
      schemeSummaries: [],
      criticalAssets: [],
      recentAlerts: [],
      recentActivity: [],
      pendingTasks: [],
      charts: {
        assetByStatus: [],
        projectProgress: [],
        projectStatus: [],
        collectionTrend: this.demoCollectionTrend(),
      },
    };
  }
}
