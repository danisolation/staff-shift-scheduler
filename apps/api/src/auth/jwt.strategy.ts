import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env.schema';

/**
 * The JWT strategy: Passport calls this for every request that carries a
 * Bearer token. It extracts the token from the Authorization header, verifies
 * it with our secret, and attaches the payload to `request.user`.
 *
 * The payload shape (set by AuthService.login) is `{ sub, email, name }`.
 * `sub` is the user's UUID — the standard JWT claim for the subject.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', { infer: true }),
    });
  }

  /**
   * Passport calls this after verifying the token's signature and expiration.
   * Whatever we return becomes `request.user`.
   */
  validate(payload: { sub: string; email: string; name: string }) {
    return { id: payload.sub, email: payload.email, name: payload.name };
  }
}
