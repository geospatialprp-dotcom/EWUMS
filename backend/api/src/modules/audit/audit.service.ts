import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(tenantId: string, limit = 100, activeDivisionId?: string | null) {
    // Alias must not be "user" — USER is reserved in PostgreSQL and breaks division filters.
    const qb = this.auditRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'actor')
      .where('l.tenant_id = :tenantId', { tenantId })
      .orderBy('l.created_at', 'DESC')
      .take(limit);

    if (activeDivisionId) {
      qb.andWhere(
        `(
          actor.division_id = :divisionId
          OR EXISTS (
            SELECT 1 FROM user_division_assignments uda
            WHERE uda.user_id = l.user_id AND uda.division_id = :divisionId
          )
          OR l.details->>'divisionId' = :divisionId
          OR (
            NULLIF(l.details->>'projectId', '') IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM projects p
              WHERE p.tenant_id = l.tenant_id
                AND p.id::text = l.details->>'projectId'
                AND p.division_id = :divisionId
            )
          )
          OR (
            l.resource_type = 'project'
            AND l.resource_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM projects p
              WHERE p.tenant_id = l.tenant_id
                AND p.id = l.resource_id
                AND p.division_id = :divisionId
            )
          )
        )`,
        { divisionId: activeDivisionId },
      );
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
        ipAddress: l.ipAddress ?? null,
        location: l.location ?? null,
        details: l.details ?? {},
        createdAt: l.createdAt,
      };
    });
  }
}
