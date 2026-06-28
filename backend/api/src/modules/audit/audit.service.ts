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
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      details: l.details,
      createdAt: l.createdAt,
    }));
  }
}
