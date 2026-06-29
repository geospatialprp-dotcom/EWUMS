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

    const base = {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      details: (details ?? {}) as never,
      ipAddress: ipAddress ?? undefined,
    };

    try {
      await this.auditRepo.insert({
        ...base,
        location: location ?? undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/column "location" of relation "audit_logs" does not exist/i.test(message)) {
        throw err;
      }
      await this.auditRepo.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        [
          tenantId,
          userId,
          action,
          resourceType ?? null,
          resourceId ?? null,
          JSON.stringify(details ?? {}),
          ipAddress ?? null,
        ],
      );
    }
  }
}
