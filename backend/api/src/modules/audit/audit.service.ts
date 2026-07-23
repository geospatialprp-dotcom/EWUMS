import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

type AuditRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  first_name: string | null;
  last_name: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  location: string | null;
  details: Record<string, unknown> | string | null;
  created_at: Date | string;
};

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);
  private locationColumn: boolean | null = null;

  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(tenantId: string, limit = 100, activeDivisionId?: string | null) {
    const safeLimit = Math.min(Math.max(limit || 100, 1), 500);
    const divisionId = activeDivisionId?.trim() || null;

    try {
      return await this.loadViaRawSql(tenantId, safeLimit, divisionId, true);
    } catch (err) {
      this.logger.warn(
        `Audit query (with project join) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Keep division scope — never fall back to statewide/KPG-all when a division was requested.
      if (divisionId) {
        return this.loadViaRawSql(tenantId, safeLimit, divisionId, false);
      }
      return this.loadViaRawSql(tenantId, safeLimit, null, false);
    }
  }

  private async hasLocationColumn(): Promise<boolean> {
    if (this.locationColumn != null) return this.locationColumn;
    try {
      const rows = await this.auditRepo.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'audit_logs'
           AND column_name = 'location'
         LIMIT 1`,
      ) as unknown[];
      this.locationColumn = rows.length > 0;
    } catch {
      this.locationColumn = false;
    }
    return this.locationColumn;
  }

  private async loadViaRawSql(
    tenantId: string,
    limit: number,
    divisionId: string | null,
    includeProjectJoin: boolean,
  ) {
    const includeLocation = await this.hasLocationColumn();
    const locationSelect = includeLocation ? 'l.location' : 'NULL::varchar AS location';

    const params: unknown[] = [tenantId];
    let divisionSql = '';

    if (divisionId) {
      params.push(divisionId);
      const d = `$${params.length}`;
      const projectJoin = includeProjectJoin
        ? `
          OR (
            NULLIF(l.details->>'projectId', '') IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM projects p
              WHERE p.tenant_id = l.tenant_id
                AND p.id::text = l.details->>'projectId'
                AND p.division_id::text = ${d}
            )
          )
          OR (
            l.resource_type = 'project'
            AND l.resource_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM projects p
              WHERE p.tenant_id = l.tenant_id
                AND p.id = l.resource_id
                AND p.division_id::text = ${d}
            )
          )`
        : '';

      // Strict division match only — actor in division, assignment, or details.divisionId.
      divisionSql = `
        AND (
          u.division_id::text = ${d}
          OR EXISTS (
            SELECT 1 FROM user_division_assignments uda
            WHERE uda.user_id = l.user_id
              AND uda.division_id::text = ${d}
          )
          OR l.details->>'divisionId' = ${d}
          ${projectJoin}
        )`;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;

    const sql = `
      SELECT
        l.id,
        l.user_id,
        u.email AS user_email,
        u.first_name,
        u.last_name,
        l.action,
        l.resource_type,
        l.resource_id,
        CASE WHEN l.ip_address IS NULL THEN NULL ELSE l.ip_address::text END AS ip_address,
        ${locationSelect},
        COALESCE(l.details, '{}'::jsonb) AS details,
        l.created_at
      FROM audit_logs l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.tenant_id = $1::uuid
      ${divisionSql}
      ORDER BY l.created_at DESC
      LIMIT ${limitParam}
    `;

    const rows = await this.auditRepo.query(sql, params) as AuditRow[];
    const mapped = rows.map((row) => this.mapRow(row));

    // Belt-and-suspenders: drop rows that clearly belong to another division.
    if (!divisionId) return mapped;
    return mapped.filter((row) => this.rowMatchesDivision(row, divisionId));
  }

  private rowMatchesDivision(
    row: {
      details: Record<string, unknown>;
      userId: string | null;
    },
    divisionId: string,
  ): boolean {
    const detailDiv = row.details?.divisionId;
    if (typeof detailDiv === 'string' && detailDiv.trim()) {
      return detailDiv.trim() === divisionId;
    }
    // Actor-only / project-only matches already constrained in SQL; keep them.
    return true;
  }

  private mapRow(row: AuditRow) {
    const userName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    let details: Record<string, unknown> = {};
    if (row.details && typeof row.details === 'object') {
      details = row.details as Record<string, unknown>;
    } else if (typeof row.details === 'string') {
      try {
        details = JSON.parse(row.details) as Record<string, unknown>;
      } catch {
        details = {};
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email ?? null,
      userName: userName || null,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      ipAddress: row.ip_address ?? null,
      location: row.location ?? null,
      details,
      createdAt: row.created_at,
    };
  }
}
