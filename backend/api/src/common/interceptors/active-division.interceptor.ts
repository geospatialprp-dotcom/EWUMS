import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

/** Applies X-Active-Division-Id from HQ / super-admin UI to the request user payload. */
@Injectable()
export class ActiveDivisionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (user) {
      const raw = request.headers['x-active-division-id'];
      const header = typeof raw === 'string' ? raw.trim() : '';
      if (header) {
        user.activeDivisionId = header;
      }
    }
    return next.handle();
  }
}
