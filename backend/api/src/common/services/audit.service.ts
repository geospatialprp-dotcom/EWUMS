import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../modules/audit/entities/audit-log.entity';
import {
  AuditContext,
  formatAuditLocation,
  resolveIpGeo,
  reverseGeocodeAddress,
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
    let accuracyMeters = context?.accuracyMeters;
    let source: 'gps' | 'ip' | null = null;

    if (
      typeof latitude === 'number'
      && Number.isFinite(latitude)
      && typeof longitude === 'number'
      && Number.isFinite(longitude)
    ) {
      source = 'gps';
      // Full postal-style address from GPS (e.g. Bhurgaon, Dehradun, Uttarakhand, 248001, India)
      const reverse = await reverseGeocodeAddress(latitude, longitude);
      if (reverse) place = reverse;
    }

    if ((latitude == null || longitude == null || !place) && ipAddress) {
      const geo = await resolveIpGeo(ipAddress);
      if (latitude == null && geo.latitude != null) {
        latitude = geo.latitude;
        longitude = geo.longitude;
        if (!source) source = 'ip';
      }
      if (!place && geo.place) place = geo.place;
      if (!source && geo.latitude != null) source = 'ip';
    }

    const location = formatAuditLocation({
      place,
      latitude,
      longitude,
      accuracyMeters,
      source,
    });

    const mergedDetails: Record<string, unknown> = {
      ...(details ?? {}),
    };
    if (latitude != null && longitude != null) {
      mergedDetails.latitude = Number(latitude.toFixed(6));
      mergedDetails.longitude = Number(longitude.toFixed(6));
    }
    if (place) mergedDetails.address = place;
    if (typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters)) {
      mergedDetails.accuracyMeters = Math.round(accuracyMeters);
    }
    if (source) mergedDetails.locationSource = source;

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
