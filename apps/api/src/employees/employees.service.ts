import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Employee, EmployeeCreateInput, EmployeeUpdateInput } from '@scheduler/contracts';
import { SKILL_REPOSITORY, SkillRepository } from '../skills/skill.repository';
import { EMPLOYEE_REPOSITORY, EmployeeRepository } from './employee.repository';

/**
 * Business rules for employees:
 * - Every referenced skillId must exist. Without this rule, a typo'd id
 *   would create an employee whose skills silently match nothing — and the
 *   solver (Milestone 3) would produce schedules that look wrong for no
 *   visible reason. Referential integrity catches the bug at write time,
 *   when the user can still fix it.
 */
@Injectable()
export class EmployeesService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly repository: EmployeeRepository,
    @Inject(SKILL_REPOSITORY) private readonly skillRepository: SkillRepository,
  ) {}

  async findAll(): Promise<Employee[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Employee> {
    const employee = await this.repository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return employee;
  }

  async create(input: EmployeeCreateInput): Promise<Employee> {
    await this.assertSkillsExist(input.skillIds);
    return this.repository.create(input);
  }

  async update(id: string, patch: EmployeeUpdateInput): Promise<Employee> {
    await this.findById(id);
    if (patch.skillIds) {
      await this.assertSkillsExist(patch.skillIds);
    }
    const updated = await this.repository.update(id, patch);
    if (!updated) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.repository.delete(id);
  }

  /** Every skillId must reference an existing skill; otherwise 400. */
  private async assertSkillsExist(skillIds: string[]): Promise<void> {
    const missing = (
      await Promise.all(skillIds.map(async (skillId) => (await this.skillRepository.findById(skillId)) ? null : skillId))
    ).filter((id): id is string => id !== null);
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown skill id(s): ${missing.join(', ')}`);
    }
  }
}
