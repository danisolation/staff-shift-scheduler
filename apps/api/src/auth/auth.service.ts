import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterInput, LoginInput, AuthResponse } from '@scheduler/contracts';
import * as bcrypt from 'bcryptjs';

/**
 * Authentication service: register and login.
 *
 * Passwords are hashed with bcrypt (10 salt rounds — the industry default).
 * The JWT payload carries `{ sub, email, name }` where `sub` is the user's
 * UUID. Tokens expire in 24 hours — long enough for a session, short enough
 * to limit exposure if a token leaks.
 *
 * Why bcrypt and not argon2?
 * — bcrypt is the battle-tested default; argon2 is newer and stronger but
 *   has native-binary install issues on some platforms. For a learning
 *   project, bcrypt's security is more than sufficient and its npm package
 *   is pure JS (no native builds).
 */
@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly TOKEN_EXPIRY = '24h';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user.
   * - Hashes the password with bcrypt.
   * - Inserts the user row.
   * - Returns a JWT and the user's public fields.
   * - Throws 409 Conflict if the email is already taken.
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check for existing user first — gives a friendlier error than letting
    // the database unique constraint throw a raw Prisma error.
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException(`A user with email "${input.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
    });

    return this.buildAuthResponse(user);
  }

  /**
   * Login an existing user.
   * - Finds the user by email.
   * - Verifies the password against the stored hash.
   * - Returns a JWT and the user's public fields.
   * - Throws 401 Unauthorized on bad email or password.
   *
   * The error message is deliberately vague ("invalid credentials") so an
   * attacker can't enumerate which emails are registered.
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  /** Build the JWT and the response envelope. */
  private buildAuthResponse(user: { id: string; email: string; name: string }): AuthResponse {
    const payload = { sub: user.id, email: user.email, name: user.name };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.TOKEN_EXPIRY,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
