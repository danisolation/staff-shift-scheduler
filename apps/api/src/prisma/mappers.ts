import { Prisma } from '@prisma/client';
import type { Employee, Shift, Skill } from '@scheduler/contracts';

/**
 * Pure mapping functions: Prisma query results → the contract types the
 * API returns. They exist because the database and the API model the same
 * data differently:
 *
 * - the database stores an employee's skills as `EmployeeSkill` join rows
 *   (one row per pair) and availability as child rows of `AvailabilityWindow`;
 * - the API contract exposes flat arrays: `skillIds: string[]` and
 *   `availability: AvailabilityWindow[]`.
 *
 * Keeping the translation here — and nowhere else — means the repositories
 * stay thin and the shapes have exactly one place to change. These functions
 * are pure (input → output, no I/O), so they are unit-tested without any
 * database (see mappers.spec.ts).
 */

/** A row of the Skill table. */
export type SkillRecord = Prisma.SkillGetPayload<Record<string, never>>;

/** An Employee row with its join rows and availability windows included. */
export type EmployeeRecord = Prisma.EmployeeGetPayload<{
  include: { skills: true; availability: true };
}>;

/** A Shift row with its required-skill join rows included. */
export type ShiftRecord = Prisma.ShiftGetPayload<{
  include: { requiredSkills: true };
}>;

export function toContractSkill(row: SkillRecord): Skill {
  return { id: row.id, name: row.name };
}

export function toContractEmployee(row: EmployeeRecord): Employee {
  return {
    id: row.id,
    name: row.name,
    skillIds: row.skills.map((joinRow) => joinRow.skillId),
    availability: row.availability.map((windowRow) => ({
      day: windowRow.day,
      startMinute: windowRow.startMinute,
      endMinute: windowRow.endMinute,
    })),
    contractMaxMinutes: row.contractMaxMinutes,
  };
}

export function toContractShift(row: ShiftRecord): Shift {
  return {
    id: row.id,
    day: row.day,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    requiredSkillIds: row.requiredSkills.map((joinRow) => joinRow.skillId),
    headcount: row.headcount,
  };
}
