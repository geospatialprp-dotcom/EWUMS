import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity';
import { AuditContext, resolveAuditLocation } from '../utils/request-context.util';

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
    const resolved = await resolveAuditLocation(context ?? {});
    const enrichedDetails = {
      ...(details ?? {}),
      ...(resolved.locationSource ? { locationSource: resolved.locationSource } : {}),
    };

    const base = {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      details: enrichedDetails as never,
      ipAddress: ipAddress ?? undefined,
      location: resolved.location ?? undefined,
      latitude: resolved.latitude ?? undefined,
      longitude: resolved.longitude ?? undefined,
      locationAccuracyMeters: resolved.locationAccuracyMeters ?? undefined,
    };

    try {
      await this.auditRepo.insert(base);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/column "(location|latitude|longitude|location_accuracy_meters)" of relation "audit_logs" does not exist/i.test(message)) {
        await this.auditRepo.query(
          `INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
          [
            tenantId,
            userId,
            action,
            resourceType ?? null,
            resourceId ?? null,
            JSON.stringify(enrichedDetails),
            ipAddress ?? null,
          ],
        );
        return;
      }
      throw err;
    }
  }
}
