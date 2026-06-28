import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { InjectRepository } from '@nestjs/typeorm';

import * as bcrypt from 'bcrypt';

import { Repository } from 'typeorm';

import { DivisionAccessService } from '../divisions/division-access.service';

import { LoginDto } from './dto/login.dto';

import { Permission } from './entities/permission.entity';

import { User } from './entities/user.entity';

import { JwtPayload } from './interfaces/jwt-payload.interface';



@Injectable()

export class AuthService {

  constructor(

    @InjectRepository(User) private usersRepo: Repository<User>,

    private jwtService: JwtService,

    private divisionAccess: DivisionAccessService,

  ) {}



  async login(dto: LoginDto) {

    const email = dto.email.trim().toLowerCase();

    const user = await this.findUserByEmail(email);

    if (!user) {

      throw new UnauthorizedException('Invalid credentials');

    }



    const valid = await this.verifyPassword(dto.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.assertLoginDivisionPolicy(user);



    const roles = user.roles.map((r) => r.code);

    const permissions = [

      ...new Set(

        user.roles.flatMap((r) =>

          (r.permissions ?? []).map((p: Permission) => `${p.resource}:${p.action}`),

        ),

      ),

    ];



    const divisionMeta = await this.divisionAccess.enrichJwtAccess(user.id, roles, permissions);

    const canViewAllDivisions = divisionMeta.canViewAllDivisions;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles,
      permissions,
      divisionId: divisionMeta.divisionId,
      divisionCode: divisionMeta.divisionCode,
      divisionName: divisionMeta.divisionName,
      circleId: divisionMeta.circleId,
      circleCode: divisionMeta.circleCode,
      circleName: divisionMeta.circleName,
      accessScope: divisionMeta.accessScope,
      canViewAllDivisions,
    };



    return {

      accessToken: this.jwtService.sign(payload),

      user: {

        id: user.id,

        email: user.email,

        firstName: user.firstName,

        lastName: user.lastName,

        tenantId: user.tenantId,

        department: user.department,

        divisionId: divisionMeta.divisionId,
        divisionCode: divisionMeta.divisionCode,
        divisionName: divisionMeta.divisionName,
        circleId: divisionMeta.circleId,
        circleCode: divisionMeta.circleCode,
        circleName: divisionMeta.circleName,
        accessScope: divisionMeta.accessScope,
        canViewAllDivisions,

        roles,

        permissions,

      },

    };

  }



  async getProfile(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['roles', 'roles.permissions'],
    });
    if (!user) throw new UnauthorizedException();

    const roles = user.roles.map((r) => r.code);
    const permissions = [
      ...new Set(
        user.roles.flatMap((r) =>
          (r.permissions ?? []).map((p: Permission) => `${p.resource}:${p.action}`),
        ),
      ),
    ];
    const divisionMeta = await this.divisionAccess.enrichJwtAccess(user.id, roles, permissions);
    const canViewAllDivisions = divisionMeta.canViewAllDivisions;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      tenantId: user.tenantId,
      divisionId: divisionMeta.divisionId,
      divisionCode: divisionMeta.divisionCode,
      divisionName: divisionMeta.divisionName,
      circleId: divisionMeta.circleId,
      circleCode: divisionMeta.circleCode,
      circleName: divisionMeta.circleName,
      accessScope: divisionMeta.accessScope,
      canViewAllDivisions,
      roles,
      permissions,
    };
  }

  async requestPasswordReset(email: string) {

    const normalized = email.trim().toLowerCase();

    await this.usersRepo.findOne({ where: { email: normalized } });



    return {

      message:

        'If an account exists for this email, your administrator will receive the reset request and contact you with new credentials.',

    };

  }



  private async assertLoginDivisionPolicy(user: User): Promise<void> {
    const roles = user.roles.map((r) => r.code);
    const isSuperAdmin = roles.includes('super_admin');
    if (!isSuperAdmin) return;

    if (!(await this.divisionAccess.isDivisionSchemaReady())) return;

    const meta = await this.divisionAccess.enrichJwtDivision(user.id);
    if (!meta.divisionId) return;

    if (!meta.canViewAllDivisions) {
      throw new ForbiddenException(
        'Super Admin login is not permitted for field division accounts. Use your division login only.',
      );
    }
  }

  private async findUserByEmail(email: string) {

    return this.usersRepo.findOne({

      where: { email, status: 'active' },

      relations: ['roles', 'roles.permissions'],

    });

  }



  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {

    try {

      const rows = await this.usersRepo.query(

        `SELECT crypt($1, $2) = $2 AS valid`,

        [password, storedHash],

      );

      if (rows[0]?.valid === true) return true;

    } catch {

      // Fall through to bcrypt when pgcrypto is unavailable

    }



    const hash = storedHash.startsWith('$2a$')

      ? storedHash.replace('$2a$', '$2b$')

      : storedHash;



    try {

      return await bcrypt.compare(password, hash);

    } catch {

      return false;

    }

  }

}


