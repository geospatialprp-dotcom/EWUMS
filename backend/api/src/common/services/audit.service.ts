import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async log(
    tenantId: string,
    userId: string | null,
    action: string,
    resourceType?: string,
    resourceId?: string,
    details?: Record<string, unknown>,
  ) {
    await this.auditRepo.insert({
      tenantId,
      userId: userId ?? undefined,
      action,
      resourceType,
      resourceId,
      details: (details ?? {}) as never,
    });
  }
}
