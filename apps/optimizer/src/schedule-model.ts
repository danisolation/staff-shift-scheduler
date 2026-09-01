import type { ScheduleProblem, ScheduleProblemEmployee, ScheduleProblemShift, SolverConfig } from './types.js';

/**
 * The scheduling model, built as pure functions: typed input in, LP text
 * and metadata out. No I/O, no solver calls — everything here can be tested
 * without HiGHS.
 *
 * ─── THE MODEL ────────────────────────────────────────────────────────────
 *
 * Decision variables (one per *eligible* employee–shift pair):
 *   x_e_s ∈ {0, 1}   1 = employee e covers shift s
 *   maxweekend ≥ 0   fairness variable (see objective)
 *
 * Objective (minimize):
 *   Σ_s minutes_s · Σ_e x_e_s    +    fairnessWeight · maxweekend
 *   └── total assigned minutes ──┘    └── max weekend shifts ──┘
 *
 *   NOTE: with exact headcount coverage (constraint below), the assigned-
 *   minutes term is mathematically constant (Σ_s minutes_s · headcount_s).
 *   It is kept because it states the intent and becomes meaningful the
 *   moment shifts gain individual costs (pay rates, overtime); today the
 *   fairness term is what actually distinguishes schedules.
 *
 * Constraints:
 *   cover_s:    Σ_e x_e_s = headcount_s            (every shift fully staffed)
 *   hours_e:    Σ_s minutes_s · x_e_s ≤ contractMaxMinutes_e
 *   weekend_e:  maxweekend ≥ Σ_{s on day 5 or 6} x_e_s
 *
 * Assumptions built into variable pruning — a variable x_e_s exists ONLY if:
 *   1. the employee holds EVERY skill in shift.requiredSkillIds;
 *   2. some availability window of the employee contains the shift
 *      (same day, window.startMinute ≤ shift.startMinute and
 *      window.endMinute ≥ shift.endMinute);
 *   3. contractMaxMinutes_e ≥ minutes_s (an employee who cannot fit one
 *      shift can never be assigned it).
 * Everything the rules forbid is simply absent from the model — smaller
 * and faster than writing x = 0 constraints.
 *
 * Fairness linearization: "employees should have similar weekend loads"
 * cannot be written directly (absolute values / quadratics are not linear).
 * The standard trick — maxweekend ≥ weekend count of every employee, then
 * minimize maxweekend — minimizes the WORST weekend load, which is linear.
 */

/** Weekend = Saturday and Sunday (day 0 is Monday). */
const WEEKEND_DAYS = new Set([5, 6]);

const FAIRNESS_VARIABLE = 'maxweekend';

export interface ModelVariable {
  /** LP-safe name, e.g. `x_0_3` (UUIDs contain hyphens, LP names cannot). */
  name: string;
  employeeId: string;
  shiftId: string;
}

export interface ScheduleModel {
  /** The complete model in CPLEX LP format — exactly what HiGHS receives. */
  lpText: string;
  /** Registry mapping every `x_*` variable back to its employee/shift ids. */
  variables: ModelVariable[];
}

/** The shift's length in minutes (same-day by contract: endMinute ≤ 1440). */
export function shiftMinutes(shift: ScheduleProblemShift): number {
  return shift.endMinute - shift.startMinute;
}

/** True when this employee may cover this shift under the pruning rules. */
export function canCover(
  employee: ScheduleProblemEmployee,
  shift: ScheduleProblemShift,
): boolean {
  const hasSkills = shift.requiredSkillIds.every((skillId) =>
    employee.skillIds.includes(skillId),
  );
  const fitsAvailability = employee.availability.some(
    (window) =>
      window.day === shift.day &&
      window.startMinute <= shift.startMinute &&
      window.endMinute >= shift.endMinute,
  );
  const fitsContract = employee.contractMaxMinutes >= shiftMinutes(shift);
  return hasSkills && fitsAvailability && fitsContract;
}

