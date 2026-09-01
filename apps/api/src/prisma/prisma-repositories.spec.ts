import { Test } from '@nestjs/testing';
import { SkillInUseError } from '../skills/skill.repository';
import { getTestDatabaseUrl, resetDatabase } from '../test/test-db';
import { PrismaEmployeeRepository } from './prisma-employee.repository';
import { PrismaShiftRepository } from './prisma-shift.repository';
import { PrismaSkillRepository } from './prisma-skill.repository';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

/**
 * Integration tests: the real Prisma repositories against the real test
 * database (the "test-db" container from docker-compose.yml — never the dev
 * database). They run as part of the normal `pnpm test`, which is why the
 * database must be up for the suite (see docs/DATABASE.md).
 *
 * What these tests cover that unit tests cannot:
 * - actual SQL round-trips through the repository contract methods;
 * - the database's own guarantees: foreign keys reject unknown references,
 *   referenced skills refuse to be deleted (P2003 → SkillInUseError),
 *   join/child rows are cleaned up automatically (ON DELETE CASCADE).
 */
describe('Prisma repositories (integration)', () => {
  let prisma: PrismaService;
  let skills: PrismaSkillRepository;
  let employees: PrismaEmployeeRepository;
  let shifts: PrismaShiftRepository;

  beforeAll(async () => {
    // A dedicated client pointed at the test database. Overriding the
    // PrismaModule's provider with it keeps the repository classes
    // completely unaware of which database they talk to.
    prisma = new PrismaService({ datasourceUrl: getTestDatabaseUrl() });
    await connectWithRetry(prisma);

    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PrismaSkillRepository, PrismaEmployeeRepository, PrismaShiftRepository],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    skills = moduleRef.get(PrismaSkillRepository);
    employees = moduleRef.get(PrismaEmployeeRepository);
    shifts = moduleRef.get(PrismaShiftRepository);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    // Guarded: if beforeAll failed (database down, URL missing), prisma was
    // never assigned and teardown must not crash on top of the real error.
    await prisma?.$disconnect();
  });

  describe('skills', () => {
    it('round-trips a skill through create, read, update, delete', async () => {
      const created = await skills.create({ name: 'Barista' });

      expect(created.name).toBe('Barista');
      await expect(skills.findById(created.id)).resolves.toEqual(created);
      await expect(skills.findAll()).resolves.toEqual([created]);
      await expect(skills.existsByName('barista')).resolves.toBe(true);
      await expect(skills.existsByName('Barista')).resolves.toBe(true);
      await expect(skills.existsByName('Cashier')).resolves.toBe(false);

      const updated = await skills.update(created.id, { name: 'Head Barista' });
      expect(updated).toEqual({ id: created.id, name: 'Head Barista' });

      await expect(skills.delete(created.id)).resolves.toBe(true);
      await expect(skills.findById(created.id)).resolves.toBeNull();
      await expect(skills.delete(created.id)).resolves.toBe(false);
    });

    it('returns null when updating a missing skill', async () => {
      await expect(
        skills.update('00000000-0000-0000-0000-000000000000', { name: 'Host' }),
      ).resolves.toBeNull();
    });

    it('refuses to delete a skill that an employee references', async () => {
      const skill = await skills.create({ name: 'Barista' });
      const employee = await employees.create({
        name: 'Ada',
        skillIds: [skill.id],
        availability: [],
        contractMaxMinutes: 2400,
      });

      // The foreign key (ON DELETE RESTRICT) makes the database itself
      // refuse; the repository translates that into the typed error.
      await expect(skills.delete(skill.id)).rejects.toBeInstanceOf(SkillInUseError);

      // Once the referencing employee is gone, the delete succeeds —
      // proving the error came from the live reference, not the delete path.
      await employees.delete(employee.id);
      await expect(skills.delete(skill.id)).resolves.toBe(true);
    });
  });

  describe('employees', () => {
    it('round-trips an employee with skills and availability windows', async () => {
      const barista = await skills.create({ name: 'Barista' });
      const cashier = await skills.create({ name: 'Cashier' });

      const created = await employees.create({
        name: 'Ada',
        skillIds: [barista.id, cashier.id],
        availability: [
          { day: 0, startMinute: 480, endMinute: 720 },
          { day: 4, startMinute: 600, endMinute: 780 },
        ],
        contractMaxMinutes: 2400,
      });

      // skillIds come back sorted by id (the repository's documented,
      // deterministic order for relation rows) — hence .sort().
      expect(created).toEqual({
        id: created.id,
        name: 'Ada',
        skillIds: [barista.id, cashier.id].sort(),
        availability: [
          { day: 0, startMinute: 480, endMinute: 720 },
          { day: 4, startMinute: 600, endMinute: 780 },
        ],
        contractMaxMinutes: 2400,
      });
      await expect(employees.findById(created.id)).resolves.toEqual(created);
    });

    it('replaces skills and availability on update, keeps them on a name-only patch', async () => {
      const barista = await skills.create({ name: 'Barista' });
      const cashier = await skills.create({ name: 'Cashier' });
      const created = await employees.create({
        name: 'Ada',
        skillIds: [barista.id],
        availability: [{ day: 0, startMinute: 480, endMinute: 720 }],
        contractMaxMinutes: 2400,
      });

      const renamed = await employees.update(created.id, { name: 'Grace' });
      expect(renamed).toEqual({
        id: created.id,
        name: 'Grace',
        skillIds: [barista.id],
        availability: [{ day: 0, startMinute: 480, endMinute: 720 }],
        contractMaxMinutes: 2400,
      });

      const replaced = await employees.update(created.id, {
        skillIds: [cashier.id],
        availability: [{ day: 2, startMinute: 540, endMinute: 900 }],
      });
      expect(replaced).toEqual({
        id: created.id,
        name: 'Grace',
        skillIds: [cashier.id],
        availability: [{ day: 2, startMinute: 540, endMinute: 900 }],
        contractMaxMinutes: 2400,
      });
    });

    it('deletes the employee and its join and window rows (cascade)', async () => {
      const barista = await skills.create({ name: 'Barista' });
      const created = await employees.create({
        name: 'Ada',
        skillIds: [barista.id],
        availability: [{ day: 0, startMinute: 480, endMinute: 720 }],
        contractMaxMinutes: 2400,
      });

      await expect(employees.delete(created.id)).resolves.toBe(true);
      await expect(employees.findById(created.id)).resolves.toBeNull();

      const joinRows = await prisma.employeeSkill.count({ where: { employeeId: created.id } });
      const windows = await prisma.availabilityWindow.count({
        where: { employeeId: created.id },
      });
      expect(joinRows).toBe(0);
      expect(windows).toBe(0);
    });

    it('rejects an unknown skill id — the database is the backstop', async () => {
      // The service pre-checks references for a friendly 400. This test
      // bypasses the service on purpose: even if a future code path forgot
      // the check, the foreign key still refuses the write.
      await expect(
        employees.create({
          name: 'Ada',
          skillIds: ['00000000-0000-0000-0000-000000000000'],
          availability: [],
          contractMaxMinutes: 2400,
        }),
      ).rejects.toThrow();
    });

    it('returns null when updating a missing employee', async () => {
      await expect(
        employees.update('00000000-0000-0000-0000-000000000000', { name: 'Grace' }),
      ).resolves.toBeNull();
    });
  });

  describe('shifts', () => {
    it('round-trips a shift with required skills', async () => {
      const barista = await skills.create({ name: 'Barista' });

      const created = await shifts.create({
        day: 2,
        startMinute: 540,
        endMinute: 1020,
        requiredSkillIds: [barista.id],
        headcount: 3,
      });

      expect(created).toEqual({
        id: created.id,
        day: 2,
        startMinute: 540,
        endMinute: 1020,
        requiredSkillIds: [barista.id],
        headcount: 3,
      });
      await expect(shifts.findById(created.id)).resolves.toEqual(created);
      await expect(shifts.findAll()).resolves.toEqual([created]);

      const updated = await shifts.update(created.id, { headcount: 2 });
      expect(updated).toEqual({
        id: created.id,
        day: 2,
        startMinute: 540,
        endMinute: 1020,
        requiredSkillIds: [barista.id],
        headcount: 2,
      });
    });

    it('replaces required skills on update', async () => {
      const barista = await skills.create({ name: 'Barista' });
      const cashier = await skills.create({ name: 'Cashier' });
      const created = await shifts.create({
        day: 2,
        startMinute: 540,
        endMinute: 1020,
        requiredSkillIds: [barista.id],
        headcount: 1,
      });

      const updated = await shifts.update(created.id, { requiredSkillIds: [cashier.id] });
      expect(updated).toEqual({
        id: created.id,
        day: 2,
        startMinute: 540,
        endMinute: 1020,
        requiredSkillIds: [cashier.id],
        headcount: 1,
      });
    });

    it('returns false when deleting a missing shift', async () => {
      await expect(shifts.delete('00000000-0000-0000-0000-000000000000')).resolves.toBe(false);
    });
  });
});

/**
 * Postgres accepts connections a few seconds after `docker compose up -d`
 * (the container is up before the server is ready). Retry for a bounded
 * window so a just-started database is not a flaky test failure, and fail
 * with instructions when it never comes up.
 */
async function connectWithRetry(prisma: PrismaService, attempts = 10): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(
          'Cannot reach the integration-test database. Start it with: ' +
            `docker compose up -d test-db\nOriginal error: ${String(error)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
