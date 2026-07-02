import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DivisionAccessService } from '../divisions/division-access.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private divisionAccess: DivisionAccessService,
  ) {}

  async findAll(user: JwtPayload, limit = 100) {
    const tenantId = user.tenantId;

    try {
      const logs = await this.queryLogs(user, tenantId, limit, true);
      return this.buildResponse(user, tenantId, logs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.isMissingGpsColumnError(message)) {
        this.logger.warn('audit_logs GPS columns missing — listing without coordinates');
        const logs = await this.queryLogs(user, tenantId, limit, false);
        return this.buildResponse(user, tenantId, logs);
      }
      this.logger.error(`Audit trail query failed: ${message}`);
      throw err;
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
    const qb = this.auditRepo
      .createQueryBuilder('al')
      .leftJoinAndSelect('al.user', 'user')
      .where('al.tenant_id = :tenantId', { tenantId })
      .orderBy('al.created_at', 'DESC')
      .take(limit);

    if (!includeGps) {
      qb.select([
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
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
      ]);
    }

    try {
      await this.divisionAccess.applyUserDivisionMembershipScope(qb, user, 'al.user_id', tenantId);
    } catch (scopeErr) {
      const scopeMessage = scopeErr instanceof Error ? scopeErr.message : String(scopeErr);
      this.logger.warn(`Audit division scope skipped: ${scopeMessage}`);
    }

    return qb.getMany();
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