/**
 * Builds the LP model for a schedule problem.
 *
 * Throws if some shift has no eligible employees at all (the LP would need
 * an empty constraint row, which LP format cannot express). The normal
 * flow never hits this: solveSchedule() runs diagnose() first and returns
 * a human-readable conflict instead.
 */
export function buildScheduleModel(
  problem: ScheduleProblem,
  config: SolverConfig,
): ScheduleModel {
  const employeeIndex = new Map<string, number>();
  problem.employees.forEach((employee, index) => employeeIndex.set(employee.id, index));
  const shiftIndex = new Map<string, number>();
  problem.shifts.forEach((shift, index) => shiftIndex.set(shift.id, index));

  // One variable per eligible pair, in deterministic order (employees in
  // input order outer, shifts inner).
  const variables: ModelVariable[] = [];
  for (const employee of problem.employees) {
    const e = employeeIndex.get(employee.id);
    for (const shift of problem.shifts) {
      const s = shiftIndex.get(shift.id);
      if (canCover(employee, shift)) {
        variables.push({ name: `x_${e}_${s}`, employeeId: employee.id, shiftId: shift.id });
      }
    }
  }

  const unstaffable = problem.shifts.filter(
    (shift) => !variables.some((variable) => variable.shiftId === shift.id),
  );
  if (unstaffable.length > 0) {
    throw new Error(
      `Shift(s) ${unstaffable.map((shift) => shift.id).join(', ')} have no eligible ` +
        'employees — run diagnose() first to get a readable conflict',
    );
  }

  // ── Objective ──────────────────────────────────────────────────────────
  const minutesByShift = new Map(problem.shifts.map((shift) => [shift.id, shiftMinutes(shift)]));
  const objectiveTerms = [
    ...variables.map(
      (variable) => `${minutesByShift.get(variable.shiftId)} ${variable.name}`,
    ),
    `${config.fairnessWeight} ${FAIRNESS_VARIABLE}`,
  ];

  // ── Constraints ────────────────────────────────────────────────────────
  const rows: string[] = [];

  // cover_s: exactly headcount_s employees on every shift.
  for (const shift of problem.shifts) {
    const names = variables
      .filter((variable) => variable.shiftId === shift.id)
      .map((variable) => variable.name);
    rows.push(` cover_${shiftIndex.get(shift.id)}: ${names.join(' + ')} = ${shift.headcount}`);
  }

  // hours_e: weekly assigned minutes within the contract cap.
  for (const employee of problem.employees) {
    const terms = variables
      .filter((variable) => variable.employeeId === employee.id)
      .map((variable) => `${minutesByShift.get(variable.shiftId)} ${variable.name}`);
    if (terms.length > 0) {
      rows.push(
        ` hours_${employeeIndex.get(employee.id)}: ${terms.join(' + ')} <= ${employee.contractMaxMinutes}`,
      );
    }
  }

  // weekend_e: maxweekend must reach every employee's weekend shift count.
  // Minimizing the objective pushes maxweekend down to exactly the max.
  for (const employee of problem.employees) {
    const weekendNames = variables
      .filter(
        (variable) =>
          variable.employeeId === employee.id &&
          WEEKEND_DAYS.has(problem.shifts.find((shift) => shift.id === variable.shiftId)!.day),
      )
      .map((variable) => variable.name);
    if (weekendNames.length > 0) {
      rows.push(
        ` weekend_${employeeIndex.get(employee.id)}: ${FAIRNESS_VARIABLE} - ${weekendNames.join(' - ')} >= 0`,
      );
    }
  }

  // ── Assemble ───────────────────────────────────────────────────────────
  const lpText = [
    'Minimize',
    ` obj: ${objectiveTerms.join(' + ')}`,
    'Subject To',
    ...rows,
    'Bounds',
    ` ${FAIRNESS_VARIABLE} >= 0`,
    'Binaries',
    ...variables.map((variable) => ` ${variable.name}`),
    'End',
    '',
  ].join('\n');

  return { lpText, variables };
}
