import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(tenantId: string, limit = 100) {
    const logs = await this.auditRepo.find({
      where: { tenantId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

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
        latitude: l.latitude ?? null,
        longitude: l.longitude ?? null,
        locationAccuracyMeters: l.locationAccuracyMeters ?? null,
        details: l.details,
        createdAt: l.createdAt,
      };
    });
  }
}
