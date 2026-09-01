import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';

const testEnvSchema = z.object({
  TEST_DATABASE_URL: z.string().url(),
});

/**
 * The connection string for the integration-test database — the "test-db"
 * service from docker-compose.yml, a separate container from the dev
 * database so tests can never touch dev data.
 *
 * Jest loads apps/api/.env via test/load-env.ts, which is where the value
 * comes from. Failing loudly with instructions beats a cryptic connection
 * error deep inside Prisma.
 */
export function getTestDatabaseUrl(): string {
  const result = testEnvSchema.safeParse({
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  });
  if (!result.success) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env ' +
        'and start the test database: docker compose up -d test-db',
    );
  }
  return result.data.TEST_DATABASE_URL;
}

/**
 * Deletes every row from every table. Postgres TRUNCATE with CASCADE also
 * clears the join tables whose rows reference the truncated ones, and
 * RESTART IDENTITY resets any counters (defensive — our ids are UUIDs, so
 * none exist today). Called between tests so each test starts from an
 * empty, known state.
 *
 * Because every integration test file shares this one database, Jest is
 * configured with maxWorkers: 1 (jest.config.json) — parallel test files
 * would truncate each other's rows mid-test.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Skill", "Employee", "AvailabilityWindow", "EmployeeSkill", ' +
      '"Shift", "ShiftSkill", "SolveJob" RESTART IDENTITY CASCADE',
  );
}
