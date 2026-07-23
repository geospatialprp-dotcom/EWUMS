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

    try {
      return await this.loadViaRawSql(tenantId, safeLimit, activeDivisionId);
    } catch (err) {
      this.logger.error(
        `Audit raw query failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Last resort: minimal query with no optional columns / division filter
      try {
        return await this.loadMinimal(tenantId, safeLimit);
      } catch (err2) {
        this.logger.error(
          `Audit minimal query failed: ${err2 instanceof Error ? err2.message : String(err2)}`,
        );
        throw err;
      }
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
    activeDivisionId?: string | null,
  ) {
    const includeLocation = await this.hasLocationColumn();
    const locationSelect = includeLocation ? 'l.location' : 'NULL::varchar AS location';

    const params: unknown[] = [tenantId];
    let divisionSql = '';
    if (activeDivisionId) {
      params.push(activeDivisionId);
      const divisionParam = `$${params.length}`;
      divisionSql = `
        AND (
          u.division_id = ${divisionParam}::uuid
          OR EXISTS (
            SELECT 1 FROM user_division_assignments uda
            WHERE uda.user_id = l.user_id AND uda.division_id = ${divisionParam}::uuid
          )
          OR l.details->>'divisionId' = ${divisionParam}
          OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.tenant_id = l.tenant_id
              AND p.division_id = ${divisionParam}::uuid
              AND (
                (l.resource_type = 'project' AND p.id = l.resource_id)
                OR (
                  NULLIF(l.details->>'projectId', '') IS NOT NULL
                  AND p.id::text = l.details->>'projectId'
                )
              )
          )
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
        l.ip_address::text AS ip_address,
        ${locationSelect},
        COALESCE(l.details, '{}'::jsonb) AS details,
        l.created_at
      FROM audit_logs l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.tenant_id = $1
      ${divisionSql}
      ORDER BY l.created_at DESC
      LIMIT ${limitParam}
    `;

    const rows = await this.auditRepo.query(sql, params) as AuditRow[];
    return rows.map((row) => this.mapRow(row));
  }

  private async loadMinimal(tenantId: string, limit: number) {
    const rows = await this.auditRepo.query(
      `SELECT
         l.id,
         l.user_id,
         u.email AS user_email,
         u.first_name,
         u.last_name,
         l.action,
         l.resource_type,
         l.resource_id,
         NULLIF(l.ip_address::text, '') AS ip_address,
         NULL::varchar AS location,
         COALESCE(l.details, '{}'::jsonb) AS details,
         l.created_at
       FROM audit_logs l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.tenant_id = $1
       ORDER BY l.created_at DESC
       LIMIT $2`,
      [tenantId, limit],
    ) as AuditRow[];
    return rows.map((row) => this.mapRow(row));
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
