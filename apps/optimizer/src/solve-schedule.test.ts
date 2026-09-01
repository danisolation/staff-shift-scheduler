import { describe, it, expect } from 'vitest';
import { solveSchedule } from './solve-schedule.js';
import type { ScheduleProblem } from './types.js';
import { DEFAULT_SOLVER_CONFIG } from './types.js';

/**
 * Numerical tests: every expected objective value and assignment below was
 * computed by hand BEFORE running — the arithmetic is in the comments. The
 * solver must agree exactly, or the model is wrong.
 */
describe('solveSchedule (hand-computed cases)', () => {
  it('assigns the only eligible employee and returns the shift minutes as objective', async () => {
    // Hand computation: shift s1 = 720 - 480 = 240 minutes, headcount 1.
    // x[e1,s1] = 1 (forced). No weekend shifts, so maxweekend = 0.
    // Objective = 240 * 1 + 1 * 0 = 240.
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 }],
    };

    const result = await solveSchedule(problem, DEFAULT_SOLVER_CONFIG);
    expect(result.status).toBe('optimal');
    if (result.status === 'optimal') {
      expect(result.objectiveValue).toBeCloseTo(240, 6);
      expect(result.assignments).toEqual([{ employeeId: 'e1', shiftId: 's1' }]);
    }
  });

  it('prunes employees without the required skill, forcing the qualified one', async () => {
    // Hand computation: s1 requires skill-a. Only e2 has it, so the model
    // has exactly one variable: x[e2,s1] = 1. s1 = 1020 - 540 = 480 minutes.
    // No weekend shifts → maxweekend = 0. Objective = 480.
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 1, startMinute: 540, endMinute: 1020 }], contractMaxMinutes: 480 },
        { id: 'e2', skillIds: ['skill-a'], availability: [{ day: 1, startMinute: 540, endMinute: 1020 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 1, startMinute: 540, endMinute: 1020, requiredSkillIds: ['skill-a'], headcount: 1 }],
    };

    const result = await solveSchedule(problem, DEFAULT_SOLVER_CONFIG);
    expect(result.status).toBe('optimal');
    if (result.status === 'optimal') {
      expect(result.objectiveValue).toBeCloseTo(480, 6);
      expect(result.assignments).toEqual([{ employeeId: 'e2', shiftId: 's1' }]);
    }
  });

  it('adds the fairness penalty when a weekend shift must be covered', async () => {
    // Hand computation: s1 is on day 5 (Saturday), 240 minutes. Only e1 can
    // cover it (e2 is unavailable on day 5). e1 gets 1 weekend shift, so the
    // model's maxweekend is forced to 1. Objective = 240 * 1 + 1 * 1 = 241.
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 5, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
        { id: 'e2', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 5, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 }],
    };

    const result = await solveSchedule(problem, DEFAULT_SOLVER_CONFIG);
    expect(result.status).toBe('optimal');
    if (result.status === 'optimal') {
      expect(result.objectiveValue).toBeCloseTo(241, 6);
      expect(result.assignments).toEqual([{ employeeId: 'e1', shiftId: 's1' }]);
    }
  });

  it('balances identical weekend shifts one per employee', async () => {
    // Hand computation: two identical Saturday shifts (240 minutes each),
    // two interchangeable employees. Any split covering both shifts has the
    // same cost (480), but maxweekend = 2 if one employee takes both and 1
    // if split. The fairness term makes 1 the optimum:
    // Objective = 240 + 240 + 1 * 1 = 481, one shift per employee.
    const shift = { day: 5, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 };
    const employee = {
      id: 'placeholder',
      skillIds: [] as string[],
      availability: [{ day: 5, startMinute: 480, endMinute: 720 }],
      contractMaxMinutes: 480,
    };
    const problem: ScheduleProblem = {
      employees: [
        { ...employee, id: 'e1' },
        { ...employee, id: 'e2' },
      ],
      shifts: [
        { ...shift, id: 's1' },
        { ...shift, id: 's2' },
      ],
    };

    const result = await solveSchedule(problem, DEFAULT_SOLVER_CONFIG);
    expect(result.status).toBe('optimal');
    if (result.status === 'optimal') {
      expect(result.objectiveValue).toBeCloseTo(481, 6);
      expect(result.assignments).toHaveLength(2);
      // Which employee gets which shift is the solver's choice — what the
      // fairness objective guarantees is one shift each.
      const countsByEmployee = Object.fromEntries(
        result.assignments.map((a) => [a.employeeId, result.assignments.filter((x) => x.employeeId === a.employeeId).length]),
      );
      expect(countsByEmployee).toEqual({ e1: 1, e2: 1 });
      expect(result.assignments.map((a) => a.shiftId).sort()).toEqual(['s1', 's2']);
    }
  });

  it('fills one employee exactly up to the contract cap across two shifts', async () => {
    // Hand computation: two back-to-back 240-minute shifts on day 0; e1's
    // single availability window (480–960) covers both, cap 480 = exactly
    // both shifts. e1 must take both (hours 480 <= 480). No weekend shifts.
    // Objective = 240 + 240 = 480.
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 960 }], contractMaxMinutes: 480 },
      ],
      shifts: [
        { id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 },
        { id: 's2', day: 0, startMinute: 720, endMinute: 960, requiredSkillIds: [], headcount: 1 },
      ],
    };

    const result = await solveSchedule(problem, DEFAULT_SOLVER_CONFIG);
    expect(result.status).toBe('optimal');
    if (result.status === 'optimal') {
      expect(result.objectiveValue).toBeCloseTo(480, 6);
      expect(result.assignments).toEqual([
        { employeeId: 'e1', shiftId: 's1' },
        { employeeId: 'e1', shiftId: 's2' },
      ]);
    }
  });

  it('reports a structured conflict when headcount exceeds the eligible pool', async () => {
    // Hand computation: s1 needs 2 employees; only e1 exists. Diagnose
    // catches this before the solver: pool (1) < headcount (2).
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 2 }],
    };

    const result = await solveSchedule(problem, DEFAULT_SOLVER_CONFIG);
    expect(result.status).toBe('infeasible');
    if (result.status === 'infeasible') {
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toContain('s1');
      expect(result.conflicts[0]).toContain('requires 2');
      expect(result.conflicts[0]).toContain('only 1 qualify');
    }
  });

  it('reports a capacity conflict when demand exceeds total contract minutes', async () => {
    // Hand computation: three 240-minute shifts = 720 demanded minutes;
    // e1's contract allows 480. Every shift is individually coverable, so
    // only the capacity family fires: 720 > 480.
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 1200 }], contractMaxMinutes: 480 },
      ],
      shifts: [
        { id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 },
        { id: 's2', day: 0, startMinute: 720, endMinute: 960, requiredSkillIds: [], headcount: 1 },
        { id: 's3', day: 0, startMinute: 960, endMinute: 1200, requiredSkillIds: [], headcount: 1 },
      ],
    };

    const result = await solveSchedule(problem, DEFAULT_SOLVER_CONFIG);
    expect(result.status).toBe('infeasible');
    if (result.status === 'infeasible') {
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toContain('720');
      expect(result.conflicts[0]).toContain('480');
    }
  });

  it('returns an empty optimal schedule for a problem with no shifts', async () => {
    const result = await solveSchedule({ employees: [], shifts: [] }, DEFAULT_SOLVER_CONFIG);
    expect(result.status).toBe('optimal');
    if (result.status === 'optimal') {
      expect(result.objectiveValue).toBe(0);
      expect(result.assignments).toEqual([]);
    }
  });
});
