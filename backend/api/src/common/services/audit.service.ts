import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity';
import {
  AuditContext,
  formatAuditLocation,
  resolveIpGeo,
} from '../utils/request-context.util';

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
    let latitude = context?.latitude;
    let longitude = context?.longitude;
    let place = context?.location;

    // Prefer browser coords; otherwise resolve from public IP (includes lat/lon).
    if (
      (latitude == null || longitude == null || !place)
      && ipAddress
    ) {
      const geo = await resolveIpGeo(ipAddress);
      if (latitude == null && geo.latitude != null) latitude = geo.latitude;
      if (longitude == null && geo.longitude != null) longitude = geo.longitude;
      if (!place && geo.place) place = geo.place;
    }

    const location = formatAuditLocation({ place, latitude, longitude });

    const mergedDetails: Record<string, unknown> = {
      ...(details ?? {}),
    };
    if (latitude != null && longitude != null) {
      mergedDetails.latitude = Number(latitude.toFixed(6));
      mergedDetails.longitude = Number(longitude.toFixed(6));
    }
    if (place && !mergedDetails.place) {
      mergedDetails.place = place;
    }

    const base = {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      details: mergedDetails as never,
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
          JSON.stringify(mergedDetails),
          ipAddress ?? null,
        ],
      );
    }
  }
}
