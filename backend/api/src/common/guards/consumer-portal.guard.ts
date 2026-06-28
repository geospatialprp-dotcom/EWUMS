import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

@Injectable()
export class ConsumerPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as JwtPayload;
    if (user.portalType !== 'consumer' || !user.consumerId) {
      throw new ForbiddenException('Consumer portal access required');
    }
    return true;
  }
}
