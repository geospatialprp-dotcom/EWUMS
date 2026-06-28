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
  ) {}

  async findAll(tenantId: string) {
    const users = await this.usersRepo.find({
      where: { tenantId },
      relations: ['roles'],
      order: { createdAt: 'DESC' },
    });
    return users.map((u) => this.toResponse(u));
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.usersRepo.findOne({
      where: { id, tenantId },
      relations: ['roles'],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponse(user);
  }

  async create(tenantId: string, actorId: string, dto: CreateUserDto) {
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

    await this.auditService.log(tenantId, actorId, 'user.create', 'user', saved.id, {
      email: dto.email,
    });

    return this.findOne(tenantId, saved.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateUserDto) {
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

    await this.auditService.log(tenantId, actorId, 'user.update', 'user', id, {
      changes: Object.keys(dto),
    });

    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const user = await this.usersRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.id === actorId) throw new BadRequestException('Cannot delete your own account');

    user.status = 'inactive';
    await this.usersRepo.save(user);

    await this.auditService.log(tenantId, actorId, 'user.deactivate', 'user', id);
    return { success: true };
  }

  private toResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      status: user.status,
      roles: user.roles?.map((r) => ({ id: r.id, code: r.code, name: r.name })) ?? [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
