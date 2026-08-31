/**
 * Shared API contracts between apps/web and apps/api.
 * Every DTO that crosses the HTTP boundary is defined here once,
 * and both sides import the same zod schema — the single source of truth.
 */
import { z } from 'zod';

/** The consistent error envelope returned by the api's global exception filter. */
export const errorResponseSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** API health check response. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** A skill an employee can have (e.g. "barista", "cashier"). */
export const skillSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});
export type Skill = z.infer<typeof skillSchema>;

/**
 * A shift that must be covered.
 * Time is minutes since Monday 00:00 (see AGENTS.md domain rules).
 */
export const shiftSchema = z.object({
  id: z.string().uuid(),
  day: z.number().int().min(0).max(6), // 0 = Monday .. 6 = Sunday
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  requiredSkills: z.array(z.string()).min(1),
  headcount: z.number().int().min(1),
});
export type Shift = z.infer<typeof shiftSchema>;

/** A schedule solve job as returned by the api (async job pattern). */
export const solveJobSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['queued', 'running', 'optimal', 'feasible', 'infeasible', 'failed']),
  message: z.string().optional(),
});
export type SolveJob = z.infer<typeof solveJobSchema>;
