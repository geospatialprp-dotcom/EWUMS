import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository, In } from 'typeorm';
import { AuditService } from '../../common/services/audit.service';
import { AuditContext } from '../../common/utils/request-context.util';
import { Role } from '../auth/entities/role.entity';
import { User } from '../auth/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type DivisionMeta = { id: string; code: string; name: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    private auditService: AuditService,
  ) {}

  async findAll(tenantId: string, activeDivisionId?: string | null) {
    const qb = this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'roles')
      .where('u.tenant_id = :tenantId', { tenantId })
      .orderBy('u.created_at', 'DESC');

    if (activeDivisionId) {
      qb.andWhere(
        `(u.division_id = :divisionId OR EXISTS (
          SELECT 1 FROM user_division_assignments uda
          WHERE uda.user_id = u.id AND uda.division_id = :divisionId
        ))`,
        { divisionId: activeDivisionId },
      );
    }

    const users = await qb.getMany();
    const divisionMap = await this.loadDivisionMeta(tenantId, users.map((u) => u.divisionId));
    return users.map((u) => this.toResponse(u, divisionMap.get(u.divisionId ?? '')));
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.usersRepo.findOne({
      where: { id, tenantId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException('User not found');
    const divisionMap = await this.loadDivisionMeta(tenantId, [user.divisionId]);
    return this.toResponse(user, divisionMap.get(user.divisionId ?? ''));
  }

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateUserDto,
    auditContext?: AuditContext,
    activeDivisionId?: string | null,
  ) {
    const existing = await this.usersRepo.findOne({
      where: { tenantId, email: dto.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const roles = await this.rolesRepo.findBy({ id: In(dto.roleIds), tenantId });
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('One or more roles not found');
    }

    const divisionId = await this.resolveDivisionId(
      tenantId,
      dto.divisionId ?? activeDivisionId ?? null,
      roles,
      true,
    );

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

    await this.auditService.log(tenantId, actorId, 'user.create', 'user', saved.id, {
      email: dto.email,
      divisionId,
    }, auditContext);

    return this.findOne(tenantId, saved.id);
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateUserDto,
    auditContext?: AuditContext,
  ) {
    const user = await this.usersRepo.findOne({
      where: { id, tenantId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException('User not found');

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
      user.roles = roles;
    }

    if (dto.divisionId !== undefined) {
      user.divisionId = await this.resolveDivisionId(
        tenantId,
        dto.divisionId,
        user.roles,
        false,
      );
    }

    await this.usersRepo.save(user);
    if (dto.divisionId !== undefined) {
      await this.syncDivisionAssignment(user.id, user.divisionId);
    }

    await this.auditService.log(tenantId, actorId, 'user.update', 'user', id, {
      changes: Object.keys(dto),
    }, auditContext);

    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string, auditContext?: AuditContext) {
    const user = await this.usersRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.id === actorId) throw new BadRequestException('Cannot delete your own account');

    user.status = 'inactive';
    await this.usersRepo.save(user);

    await this.auditService.log(tenantId, actorId, 'user.deactivate', 'user', id, undefined, auditContext);
    return { success: true };
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
