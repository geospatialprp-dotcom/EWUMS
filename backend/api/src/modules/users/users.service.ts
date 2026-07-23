import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository, In } from 'typeorm';
import { AuditService } from '../../common/services/audit.service';
import { AuditContext } from '../../common/utils/request-context.util';
import { isSuperAdmin } from '../../common/utils/operational-access.util';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../auth/entities/role.entity';
import { User } from '../auth/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type DivisionMeta = { id: string; code: string; name: string };

/** Roles an EE may assign inside their division (not HQ / org admin roles). */
const EE_ASSIGNABLE_ROLE_CODES = new Set([
  'je',
  'ae',
  'ee',
  'contractor',
  'accounts',
  'om_operator',
  'scada_operator',
  'gis_operator',
  'billing_officer',
]);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    private auditService: AuditService,
  ) {}

  async findAll(actor: JwtPayload) {
    const tenantId = actor.tenantId;
    const divisionFilter = this.resolveListDivisionFilter(actor);

    const qb = this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'roles')
      .where('u.tenant_id = :tenantId', { tenantId })
      .orderBy('u.created_at', 'DESC');

    if (divisionFilter) {
      qb.andWhere(
        `(u.division_id = :divisionId OR EXISTS (
          SELECT 1 FROM user_division_assignments uda
          WHERE uda.user_id = u.id AND uda.division_id = :divisionId
        ))`,
        { divisionId: divisionFilter },
      );
    } else if (!actor.canViewAllDivisions && !isSuperAdmin(actor.roles)) {
      throw new ForbiddenException('Your account has no division assignment. Contact HQ IT.');
    }

    const users = await qb.getMany();
    const divisionMap = await this.loadDivisionMeta(tenantId, users.map((u) => u.divisionId));
    return users.map((u) => this.toResponse(u, divisionMap.get(u.divisionId ?? '')));
  }

  async findOne(actor: JwtPayload, id: string) {
    const user = await this.usersRepo.findOne({
      where: { id, tenantId: actor.tenantId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException('User not found');
    await this.assertCanManageUser(actor, user);
    const divisionMap = await this.loadDivisionMeta(actor.tenantId, [user.divisionId]);
    return this.toResponse(user, divisionMap.get(user.divisionId ?? ''));
  }

  async create(actor: JwtPayload, dto: CreateUserDto, auditContext?: AuditContext) {
    const tenantId = actor.tenantId;
    const existing = await this.usersRepo.findOne({
      where: { tenantId, email: dto.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const roles = await this.rolesRepo.findBy({ id: In(dto.roleIds), tenantId });
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('One or more roles not found');
    }
    this.assertAssignableRoles(actor, roles);

    const forcedDivision = this.resolveForcedDivisionId(actor);
    const divisionId = await this.resolveDivisionId(
      tenantId,
      forcedDivision ?? dto.divisionId ?? actor.activeDivisionId ?? null,
      roles,
      true,
    );
    if (forcedDivision && divisionId !== forcedDivision) {
      throw new ForbiddenException('You can only create users in your own division.');
    }
    if (forcedDivision && !divisionId) {
      throw new BadRequestException('Division is required for division staff.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      tenantId,
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      department: dto.department,
      status: 'active',
      divisionId,
      roles,
    });
    const saved = await this.usersRepo.save(user);
    await this.syncDivisionAssignment(saved.id, divisionId);

    await this.auditService.log(tenantId, actor.sub, 'user.create', 'user', saved.id, {
      email: dto.email,
      divisionId,
    }, auditContext);

    return this.findOne(actor, saved.id);
  }

  async update(
    actor: JwtPayload,
    id: string,
    dto: UpdateUserDto,
    auditContext?: AuditContext,
  ) {
    const tenantId = actor.tenantId;
    const user = await this.usersRepo.findOne({
      where: { id, tenantId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException('User not found');
    await this.assertCanManageUser(actor, user);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.usersRepo.findOne({
        where: { tenantId, email: dto.email },
      });
      if (existing) throw new ConflictException('Email already exists');
      user.email = dto.email;
    }

    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName) user.lastName = dto.lastName;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.status) user.status = dto.status;
    if (dto.password) user.passwordHash = await bcrypt.hash(dto.password, 10);

    if (dto.roleIds) {
      const roles = await this.rolesRepo.findBy({ id: In(dto.roleIds), tenantId });
      this.assertAssignableRoles(actor, roles);
      user.roles = roles;
    }

    const forcedDivision = this.resolveForcedDivisionId(actor);
    if (forcedDivision) {
      // EE cannot move users out of their division
      if (dto.divisionId !== undefined && dto.divisionId !== forcedDivision) {
        throw new ForbiddenException('You can only keep users in your own division.');
      }
      user.divisionId = forcedDivision;
      await this.usersRepo.save(user);
      await this.syncDivisionAssignment(user.id, forcedDivision);
    } else if (dto.divisionId !== undefined) {
      user.divisionId = await this.resolveDivisionId(
        tenantId,
        dto.divisionId,
        user.roles,
        false,
      );
      await this.usersRepo.save(user);
      await this.syncDivisionAssignment(user.id, user.divisionId);
    } else {
      await this.usersRepo.save(user);
    }

    await this.auditService.log(tenantId, actor.sub, 'user.update', 'user', id, {
      changes: Object.keys(dto),
    }, auditContext);

    return this.findOne(actor, id);
  }

  async remove(actor: JwtPayload, id: string, auditContext?: AuditContext) {
    const user = await this.usersRepo.findOne({
      where: { id, tenantId: actor.tenantId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.id === actor.sub) throw new BadRequestException('Cannot delete your own account');
    await this.assertCanManageUser(actor, user);

    user.status = 'inactive';
    await this.usersRepo.save(user);

    await this.auditService.log(actor.tenantId, actor.sub, 'user.deactivate', 'user', id, undefined, auditContext);
    return { success: true };
  }

  /** HQ / super admin may list all or filter by header; EE locked to own division. */
  private resolveListDivisionFilter(actor: JwtPayload): string | null {
    if (actor.canViewAllDivisions || isSuperAdmin(actor.roles)) {
      return actor.activeDivisionId ?? null;
    }
    return actor.divisionId ?? null;
  }

  private resolveForcedDivisionId(actor: JwtPayload): string | null {
    if (actor.canViewAllDivisions || isSuperAdmin(actor.roles)) return null;
    return actor.divisionId ?? null;
  }

  private assertAssignableRoles(actor: JwtPayload, roles: Role[]) {
    if (actor.canViewAllDivisions || isSuperAdmin(actor.roles)) return;
    const invalid = roles.filter((r) => !EE_ASSIGNABLE_ROLE_CODES.has(r.code));
    if (invalid.length) {
      throw new ForbiddenException(
        `You cannot assign role(s): ${invalid.map((r) => r.code).join(', ')}. `
        + 'EE may assign JE, AE, contractor, accounts, and other division field roles only.',
      );
    }
  }

  private async assertCanManageUser(actor: JwtPayload, target: User) {
    if (actor.canViewAllDivisions || isSuperAdmin(actor.roles)) return;

    const divisionId = actor.divisionId;
    if (!divisionId) {
      throw new ForbiddenException('Your account has no division assignment.');
    }

    const inDivision = await this.userBelongsToDivision(target.id, target.divisionId, divisionId);
    if (!inDivision) {
      throw new ForbiddenException('You can only manage users in your own division.');
    }

    const roleCodes = (target.roles ?? []).map((r) => r.code);
    if (roleCodes.includes('super_admin')) {
      throw new ForbiddenException('You cannot manage Super Admin accounts.');
    }
    const hasHqOnlyRole = roleCodes.some((code) => !EE_ASSIGNABLE_ROLE_CODES.has(code));
    if (hasHqOnlyRole) {
      throw new ForbiddenException(
        'You can only manage division field roles (JE, AE, contractor, accounts, etc.).',
      );
    }
  }

  private async userBelongsToDivision(
    userId: string,
    userDivisionId: string | null,
    divisionId: string,
  ): Promise<boolean> {
    if (userDivisionId === divisionId) return true;
    const rows = await this.usersRepo.query(
      `SELECT 1 FROM user_division_assignments
       WHERE user_id = $1 AND division_id = $2 LIMIT 1`,
      [userId, divisionId],
    ) as unknown[];
    return rows.length > 0;
  }

  private async resolveDivisionId(
    tenantId: string,
    divisionId: string | null | undefined,
    roles: Role[],
    requiredForFieldRoles: boolean,
  ): Promise<string | null> {
    const normalized = divisionId?.trim() || null;
    if (!normalized) {
      const FIELD_ROLES = new Set([
        'je', 'ae', 'ee', 'contractor', 'accounts', 'om_operator', 'scada_operator',
      ]);
      const needsDivision = roles.some((r) => FIELD_ROLES.has(r.code));
      if (requiredForFieldRoles && needsDivision) {
        throw new BadRequestException(
          'Select a division for this user. Use the header Division switcher or the Division field.',
        );
      }
      return null;
    }

    const rows = await this.usersRepo.query(
      `SELECT id FROM divisions WHERE id = $1 AND tenant_id = $2 AND status = 'active' LIMIT 1`,
      [normalized, tenantId],
    ) as Array<{ id: string }>;
    if (!rows.length) {
      throw new BadRequestException('Selected division was not found');
    }
    return normalized;
  }

  private async syncDivisionAssignment(userId: string, divisionId: string | null) {
    if (!divisionId) {
      await this.usersRepo.query(
        'DELETE FROM user_division_assignments WHERE user_id = $1',
        [userId],
      );
      return;
    }
    await this.usersRepo.query(
      `INSERT INTO user_division_assignments (user_id, division_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id`,
      [userId, divisionId],
    );
  }

  private async loadDivisionMeta(tenantId: string, divisionIds: Array<string | null | undefined>) {
    const ids = [...new Set(divisionIds.filter((id): id is string => Boolean(id)))];
    const map = new Map<string, DivisionMeta>();
    if (!ids.length) return map;
    const rows = await this.usersRepo.query(
      `SELECT id, code, name FROM divisions
       WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [tenantId, ids],
    ) as DivisionMeta[];
    for (const row of rows) map.set(row.id, row);
    return map;
  }

  private toResponse(user: User, division?: DivisionMeta) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      status: user.status,
      divisionId: user.divisionId ?? null,
      divisionCode: division?.code ?? null,
      divisionName: division?.name ?? null,
      roles: user.roles?.map((r) => ({ id: r.id, code: r.code, name: r.name })) ?? [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
