import { randomUUID } from 'node:crypto';
import type {
  Employee,
  EmployeeCreateInput,
  EmployeeUpdateInput,
} from '@scheduler/contracts';

/** Runtime token for NestJS dependency injection (see skill.repository.ts). */
export const EMPLOYEE_REPOSITORY = Symbol('EmployeeRepository');

/**
 * The storage contract for employees. Same shape as SkillRepository —
 * services depend on this interface only, so Milestone 2 swaps the
 * implementation for PostgreSQL without touching services or controllers.
 */
export interface EmployeeRepository {
  findAll(): Promise<Employee[]>;
  findById(id: string): Promise<Employee | null>;
  create(input: EmployeeCreateInput): Promise<Employee>;
  update(id: string, patch: EmployeeUpdateInput): Promise<Employee | null>;
  delete(id: string): Promise<boolean>;
}

/** In-memory implementation: a Map keyed by id, gone on restart. */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly employees = new Map<string, Employee>();

  async findAll(): Promise<Employee[]> {
    return [...this.employees.values()];
  }

  async findById(id: string): Promise<Employee | null> {
    return this.employees.get(id) ?? null;
  }

  async create(input: EmployeeCreateInput): Promise<Employee> {
    const employee: Employee = { id: randomUUID(), ...input };
    this.employees.set(employee.id, employee);
    return employee;
  }

  async update(id: string, patch: EmployeeUpdateInput): Promise<Employee | null> {
    const existing = this.employees.get(id);
    if (!existing) {
      return null;
    }
    const updated: Employee = { ...existing, ...patch };
    this.employees.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.employees.delete(id);
  }
}
