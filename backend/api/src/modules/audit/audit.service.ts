import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DivisionAccessService } from '../divisions/division-access.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private divisionAccess: DivisionAccessService,
  ) {}

  async findAll(user: JwtPayload, limit = 100) {
    const tenantId = user.tenantId;
    const qb = this.auditRepo
      .createQueryBuilder('al')
      .leftJoinAndSelect('al.user', 'user')
      .where('al.tenant_id = :tenantId', { tenantId })
      .orderBy('al.created_at', 'DESC')
      .take(limit);

    await this.divisionAccess.applyUserDivisionMembershipScope(qb, user, 'al.user_id', tenantId);

    const logs = await qb.getMany();
    const divisionScope = await this.divisionAccess.getDivisionScopeLabel(user, tenantId);

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
