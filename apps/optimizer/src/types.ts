/**
 * Solver outcome types — the contract every model in this service returns.
 *
 * A mixed-integer solver can end in one of three states:
 *  - optimal:    the mathematically best schedule was found and proven best
 *  - feasible:   a valid schedule was found, but optimality was not proven
 *                (the solver hit a time limit)
 *  - infeasible: no schedule satisfies every constraint — the input rules
 *                contradict each other, and we must explain which ones
 */
export type SolveOutcome =
  | { status: 'optimal'; objectiveValue: number }
  | { status: 'feasible'; objectiveValue: number }
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
