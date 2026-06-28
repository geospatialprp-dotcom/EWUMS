import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { GisMapAccessLog } from './entities/gis-map-access-log.entity';

export type GisMapAuditInput = {
  action: string;
  layerId?: string;
  layerName?: string;
  projectId?: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class GisMapAuditService {
  constructor(
    @InjectRepository(GisMapAccessLog) private auditRepo: Repository<GisMapAccessLog>,
  ) {}

  async log(user: JwtPayload, input: GisMapAuditInput): Promise<void> {
    try {
      await this.auditRepo.save({
        tenantId: user.tenantId,
        userId: user.sub,
        userRole: user.roles?.[0] ?? null,
        divisionId: user.divisionId ?? null,
        divisionName: user.divisionName ?? null,
        accessScope: user.accessScope ?? null,
        action: input.action,
        layerId: input.layerId ?? null,
        layerName: input.layerName ?? null,
        projectId: input.projectId ?? null,
        details: input.details ?? null,
      });
    } catch {
      // Audit table may be absent on older databases — do not block map access.
    }
  }
}
