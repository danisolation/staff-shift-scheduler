import { describe, it, expect } from 'vitest';
import { diagnose } from './diagnose.js';
import type { ScheduleProblem } from './types.js';

describe('diagnose', () => {
  it('reports no conflicts for a plainly solvable problem', () => {
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 }],
    };
    expect(diagnose(problem)).toEqual([]);
  });

  it('explains a headcount shortfall: pool of 1 cannot cover headcount 2', () => {
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 2 }],
    };
    const conflicts = diagnose(problem);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('s1');
    expect(conflicts[0]).toContain('requires 2');
    expect(conflicts[0]).toContain('only 1 qualify');
  });

  it('explains a shortfall caused by missing skills', () => {
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: ['other'], availability: [{ day: 0, startMinute: 480, endMinute: 720 }], contractMaxMinutes: 480 },
      ],
      shifts: [{ id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: ['skill-a'], headcount: 1 }],
    };
    const conflicts = diagnose(problem);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('skill-a');
  });

  it('explains total demand exceeding total capacity', () => {
    // Three 240-minute shifts = 720 demanded minutes; one employee capped at 480.
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
    const conflicts = diagnose(problem);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('720');
    expect(conflicts[0]).toContain('480');
  });

  it('treats demand exactly equal to capacity as fine (the solver decides)', () => {
    const problem: ScheduleProblem = {
      employees: [
        { id: 'e1', skillIds: [], availability: [{ day: 0, startMinute: 480, endMinute: 1200 }], contractMaxMinutes: 720 },
      ],
      shifts: [
        { id: 's1', day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [], headcount: 1 },
        { id: 's2', day: 0, startMinute: 720, endMinute: 960, requiredSkillIds: [], headcount: 1 },
        { id: 's3', day: 0, startMinute: 960, endMinute: 1200, requiredSkillIds: [], headcount: 1 },
      ],
    };
    expect(diagnose(problem)).toEqual([]);
  });
});
