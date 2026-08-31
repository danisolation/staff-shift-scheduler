import { Test } from '@nestjs/testing';
import { EmployeesModule } from './employees/employees.module';
import { ShiftsModule } from './shifts/shifts.module';
import { SkillsModule } from './skills/skills.module';
import { EmployeesService } from './employees/employees.service';
import { ShiftsService } from './shifts/shifts.service';

/**
 * Module graph test: compiles the real modules with their real imports and
 * asks NestJS to resolve every dependency. Unit tests hand-wire providers,
 * so they cannot catch wiring mistakes — like a provider that exists but is
 * not exported from its module. This test exists precisely for that class
 * of bug (it caught SKILL_REPOSITORY not being exported from SkillsModule).
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
});
