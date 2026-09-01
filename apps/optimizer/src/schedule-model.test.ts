import { describe, it, expect } from 'vitest';
import { buildScheduleModel } from './schedule-model.js';
import type { ScheduleProblem } from './types.js';
import { DEFAULT_SOLVER_CONFIG } from './types.js';

/** Smallest interesting problem: one shift, one employee, no skills. */
function tinyProblem(): ScheduleProblem {
  return {
    employees: [
      {
        id: 'e1',
        skillIds: [],
        availability: [{ day: 0, startMinute: 480, endMinute: 720 }],
        contractMaxMinutes: 480,
      },
    ],
    shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 }],
  };
}

describe('buildScheduleModel', () => {
  it('generates the exact LP text for the tiny problem', () => {
    // Hand-written expected model: one binary, one cover row, one hours row,
    // the fairness variable, and an objective of 240 (shift minutes).
    const { lpText } = buildScheduleModel(tinyProblem(), DEFAULT_SOLVER_CONFIG);
    expect(lpText).toBe(`Minimize
 obj: 240 x_0_0 + 1 maxweekend
Subject To
 cover_0: x_0_0 = 1
 hours_0: 240 x_0_0 <= 480
Bounds
 maxweekend >= 0
Binaries
 x_0_0
End
`);
  });

  it('maps variables back to employee and shift ids', () => {
    const { variables } = buildScheduleModel(tinyProblem(), DEFAULT_SOLVER_CONFIG);
    expect(variables).toEqual([{ name: 'x_0_0', employeeId: 'e1', shiftId: 's1' }]);
  });

  it('writes one weekend row per employee with weekend variables', () => {
    const problem: ScheduleProblem = {
      employees: [
        {
          id: 'e1',
          skillIds: [],
          availability: [{ day: 5, startMinute: 480, endMinute: 720 }],
          contractMaxMinutes: 480,
        },
        {
          id: 'e2',
          skillIds: [],
          availability: [{ day: 5, startMinute: 480, endMinute: 720 }],
          contractMaxMinutes: 480,
        },
      ],
      shifts: [{ id: 's1', day: 5, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 }],
    };
    const { lpText } = buildScheduleModel(problem, DEFAULT_SOLVER_CONFIG);
    expect(lpText).toContain(' cover_0: x_0_0 + x_1_0 = 1');
    // maxweekend must dominate both employees' weekend counts.
    expect(lpText).toContain(' weekend_0: maxweekend - x_0_0 >= 0');
    expect(lpText).toContain(' weekend_1: maxweekend - x_1_0 >= 0');
  });

  it('prunes variables for employees missing a required skill', () => {
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
        { id: 'e2', skillIds: ['skill-a'], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: ['skill-a'], headcount: 1 }],
    };
    const { variables } = buildScheduleModel(problem, DEFAULT_SOLVER_CONFIG);
    // Only e2 (employee index 1) gets a variable.
    expect(variables).toEqual([{ name: 'x_1_0', employeeId: 'e2', shiftId: 's1' }]);
    expect(buildScheduleModel(problem, DEFAULT_SOLVER_CONFIG).lpText).toContain(' cover_0: x_1_0 = 1');
  });

  it('demands headcount employees in the cover row', () => {
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
        { id: 'e2', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 2 }],
    };
    const { lpText } = buildScheduleModel(problem, DEFAULT_SOLVER_CONFIG);
    expect(lpText).toContain(' cover_0: x_0_0 + x_1_0 = 2');
  });

  it('throws on a shift with no eligible employees (diagnose should have caught it)', () => {
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: ['nobody-has-this'], headcount: 1 }],
    };
    expect(() => buildScheduleModel(problem, DEFAULT_SOLVER_CONFIG)).toThrow(/no eligible/);
  });
});
