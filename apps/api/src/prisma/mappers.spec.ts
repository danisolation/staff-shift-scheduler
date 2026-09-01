import type { Employee, Shift, Skill } from '@scheduler/contracts';
import type { EmployeeRecord, ShiftRecord, SkillRecord } from './mappers';
import { toContractEmployee, toContractShift, toContractSkill } from './mappers';

/**
 * The mappers are pure functions, so these tests need no database — just
 * row-shaped objects as Prisma would return them.
 */

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

function skillRow(overrides: Partial<SkillRecord> = {}): SkillRecord {
  return { id: 'skill-1', name: 'Barista', createdAt: FIXED_DATE, ...overrides };
}

function employeeRow(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 'employee-1',
    name: 'Ada',
    contractMaxMinutes: 2400,
    createdAt: FIXED_DATE,
    skills: [{ employeeId: 'employee-1', skillId: 'skill-1' }],
    availability: [
      { id: 'window-1', employeeId: 'employee-1', day: 0, startMinute: 480, endMinute: 720 },
    ],
    ...overrides,
  };
}

function shiftRow(overrides: Partial<ShiftRecord> = {}): ShiftRecord {
  return {
    id: 'shift-1',
    day: 2,
    startMinute: 540,
    endMinute: 1020,
    headcount: 2,
    createdAt: FIXED_DATE,
    requiredSkills: [{ shiftId: 'shift-1', skillId: 'skill-1' }],
    ...overrides,
  };
}

describe('contract mappers', () => {
  it('maps a skill row to the contract shape', () => {
    const skill: Skill = toContractSkill(skillRow());
    expect(skill).toEqual({ id: 'skill-1', name: 'Barista' });
  });

  it('maps an employee row: join rows become skillIds, windows become availability', () => {
    const employee: Employee = toContractEmployee(
      employeeRow({
        skills: [
          { employeeId: 'employee-1', skillId: 'skill-2' },
          { employeeId: 'employee-1', skillId: 'skill-1' },
        ],
        availability: [
          { id: 'w2', employeeId: 'employee-1', day: 4, startMinute: 600, endMinute: 780 },
          { id: 'w1', employeeId: 'employee-1', day: 0, startMinute: 480, endMinute: 720 },
        ],
      }),
    );
    expect(employee).toEqual({
      id: 'employee-1',
      name: 'Ada',
      skillIds: ['skill-2', 'skill-1'],
      availability: [
        { day: 4, startMinute: 600, endMinute: 780 },
        { day: 0, startMinute: 480, endMinute: 720 },
      ],
      contractMaxMinutes: 2400,
    });
  });

  it('maps an employee with no skills and no availability (arrays stay arrays)', () => {
    const employee: Employee = toContractEmployee(employeeRow({ skills: [], availability: [] }));
    expect(employee.skillIds).toEqual([]);
    expect(employee.availability).toEqual([]);
  });

  it('maps a shift row: join rows become requiredSkillIds', () => {
    const shift: Shift = toContractShift(
      shiftRow({ requiredSkills: [{ shiftId: 'shift-1', skillId: 'skill-3' }] }),
    );
    expect(shift).toEqual({
      id: 'shift-1',
      day: 2,
      startMinute: 540,
      endMinute: 1020,
      requiredSkillIds: ['skill-3'],
      headcount: 2,
    });
  });
});
