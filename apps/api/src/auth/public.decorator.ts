import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for routes that skip JWT authentication.
 * Use the @Public() decorator on a controller method or class to mark it.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or an entire controller) as public — the JwtAuthGuard
 * will skip token validation for these routes.
 *
 * Usage:
 *   @Public()
 *   @Get('health')
 *   getHealth() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
