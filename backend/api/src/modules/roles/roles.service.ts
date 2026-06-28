import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../auth/entities/permission.entity';
import { Role } from '../auth/entities/role.entity';

interface RolePermissionRow {
  role_id: string;
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    @InjectRepository(Permission) private permissionsRepo: Repository<Permission>,
  ) {}

  async findAll(tenantId: string) {
    const roles = await this.rolesRepo.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });

    const permissionRows: RolePermissionRow[] = await this.rolesRepo.query(
      `SELECT rp.role_id, p.id, p.resource, p.action, p.description
       FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       INNER JOIN roles r ON r.id = rp.role_id
       WHERE r.tenant_id = $1
       ORDER BY p.resource, p.action`,
      [tenantId],
    );

    const permissionsByRole = new Map<string, RolePermissionRow[]>();
    for (const row of permissionRows) {
      const list = permissionsByRole.get(row.role_id) ?? [];
      list.push(row);
      permissionsByRole.set(row.role_id, list);
    }

    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      permissions: (permissionsByRole.get(r.id) ?? []).map((p) => ({
        id: p.id,
        resource: p.resource,
        action: p.action,
        description: p.description,
        key: `${p.resource}:${p.action}`,
      })),
    }));
  }

  async findAllPermissions() {
    const permissions = await this.permissionsRepo.find({ order: { resource: 'ASC', action: 'ASC' } });
    return permissions.map((p) => ({
      id: p.id,
      resource: p.resource,
      action: p.action,
      description: p.description,
      key: `${p.resource}:${p.action}`,
    }));
  }
}
