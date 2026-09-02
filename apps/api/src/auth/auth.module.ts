import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import type { Env } from '../config/env.schema';

/**
 * Authentication module.
 *
 * Wires together:
 * - PassportModule (the authentication framework)
 * - JwtModule (token signing/verification, configured from JWT_SECRET env var)
 * - JwtStrategy (extracts and validates Bearer tokens)
 * - JwtAuthGuard (applied globally via APP_GUARD — every route is protected
 *   unless explicitly marked @Public())
 * - AuthService (register/login business logic)
 * - AuthController (POST /api/auth/register, POST /api/auth/login)
 *
 * Why APP_GUARD instead of @UseGuards() on each controller?
 * — "Secure by default". New endpoints are protected automatically.
 *   Forgetting @Public() on a read endpoint is a minor inconvenience;
 *   forgetting @UseGuards() on a write endpoint is a security hole.
 */
@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService<Env, true>) => ({
        secret: configService.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Register JwtAuthGuard as the global guard — every route is protected
    // unless @Public() says otherwise.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
