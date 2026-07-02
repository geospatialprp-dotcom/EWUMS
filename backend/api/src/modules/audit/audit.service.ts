import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DivisionAccessService } from '../divisions/division-access.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditLog } from './entities/audit-log.entity';

type RawAuditRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_meters: number | null;
  created_at: Date;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
};

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private divisionAccess: DivisionAccessService,
  ) {}

  async findAll(user: JwtPayload, limit = 100) {
    const tenantId = user.tenantId;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100;

    if (!tenantId) {
      return { divisionScope: null, logs: [] };
    }

    try {
      const logs = await this.queryLogs(user, tenantId, safeLimit, true);
      return this.buildResponse(user, tenantId, logs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.isMissingGpsColumnError(message)) {
        this.logger.warn('audit_logs GPS columns missing — listing without coordinates');
        try {
          const logs = await this.queryLogs(user, tenantId, safeLimit, false);
          return this.buildResponse(user, tenantId, logs);
        } catch (innerErr) {
          this.logger.warn(`Audit ORM fallback failed: ${innerErr instanceof Error ? innerErr.message : innerErr}`);
        }
      } else {
        this.logger.warn(`Audit ORM query failed: ${message}`);
      }

      try {
        const logs = await this.rawQueryLogs(user, tenantId, safeLimit);
        return this.buildResponse(user, tenantId, logs);
      } catch (rawErr) {
        const rawMessage = rawErr instanceof Error ? rawErr.message : String(rawErr);
        this.logger.error(`Audit raw SQL fallback failed: ${rawMessage}`);
        return { divisionScope: null, logs: [] };
      }
    }
  }

  private isMissingGpsColumnError(message: string): boolean {
    return /column "(location|latitude|longitude|location_accuracy_meters)" of relation "audit_logs" does not exist/i.test(message);
  }

  private async queryLogs(
    user: JwtPayload,
    tenantId: string,
    limit: number,
    includeGps: boolean,
  ): Promise<AuditLog[]> {
    const qb = this.auditRepo.createQueryBuilder('al');

    if (includeGps) {
      qb.leftJoinAndSelect('al.user', 'user');
    } else {
      qb.leftJoin('al.user', 'user')
        .select([
          'al.id',
          'al.tenantId',
          'al.userId',
          'al.action',
          'al.resourceType',
          'al.resourceId',
          'al.details',
          'al.ipAddress',
          'al.location',
          'al.createdAt',
        ])
        .addSelect(['user.id', 'user.email', 'user.firstName', 'user.lastName']);
    }

    qb.where('al.tenant_id = :tenantId', { tenantId })
      .orderBy('al.created_at', 'DESC')
      .take(limit);

    try {
      await this.divisionAccess.applyUserDivisionMembershipScope(qb, user, 'al.user_id', tenantId);
    } catch (scopeErr) {
      const scopeMessage = scopeErr instanceof Error ? scopeErr.message : String(scopeErr);
      this.logger.warn(`Audit division scope skipped: ${scopeMessage}`);
    }

    return qb.getMany();
  }

  private async rawQueryLogs(
    user: JwtPayload,
    tenantId: string,
    limit: number,
  ): Promise<AuditLog[]> {
    let divisionClause = '';
    const params: unknown[] = [tenantId, limit];

    try {
      const divisionIds = await this.divisionAccess.getAccessibleDivisionIds(user, tenantId);
      if (divisionIds !== null) {
        if (divisionIds.length === 0) {
          return [];
        }
        divisionClause = ` AND al.user_id IN (
          SELECT DISTINCT u.id
          FROM users u
          LEFT JOIN user_division_assignments uda ON uda.user_id = u.id
          WHERE u.tenant_id = $1
            AND COALESCE(uda.division_id, u.division_id) = ANY($3::uuid[])
        )`;
        params.push(divisionIds);
      }
    } catch (scopeErr) {
      const scopeMessage = scopeErr instanceof Error ? scopeErr.message : String(scopeErr);
      this.logger.warn(`Audit raw division scope skipped: ${scopeMessage}`);
    }

    const hasGps = await this.hasGpsColumns();
    const gpsSelect = hasGps
      ? 'al.latitude, al.longitude, al.location_accuracy_meters,'
      : 'NULL::double precision AS latitude, NULL::double precision AS longitude, NULL::double precision AS location_accuracy_meters,';

    const rows = await this.auditRepo.query(
      `SELECT al.id, al.tenant_id, al.user_id, al.action, al.resource_type, al.resource_id,
              al.details, al.ip_address, al.location, ${gpsSelect}
              al.created_at,
              u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.tenant_id = $1${divisionClause}
       ORDER BY al.created_at DESC
       LIMIT $2`,
      params,
    ) as RawAuditRow[];

    return rows.map((row) => this.mapRawRow(row));
  }

  private async hasGpsColumns(): Promise<boolean> {
    try {
      const rows = await this.auditRepo.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'latitude'
         ) AS ok`,
      ) as Array<{ ok: boolean }>;
      return Boolean(rows[0]?.ok);
    } catch {
      return false;
    }
  }

  private mapRawRow(row: RawAuditRow): AuditLog {
    const log = new AuditLog();
    log.id = String(row.id);
    log.tenantId = String(row.tenant_id);
    log.userId = row.user_id ? String(row.user_id) : null as unknown as string;
    log.action = row.action;
    log.resourceType = row.resource_type ?? undefined as unknown as string;
    log.resourceId = row.resource_id ?? undefined as unknown as string;
    log.details = row.details ?? {};
    log.ipAddress = row.ip_address ?? undefined as unknown as string;
    log.location = row.location ?? undefined as unknown as string;
    log.latitude = row.latitude ?? null;
    log.longitude = row.longitude ?? null;
    log.locationAccuracyMeters = row.location_accuracy_meters ?? null;
    log.createdAt = new Date(row.created_at);
    if (row.user_email || row.user_first_name || row.user_last_name) {
      log.user = {
        id: row.user_id ?? '',
        email: row.user_email ?? '',
        firstName: row.user_first_name ?? '',
        lastName: row.user_last_name ?? '',
      } as AuditLog['user'];
    }
    return log;
  }

  private async buildResponse(user: JwtPayload, tenantId: string, logs: AuditLog[]) {
    let divisionScope: string | null = null;
    try {
      divisionScope = await this.divisionAccess.getDivisionScopeLabel(user, tenantId);
    } catch (scopeErr) {
      const scopeMessage = scopeErr instanceof Error ? scopeErr.message : String(scopeErr);
      this.logger.warn(`Audit division label skipped: ${scopeMessage}`);
    }

    const mapped = logs.map((l) => {
      const userName = [l.user?.firstName, l.user?.lastName].filter(Boolean).join(' ').trim();
      return {
        id: l.id,
        userId: l.userId,
        userEmail: l.user?.email ?? null,
        userName: userName || null,
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        ipAddress: l.ipAddress ?? null,
        location: l.location ?? null,
        latitude: l.latitude ?? null,
        longitude: l.longitude ?? null,
        locationAccuracyMeters: l.locationAccuracyMeters ?? null,
        details: l.details,
        createdAt: l.createdAt,
      };
    });

    return { divisionScope, logs: mapped };
  }
}
