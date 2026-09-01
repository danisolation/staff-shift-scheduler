import type { ScheduleProblem } from './types.js';
import { canCover, shiftMinutes } from './schedule-model.js';

/**
 * Infeasibility diagnoser — pure functions explaining WHY no schedule can
 * exist, structured by constraint family.
 *
 * HiGHS reports *that* a model is infeasible, never *which rules* clash.
 * But the two most common causes can be detected by simple counting before
 * solving, and those are exactly the causes users can act on:
 *
 *   Family 1 — per-shift eligibility: a shift's pool of eligible employees
 *   (same pruning rules as the model) is smaller than its headcount.
 *
 *   Family 2 — total capacity: the minutes the shifts demand exceed the
 *   minutes every employee's contract allows combined. (A necessary
 *   condition for feasibility — passing it does not guarantee feasibility,
 *   failing it guarantees infeasibility.)
 *
 * Anything subtler (caps interacting across shifts) surfaces only at the
 * solver and gets an honest "jointly contradictory" message from
 * solveSchedule — never a fabricated reason.
 *
 * Messages deliberately keep raw day indices and minutes: the domain rule
 * is that time formatting belongs to the frontend, which will turn
 * "day 5, minutes 480–720" into "Saturday 08:00–12:00".
 */
export function diagnose(problem: ScheduleProblem): string[] {
  const conflicts: string[] = [];

  // Family 1: per-shift eligible pool vs headcount.
  for (const shift of problem.shifts) {
    const eligible = problem.employees.filter((employee) => canCover(employee, shift));
    if (eligible.length < shift.headcount) {
      const skills =
        shift.requiredSkillIds.length > 0
          ? `holds every required skill (${shift.requiredSkillIds.join(', ')})`
          : 'has no required skills to hold';
      conflicts.push(
        `Shift ${shift.id} (day ${shift.day}, minutes ${shift.startMinute}-${shift.endMinute}) ` +
          `requires ${shift.headcount} eligible employee(s), but only ${eligible.length} qualify. ` +
          `An eligible employee ${skills}, has an availability window covering the shift, ` +
          `and has a contract cap of at least ${shiftMinutes(shift)} minutes.`,
      );
    }
  }

  // Family 2: total demand minutes vs total contract capacity.
  const demandMinutes = problem.shifts.reduce(
    (total, shift) => total + shiftMinutes(shift) * shift.headcount,
    0,
  );
  const capacityMinutes = problem.employees.reduce(
    (total, employee) => total + employee.contractMaxMinutes,
    0,
  );
  if (demandMinutes > capacityMinutes) {
    conflicts.push(
      `The shifts demand ${demandMinutes} covered minutes in total, but the employees' ` +
        `contracts allow only ${capacityMinutes} minutes combined. No assignment can fit ` +
        'the week — add capacity or reduce demand.',
    );
  }

  return conflicts;
}
