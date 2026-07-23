import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(tenantId: string, limit = 100, activeDivisionId?: string | null) {
    const safeLimit = Math.min(Math.max(limit || 100, 1), 500);

    try {
      return await this.loadLogs(tenantId, safeLimit, activeDivisionId);
    } catch (err) {
      // Division filter must never blank the whole Admin Audit page — fall back to simpler match.
      if (activeDivisionId) {
        this.logger.warn(
          `Division audit filter failed; retrying simpler filter: ${err instanceof Error ? err.message : String(err)}`,
        );
        try {
          return await this.loadLogs(tenantId, safeLimit, activeDivisionId, true);
        } catch (err2) {
          this.logger.error(
            `Simple division audit filter failed; returning unfiltered tenant logs: ${err2 instanceof Error ? err2.message : String(err2)}`,
          );
          return this.loadLogs(tenantId, safeLimit, null);
        }
      }
      throw err;
    }
  }

  private async loadLogs(
    tenantId: string,
    limit: number,
    activeDivisionId?: string | null,
    simple = false,
  ) {
    // Alias must not be "user" — USER is reserved in PostgreSQL.
    const qb = this.auditRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'actor')
      .where('l.tenant_id = :tenantId', { tenantId })
      .orderBy('l.created_at', 'DESC')
      .take(limit);

    if (activeDivisionId) {
      // Bind :divisionId once on the parent QB — nested Brackets/orWhere often drop params.
      qb.setParameter('divisionId', activeDivisionId);

      if (simple) {
        qb.andWhere(
          `(
            actor.division_id = :divisionId
            OR EXISTS (
              SELECT 1 FROM user_division_assignments uda
              WHERE uda.user_id = l.user_id AND uda.division_id = :divisionId
            )
            OR l.details->>'divisionId' = :divisionId
          )`,
        );
      } else {
        qb.andWhere(
          `(
            actor.division_id = :divisionId
            OR EXISTS (
              SELECT 1 FROM user_division_assignments uda
              WHERE uda.user_id = l.user_id AND uda.division_id = :divisionId
            )
            OR l.details->>'divisionId' = :divisionId
            OR EXISTS (
              SELECT 1 FROM projects p
              WHERE p.tenant_id = l.tenant_id
                AND p.division_id = :divisionId
                AND (
                  (l.resource_type = 'project' AND p.id = l.resource_id)
                  OR (
                    NULLIF(l.details->>'projectId', '') IS NOT NULL
                    AND p.id::text = l.details->>'projectId'
                  )
                )
            )
          )`,
        );
      }
    }

    const logs = await qb.getMany();

    return logs.map((l) => {
      const userName = [l.user?.firstName, l.user?.lastName].filter(Boolean).join(' ').trim();
      return {
        id: l.id,
        userId: l.userId,
        userEmail: l.user?.email ?? null,
        userName: userName || null,
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        ipAddress: l.ipAddress != null ? String(l.ipAddress) : null,
        location: l.location ?? null,
        details: (l.details && typeof l.details === 'object' ? l.details : {}) as Record<string, unknown>,
        createdAt: l.createdAt,
      };
    });
  }
}
