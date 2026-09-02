import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiCreatedResponse, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiConflictResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import {
  registerSchema,
  loginSchema,
  authResponseSchema,
  type AuthResponse,
} from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { zodToOpenAPISchema } from '../common/openapi/zod-to-openapi';

/**
 * Authentication endpoints.
 *
 * Both routes are @Public() — they exist precisely to issue tokens.
 * The global JwtAuthGuard skips these; every other write endpoint
 * in the api requires a valid Bearer token.
 */
const registerBody = zodToOpenAPISchema(registerSchema);
const loginBody = zodToOpenAPISchema(loginSchema);
const authResponse = zodToOpenAPISchema(authResponseSchema);

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account.
   * Returns a JWT immediately — no separate login step needed.
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ schema: registerBody })
  @ApiCreatedResponse({ description: 'User registered', schema: authResponse })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiConflictResponse({ description: 'Email already registered' })
  async register(@Body() body: unknown): Promise<AuthResponse> {
    const input = validateWithZod(registerSchema, body);
    return this.authService.register(input);
  }

  /**
   * Login with email and password.
   * Returns a JWT on success, 401 on bad credentials.
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ schema: loginBody })
  @ApiCreatedResponse({ description: 'Login successful', schema: authResponse })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Body() body: unknown): Promise<AuthResponse> {
    const input = validateWithZod(loginSchema, body);
    return this.authService.login(input);
  }
}
