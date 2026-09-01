import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Employee,
  EmployeeCreateInput,
  EmployeeUpdateInput,
} from '@scheduler/contracts';
import type { EmployeeRepository } from '../employees/employee.repository';
import { toContractEmployee } from './mappers';
import { isPrismaError } from './prisma-errors';
import { PrismaService } from './prisma.service';

/**
 * Which relation rows every read pulls in, with deterministic ordering —
 * PostgreSQL guarantees no row order for relation loads, and API responses
 * must not shuffle between calls. Skill ids sort by id; availability windows
 * sort chronologically (weekday, then minute).
 */
const employeeInclude = {
  skills: { orderBy: { skillId: 'asc' } },
  availability: { orderBy: [{ day: 'asc' }, { startMinute: 'asc' }] },
} satisfies Prisma.EmployeeInclude;

/**
 * PostgreSQL-backed EmployeeRepository — the real implementation behind the
 * EMPLOYEE_REPOSITORY token. Same five-method interface as the in-memory
 * class; services and controllers are untouched by the swap.
 *
 * Shape translation: the API contract's `skillIds: string[]` and
 * `availability: AvailabilityWindow[]` are stored as EmployeeSkill join rows
 * and AvailabilityWindow child rows. Create inserts those rows; update
 * *replaces* them when the patch contains the array — the same whole-array
 * semantics the in-memory spread produced. Reads include the relation rows
 * and map back to the contract shape (see mappers.ts).
 */
@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Employee[]> {
    const rows = await this.prisma.employee.findMany({
      include: employeeInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toContractEmployee);
  }

  async findById(id: string): Promise<Employee | null> {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: employeeInclude,
    });
    return row ? toContractEmployee(row) : null;
  }

  async create(input: EmployeeCreateInput): Promise<Employee> {
    const row = await this.prisma.employee.create({
      data: {
        name: input.name,
        contractMaxMinutes: input.contractMaxMinutes,
        availability: { create: input.availability },
        skills: { create: input.skillIds.map((skillId) => ({ skillId })) },
      },
      include: employeeInclude,
    });
    return toContractEmployee(row);
  }

  async update(id: string, patch: EmployeeUpdateInput): Promise<Employee | null> {
    try {
      const row = await this.prisma.employee.update({
        where: { id },
        data: {
          name: patch.name,
          contractMaxMinutes: patch.contractMaxMinutes,
          // A patch that carries skillIds/availability replaces the whole
          // set: delete the join/child rows, then create the new ones.
          // `undefined` leaves the relation untouched (partial patch).
          skills: patch.skillIds
            ? { deleteMany: {}, create: patch.skillIds.map((skillId) => ({ skillId })) }
            : undefined,
          availability: patch.availability ? { deleteMany: {}, create: patch.availability } : undefined,
        },
        include: employeeInclude,
      });
      return toContractEmployee(row);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        return null;
      }
      // A P2003 here would mean a patch introduced a skill id that does not
      // exist. The service pre-checks references for a friendly 400; the
      // database's own rejection is the backstop. Rethrowing (→ 500) is
      // correct: reaching this line means the service check was bypassed.
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Join rows and availability windows go with the employee
      // (onDelete: Cascade); no manual cleanup needed.
      await this.prisma.employee.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        return false;
      }
      throw error;
    }
  }
}
