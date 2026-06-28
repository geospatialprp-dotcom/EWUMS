import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DivisionAccessService } from '../../modules/divisions/division-access.service';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/** Ensures the current user may access the :projectId route parameter. */
@Injectable()
export class ProjectDivisionGuard implements CanActivate {
  constructor(private divisionAccess: DivisionAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const projectId = request.params?.projectId ?? request.params?.id;
    if (user?.tenantId && projectId) {
      await this.divisionAccess.assertProjectAccess(user, projectId, user.tenantId);
    }
    return true;
  }
}
