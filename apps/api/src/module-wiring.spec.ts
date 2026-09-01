import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import { EmployeesModule } from './employees/employees.module';
import { ShiftsModule } from './shifts/shifts.module';
import { SkillsModule } from './skills/skills.module';
import { SolvesModule } from './solves/solves.module';
import { EmployeesService } from './employees/employees.service';
import { ShiftsService } from './shifts/shifts.service';
import { SolvesService } from './solves/solves.service';

/**
 * Module graph test: compiles the real modules with their real imports and
 * asks NestJS to resolve every dependency. Unit tests hand-wire providers,
 * so they cannot catch wiring mistakes — like a provider that exists but is
 * not exported from its module. This test exists precisely for that class
 * of bug (it caught SKILL_REPOSITORY not being exported from SkillsModule).
 *
 * SolvesModule's base-URL factory reads the validated environment, so the
 * ConfigModule here mirrors the AppModule's registration (CI provides the
 * variables; locally Jest loads apps/api/.env).
 */
describe('module wiring', () => {
  it('resolves EmployeesService with all its dependencies through the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SkillsModule, EmployeesModule],
    }).compile();

    const service = moduleRef.get(EmployeesService);
    expect(service).toBeDefined();
  });

  it('resolves ShiftsService with all its dependencies through the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SkillsModule, ShiftsModule],
    }).compile();

    const service = moduleRef.get(ShiftsService);
    expect(service).toBeDefined();
  });

  it('resolves SolvesService with the real optimizer client through the real module graph', async () => {
    const moduleRef = await Test.createTestingModule({
      // isGlobal mirrors AppModule: the base-URL factory injects ConfigService.
      imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), SolvesModule],
    }).compile();

    const service = moduleRef.get(SolvesService);
    expect(service).toBeDefined();
  });
});
