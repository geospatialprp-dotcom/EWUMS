import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DivisionAccessService } from '../divisions/division-access.service';

/** Shared division/project scoping for O&M services (mirrors om-billing patterns). */
@Injectable()
export class OmDivisionScopeService {
  constructor(private divisionAccess: DivisionAccessService) {}

  async resolveProjectId(
    user: JwtPayload,
    tenantId: string,
    projectId?: string,
    projectCode?: string,
  ): Promise<string | null> {
    if (projectId?.trim() || projectCode?.trim()) {
      return this.divisionAccess.resolveAccessibleProjectId(user, tenantId, projectId, projectCode);
    }
    return null;
  }

  async resolveDefaultProjectId(user: JwtPayload, tenantId: string): Promise<string | null> {
    return this.divisionAccess.resolveDefaultProjectId(user, tenantId);
  }

  /** Complaint list scope: match project_id or consumer-linked scheme in the user's division. */
  async scopeComplaintProjectQb(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: JwtPayload,
    tenantId: string,
    alias: string,
    resolvedProjectId: string | null,
  ): Promise<void> {
    if (resolvedProjectId) {
      qb.andWhere(`${alias}.project_id = :scopedProjectId`, { scopedProjectId: resolvedProjectId });
      return;
    }
    const ids = await this.getAccessibleProjectIds(user, tenantId);
    if (ids === null) return;
    if (ids.length === 0) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere(
      `(${alias}.project_id IN (:...scopedProjectIds) OR (${alias}.project_id IS NULL AND ${alias}.om_consumer_id IN (
        SELECT oc.id FROM om_consumers oc
        WHERE oc.tenant_id = :complaintScopeTenantId AND oc.project_id IN (:...scopedProjectIds)
      )))`,
      { scopedProjectIds: ids, complaintScopeTenantId: tenantId },
    );
  }

  async scopeProjectQb(
    qb: SelectQueryBuilder<ObjectLiteral>,
    user: JwtPayload,
    tenantId: string,
    alias: string,
    resolvedProjectId: string | null,
  ): Promise<void> {
    await this.divisionAccess.scopeQueryByAccessibleProjects(
      qb, user, tenantId, alias, resolvedProjectId,
    );
  }

  async assertProjectAccess(user: JwtPayload, projectId: string | null | undefined, tenantId: string): Promise<void> {
    if (!projectId) return;
    await this.divisionAccess.assertProjectAccess(user, projectId, tenantId);
  }

  async getAccessibleProjectIds(user: JwtPayload, tenantId: string): Promise<string[] | null> {
    return this.divisionAccess.getAccessibleProjectIds(user, tenantId);
  }

  /** Build SQL fragment + params for raw queries filtering by accessible projects. */
  async buildProjectIdSqlFilter(
    user: JwtPayload,
    tenantId: string,
    column: string,
    startParamIndex: number,
  ): Promise<{ clause: string; params: unknown[] } | null> {
    const ids = await this.getAccessibleProjectIds(user, tenantId);
    if (ids === null) return null;
    if (!ids.length) {
      return { clause: '1 = 0', params: [] };
    }
    return {
      clause: `${column} = ANY($${startParamIndex}::uuid[])`,
      params: [ids],
    };
  }
}
