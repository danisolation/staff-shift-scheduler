/**
 * Types for the optimizer service — the inputs, outputs, and configuration
 * every model here speaks.
 *
 * A mixed-integer solver can end in one of three states:
 *  - optimal:    the mathematically best schedule was found and proven best
 *  - feasible:   a valid schedule was found, but optimality was not proven
 *                (the solver hit a time limit)
 *  - infeasible: no schedule satisfies every constraint — the input rules
 *                contradict each other, and we must explain which ones
 *
 * Time follows the repo-wide domain rule: minutes-since-week-start
 * (day 0–6 with 0 = Monday, minute-of-day 0–1439). Display formatting
 * happens only in the frontend.
 */

/** One availability window: "on `day`, from `startMinute` to `endMinute`". */
export interface AvailabilityWindow {
  day: number;
  startMinute: number;
  endMinute: number;
}

/** An employee as the scheduler sees them — no names, only decision data. */
export interface ScheduleProblemEmployee {
  id: string;
  /** Ids of skills the employee holds. */
  skillIds: string[];
  /** Windows when the employee can work; a shift must fit inside one. */
  availability: AvailabilityWindow[];
  /** Hard weekly cap on assigned minutes. */
  contractMaxMinutes: number;
}

/** A shift to be staffed. */
export interface ScheduleProblemShift {
  id: string;
  day: number;
  startMinute: number;
  endMinute: number;
  /** Every required skill must be held by any employee covering this shift. */
  requiredSkillIds: string[];
  /** Exactly this many employees must cover the shift. */
  headcount: number;
}

/** The complete input to one solve. */
export interface ScheduleProblem {
  employees: ScheduleProblemEmployee[];
  shifts: ScheduleProblemShift[];
}

/** One decision from a successful solve: employee e covers shift s. */
export interface Assignment {
  employeeId: string;
  shiftId: string;
}

export type SolveOutcome =
  | { status: 'optimal'; objectiveValue: number; assignments: Assignment[] }
  | { status: 'feasible'; objectiveValue: number; assignments: Assignment[] }
  | { status: 'infeasible'; conflicts: string[] };

/**
 * Solver configuration. No magic numbers in model code — every limit and
 * weight is declared here with a plain-language reason.
 */
export interface SolverConfig {
  /** Wall-clock time limit for a single solve, in milliseconds. */
  timeLimitMs: number;
  /** Stop when the incumbent is within this relative gap of the optimum. */
  mipGap: number;
  /** Weight of the fairness objective relative to cost. Higher = fairer. */
  fairnessWeight: number;
}

/** The configuration used when a caller does not pass one. */
export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  // A schedule for a week of shifts solves in well under a second at the
  // sizes this product targets; 10s leaves headroom without hanging anyone.
  timeLimitMs: 10_000,
  // 1% relative gap: visually indistinguishable from optimal for schedules,
  // and comfortably above the solver's own numerical tolerances.
  mipGap: 0.01,
  // Fair and cost are both in "minutes" scale by construction (the fairness
  // variable counts weekend shifts, the cost counts minutes), so a weight
  // of 1 treats one avoided extra weekend shift like ~1 minute of cost.
  // The knob exists to tune that trade-off, not to be clever here.
  fairnessWeight: 1,
};
