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
import { DivisionAccessService } from '../divisions/division-access.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../auth/entities/role.entity';
import { User } from '../auth/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    private auditService: AuditService,
    private divisionAccess: DivisionAccessService,
  ) {}

  async findAll(user: JwtPayload) {
    const tenantId = user.tenantId;
    const qb = this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'roles')
      .where('u.tenant_id = :tenantId', { tenantId })
      .orderBy('u.created_at', 'DESC');

    await this.divisionAccess.applyUserDivisionMembershipScope(qb, user, 'u.id', tenantId);

    const users = await qb.getMany();
    const divisionSummaries = await this.divisionAccess.getDivisionSummariesForUserIds(
      users.map((u) => u.id),
    );
    const divisionScope = await this.divisionAccess.getDivisionScopeLabel(user, tenantId);

    return {
      divisionScope,
      users: users.map((u) => this.toResponse(u, divisionSummaries.get(u.id))),
    };
  }

  async findOne(user: JwtPayload, id: string) {
    const tenantId = user.tenantId;
    await this.divisionAccess.assertUserDivisionAccess(user, id, tenantId);
    const found = await this.usersRepo.findOne({
      where: { id, tenantId },
      relations: ['roles'],
    });
    if (!found) throw new NotFoundException('User not found');
    const summaries = await this.divisionAccess.getDivisionSummariesForUserIds([found.id]);
    return this.toResponse(found, summaries.get(found.id));
  }

  async create(tenantId: string, actor: JwtPayload, dto: CreateUserDto, auditContext?: AuditContext) {
    const existing = await this.usersRepo.findOne({
      where: { tenantId, email: dto.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const roles = await this.rolesRepo.findBy({ id: In(dto.roleIds), tenantId });
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('One or more roles not found');
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
      roles,
    });
    const saved = await this.usersRepo.save(user);
    const divisionId = await this.divisionAccess.resolveDivisionIdForUserCreate(actor);
    await this.divisionAccess.assignUserToDivision(saved.id, divisionId);

    await this.auditService.log(tenantId, actor.sub, 'user.create', 'user', saved.id, {
      email: dto.email,
    }, auditContext);

    return this.findOne(actor, saved.id);
  }

  async update(
    tenantId: string,
    actor: JwtPayload,
    id: string,
    dto: UpdateUserDto,
    auditContext?: AuditContext,
  ) {
    await this.divisionAccess.assertUserDivisionAccess(actor, id, tenantId);
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

    await this.usersRepo.save(user);

    await this.auditService.log(tenantId, actor.sub, 'user.update', 'user', id, {
      changes: Object.keys(dto),
    }, auditContext);

    return this.findOne(actor, id);
  }

  async remove(tenantId: string, actor: JwtPayload, id: string, auditContext?: AuditContext) {
    await this.divisionAccess.assertUserDivisionAccess(actor, id, tenantId);
    const user = await this.usersRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.id === actor.sub) throw new BadRequestException('Cannot delete your own account');

    user.status = 'inactive';
    await this.usersRepo.save(user);

    await this.auditService.log(tenantId, actor.sub, 'user.deactivate', 'user', id, undefined, auditContext);
    return { success: true };
  }

  private toResponse(
    user: User,
    division?: { divisionId: string | null; divisionName: string | null; divisionCode: string | null },
  ) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      status: user.status,
      roles: user.roles?.map((r) => ({ id: r.id, code: r.code, name: r.name })) ?? [],
      divisionId: division?.divisionId ?? null,
      divisionName: division?.divisionName ?? null,
      divisionCode: division?.divisionCode ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
