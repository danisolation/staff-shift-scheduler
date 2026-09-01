import { config } from 'dotenv';

/**
 * Jest setup file — runs once before any test module is imported.
 *
 * Jest does not read .env files on its own. Loading apps/api/.env here gives
 * every test the same environment the app itself gets from ConfigModule:
 * DATABASE_URL for the Prisma client and TEST_DATABASE_URL for the
 * integration tests (see test-db.ts).
 */
config({ quiet: true });
