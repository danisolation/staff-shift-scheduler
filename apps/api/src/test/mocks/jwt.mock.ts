/**
 * Mock for @nestjs/jwt module.
 * The real module uses ESM syntax which Jest can't parse in CommonJS mode.
 * This mock provides the same interface for testing.
 */
export class JwtService {
  sign = jest.fn().mockReturnValue('test-token');
  verify = jest.fn().mockReturnValue({ sub: 'user-1', email: 'test@example.com', name: 'Test User' });
  decode = jest.fn().mockReturnValue({ sub: 'user-1', email: 'test@example.com', name: 'Test User' });
}

export class JwtModule {
  static register = jest.fn().mockReturnValue({
    module: JwtModule,
    providers: [JwtService],
    exports: [JwtService],
  });

  static registerAsync = jest.fn().mockReturnValue({
    module: JwtModule,
    providers: [JwtService],
    exports: [JwtService],
  });
}
