import type { Assignment, ScheduleProblem, SolveOutcome, SolverConfig } from './types.js';
import { DEFAULT_SOLVER_CONFIG } from './types.js';
import { diagnose } from './diagnose.js';
import { buildScheduleModel } from './schedule-model.js';
import { runHighs } from './highs-solver.js';

/**
 * Solves a schedule problem end to end:
 *
 *   1. diagnose     — detectable infeasibilities become readable conflicts
 *                     before we ever touch the solver;
 *   2. empty guard  — a problem with no shifts is trivially optimal;
 *   3. build        — pure model builder produces the LP text;
 *   4. solve        — HiGHS does the search;
 *   5. map          — status → SolveOutcome, primal values → assignments.
 *
 * This is the optimizer's public function; Milestone 4's HTTP layer calls
 * exactly this.
 */

/**
 * Used when HiGHS says infeasible but the diagnoser found nothing: the
 * rules are jointly contradictory in a way simple counting cannot see
 * (typically hour caps interacting across shifts). Honest wording — we do
 * not pretend to know the exact culprit.
 */
const UNDIAGNOSED_CONFLICT =
  'No schedule can satisfy every rule at once. Each shift is individually ' +
  'coverable and total capacity is sufficient, so some combination of the ' +
  'rules (typically contract hour caps across several shifts) contradicts. ' +
  'Try reducing headcount, widening availability, or raising a contract cap.';

export async function solveSchedule(
  problem: ScheduleProblem,
  config: SolverConfig = DEFAULT_SOLVER_CONFIG,
): Promise<SolveOutcome> {
  const conflicts = diagnose(problem);
  if (conflicts.length > 0) {
    return { status: 'infeasible', conflicts };
  }

  if (problem.shifts.length === 0) {
    return { status: 'optimal', objectiveValue: 0, assignments: [] };
  }

  const model = buildScheduleModel(problem, config);
  const run = await runHighs(model.lpText, config);

  if (run.status === 'infeasible') {
    return { status: 'infeasible', conflicts: [UNDIAGNOSED_CONFLICT] };
  }

  const assignments: Assignment[] = model.variables
    .filter((variable) => (run.primalValues[variable.name] ?? 0) > 0.5)
    .map((variable) => ({ employeeId: variable.employeeId, shiftId: variable.shiftId }));

  // Safety net, not business logic: a "feasible" HiGHS result must still be
  // a schedule. If a time-limited run returned no incumbent (or our
  // extraction broke), coverage would be short — refuse to present that as
  // a valid schedule.
  for (const shift of problem.shifts) {
    const assigned = assignments.filter((a) => a.shiftId === shift.id).length;
    if (assigned !== shift.headcount) {
      throw new Error(
        `Solver reported "${run.status}" but shift ${shift.id} has ${assigned} of ` +
          `${shift.headcount} required employees — refusing to return an invalid schedule`,
      );
    }
  }

  return { status: run.status, objectiveValue: run.objectiveValue, assignments };
}
