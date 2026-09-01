import { z } from 'zod';

/**
 * Every environment variable the api needs, validated once at boot.
 *
 * Environment variables are always strings (or undefined) — this schema is
 * the single place that turns them into typed, checked values. A missing or
 * malformed variable fails startup with an actionable message instead of a
 * mysterious runtime error later (for example, deep inside a Prisma query).
 *
 * The values themselves come from apps/api/.env (see .env.example); the
 * database connection strings point at the containers defined in
 * docker-compose.yml.
 */
export const envSchema = z.object({
  /** PostgreSQL connection string for the api's database. */
  DATABASE_URL: z.string().url(),
  /** Base URL of the optimizer service (POST {base}/solve). */
  OPTIMIZER_BASE_URL: z.string().url(),
  /** HTTP port the api listens on. */
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Adapter for ConfigModule.forRoot({ validate }): NestJS hands us the raw
 * environment as a plain object and expects either a valid object back or a
 * thrown error. We parse with the schema and turn a failure into one
 * readable message listing every problem.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment variables — ${problems}`);
  }
  return result.data;
}
