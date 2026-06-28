import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity';
import { AuditContext, resolveIpLocation } from '../utils/request-context.util';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async log(
    tenantId: string,
    userId: string,
    action: string,
    resourceType?: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    context?: AuditContext,
  ) {
    if (!userId) {
      throw new Error('Audit log requires userId from authenticated user');
    }

    const ipAddress = context?.ipAddress;
    let location = context?.location;
    if (!location && ipAddress) {
      location = await resolveIpLocation(ipAddress);
    }

    await this.auditRepo.insert({
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      details: (details ?? {}) as never,
      ipAddress: ipAddress ?? undefined,
      location: location ?? undefined,
    });
  }
}
