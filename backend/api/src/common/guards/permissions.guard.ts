import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import { AuthService } from '../../modules/auth/auth.service';
import {
  isAdminPermission,
  isDemoOperationalPermission,
  isReadPermission,
  isSuperAdmin,
} from '../utils/operational-access.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    if (isSuperAdmin(user.roles)) {
      if (
        required.every(isAdminPermission)
        || required.every(isReadPermission)
        || required.every(isDemoOperationalPermission)
      ) {
        return true;
      }
      throw new ForbiddenException(
        'Super Admin has view-only access for operational modules. Use an HQ or division account.',
      );
    }

    let permissions = user.permissions ?? [];
    try {
      const authService = this.moduleRef.get(AuthService, { strict: false });
      const profile = await authService.getProfile(user.sub);
      permissions = profile.permissions ?? permissions;
      user.permissions = permissions;
      request.user = user;
    } catch {
      // Fall back to JWT permissions when profile lookup fails.
    }

    const hasPermission = required.some((p) => permissions.includes(p));
    if (!hasPermission) {
      throw new ForbiddenException(`Missing required permission: ${required.join(' or ')}`);
    }
    return true;
  }
}
