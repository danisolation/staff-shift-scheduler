/**
 * Shared API contracts between apps/web and apps/api.
 * Every DTO that crosses the HTTP boundary is defined here once,
 * and both sides import the same zod schema — the single source of truth.
 *
 * Naming convention:
 *   xSchema          — the full entity as stored/served
 *   xCreateSchema    — the body of POST /x
 *   xUpdateSchema    — the body of PATCH /x (every field optional, at least one required)
 *   xListSchema      — the body of GET /x
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

/** A UUID path parameter, e.g. /skills/:id. */
export const uuidParamSchema = z.string().uuid();

/**
 * A window of time an employee can work, on one day of the week.
 * Time is minutes since Monday 00:00 (see AGENTS.md domain rules).
 */
export const availabilityWindowSchema = z
  .object({
    day: z.number().int().min(0).max(6), // 0 = Monday .. 6 = Sunday
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((window) => window.endMinute > window.startMinute, {
    message: 'endMinute must be greater than startMinute',
  });
export type AvailabilityWindow = z.infer<typeof availabilityWindowSchema>;

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/** A skill an employee can have (e.g. "barista", "cashier"). */
export const skillSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});
export type Skill = z.infer<typeof skillSchema>;

export const skillCreateSchema = skillSchema.pick({ name: true });
export type SkillCreateInput = z.infer<typeof skillCreateSchema>;

export const skillUpdateSchema = skillCreateSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'at least one field must be provided',
  });
export type SkillUpdateInput = z.infer<typeof skillUpdateSchema>;

export const skillListSchema = z.array(skillSchema);
export type SkillList = z.infer<typeof skillListSchema>;

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

/**
 * An employee. `skillIds` reference skills that must exist, and
 * `contractMaxMinutes` caps weekly assigned hours — both become hard
 * constraints in the solver (Milestone 3).
 */
export const employeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  skillIds: z.array(z.string().uuid()),
  availability: z.array(availabilityWindowSchema),
  contractMaxMinutes: z.number().int().min(1),
});
export type Employee = z.infer<typeof employeeSchema>;

export const employeeCreateSchema = employeeSchema.omit({ id: true });
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

export const employeeUpdateSchema = employeeCreateSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'at least one field must be provided',
  });
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

export const employeeListSchema = z.array(employeeSchema);
export type EmployeeList = z.infer<typeof employeeListSchema>;

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

/**
 * A shift that must be covered. `headcount` employees with the required
 * skills must be assigned to it. Time is minutes since Monday 00:00.
 *
 * The base object is separate from the refined `shiftSchema` because zod's
 * `.refine()` wraps the schema in a type that no longer exposes `.omit()`
 * — and the create/update schemas need `.omit()`/`.partial()`.
 */
const shiftBaseSchema = z.object({
  id: z.string().uuid(),
  day: z.number().int().min(0).max(6), // 0 = Monday .. 6 = Sunday
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  requiredSkillIds: z.array(z.string().uuid()).min(1),
  headcount: z.number().int().min(1),
});

export const shiftSchema = shiftBaseSchema.refine(
  (shift) => shift.endMinute > shift.startMinute,
  { message: 'endMinute must be greater than startMinute' },
);
export type Shift = z.infer<typeof shiftSchema>;

// Cross-field rules must live on the create schema too — a create is the
// first place bad data can enter, and boundary validation is the only
// layer that can stop it before it reaches storage.
export const shiftCreateSchema = shiftBaseSchema
  .omit({ id: true })
  .refine((shift) => shift.endMinute > shift.startMinute, {
    message: 'endMinute must be greater than startMinute',
  });
export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;

// On update, the cross-field rule applies only when both fields are present.
export const shiftUpdateSchema = shiftBaseSchema
  .omit({ id: true })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'at least one field must be provided',
  })
  .refine(
    (patch) =>
      patch.startMinute === undefined ||
      patch.endMinute === undefined ||
      patch.endMinute > patch.startMinute,
    { message: 'endMinute must be greater than startMinute' },
  );
export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;

export const shiftListSchema = z.array(shiftSchema);
export type ShiftList = z.infer<typeof shiftListSchema>;

// ---------------------------------------------------------------------------
// Solve jobs (used from Milestone 4; defined here so the contract is stable)
// ---------------------------------------------------------------------------

/** One assignment from a finished solve: employee e covers shift s. */
export const solveAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
});
export type SolveAssignment = z.infer<typeof solveAssignmentSchema>;

/**
 * The result of a finished solve, as produced by the optimizer and stored
 * on the job row. A discriminated union: `optimal`/`feasible` carry the
 * schedule (and the objective value — assigned minutes plus the fairness
 * penalty), `infeasible` carries the human-readable conflict explanations.
 */
export const solveResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('optimal'),
    objectiveValue: z.number(),
    assignments: z.array(solveAssignmentSchema),
  }),
  z.object({
    status: z.literal('feasible'),
    objectiveValue: z.number(),
    assignments: z.array(solveAssignmentSchema),
  }),
  z.object({
    status: z.literal('infeasible'),
    // At least one conflict: an infeasibility claim without an explanation
    // is not accepted across the boundary.
    conflicts: z.array(z.string()).min(1),
  }),
]);
export type SolveResult = z.infer<typeof solveResultSchema>;

/**
 * The body of POST /api/solves: the employees and shifts to schedule.
 * Full employee/shift entities are reused from the CRUD contracts; the
 * optimizer picks the decision-relevant fields. The api verifies that every
 * referenced skill id exists before accepting the job.
 */
export const solveRequestSchema = z.object({
  employees: z.array(employeeSchema),
  shifts: z.array(shiftSchema),
});
export type SolveRequest = z.infer<typeof solveRequestSchema>;

/** A schedule solve job as returned by the api (async job pattern). */
export const solveJobSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['queued', 'running', 'optimal', 'feasible', 'infeasible', 'failed']),
  message: z.string().optional(),
  /** The finished solve's result — present once status is terminal. */
  result: solveResultSchema.optional(),
});
export type SolveJob = z.infer<typeof solveJobSchema>;

// ---------------------------------------------------------------------------
// Auth (Milestone 6)
// ---------------------------------------------------------------------------

/** Body of POST /api/auth/register. */
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
  name: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Body of POST /api/auth/login. */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Response from register/login: the JWT access token. */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
