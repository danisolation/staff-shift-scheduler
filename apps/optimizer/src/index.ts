/**
 * Optimizer service entry point — the public surface.
 *
 * `solveSchedule` is everything Milestone 4's HTTP layer needs: a typed
 * schedule problem in, a typed outcome out. The model building, diagnosis,
 * and solver talking all stay behind it.
 */
export { solveSchedule } from './solve-schedule.js';
export { solveModel } from './solver.js';
export { DEFAULT_SOLVER_CONFIG } from './types.js';
export type {
  Assignment,
  AvailabilityWindow,
  ScheduleProblem,
  ScheduleProblemEmployee,
  ScheduleProblemShift,
  SolveOutcome,
  SolverConfig,
} from './types.js';
