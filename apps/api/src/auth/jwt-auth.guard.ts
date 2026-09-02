import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Global JWT guard. Applied to every route via APP_GUARD in AuthModule.
 *
 * Routes decorated with @Public() skip authentication — the guard checks
 * the reflector metadata first and returns true (allow) immediately.
 * All other routes require a valid Bearer token.
 *
 * Why a global guard instead of per-controller @UseGuards()?
 * — Security defaults to "locked". New endpoints are protected by default;
 *   you must explicitly opt out with @Public(). This prevents the common
 *   mistake of forgetting to add auth to a new write endpoint.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if the route is marked as public.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    // Otherwise, run the normal JWT validation.
    return super.canActivate(context);
  }
}
