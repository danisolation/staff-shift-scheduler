import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EmployeeCreateInput } from '@scheduler/contracts';
import { InMemorySkillRepository } from '../skills/skill.repository';
import { InMemoryEmployeeRepository, EmployeeRepository } from './employee.repository';
import { EmployeesService } from './employees.service';

const validEmployee: EmployeeCreateInput = {
  name: 'Anna',
  skillIds: [],
  availability: [{ day: 0, startMinute: 540, endMinute: 1080 }],
  contractMaxMinutes: 2400,
};

describe('EmployeesService', () => {
  let repository: EmployeeRepository;
  let skillRepository: InMemorySkillRepository;
  let service: EmployeesService;

  beforeEach(() => {
    repository = new InMemoryEmployeeRepository();
    skillRepository = new InMemorySkillRepository();
    service = new EmployeesService(repository, skillRepository);
  });

  it('creates an employee with a generated uuid id', async () => {
    const employee = await service.create(validEmployee);
    expect(employee.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(employee.name).toBe('Anna');
  });

  it('accepts employees whose skill ids all exist', async () => {
    const barista = await skillRepository.create({ name: 'Barista' });
    const employee = await service.create({ ...validEmployee, skillIds: [barista.id] });
    expect(employee.skillIds).toEqual([barista.id]);
  });

  it('rejects a reference to an unknown skill (400)', async () => {
    await expect(
      service.create({
        ...validEmployee,
        skillIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown skill on update (400) without changing the employee', async () => {
    const created = await service.create(validEmployee);
    await expect(
      service.update(created.id, { skillIds: ['00000000-0000-0000-0000-000000000000'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const unchanged = await service.findById(created.id);
    expect(unchanged.skillIds).toEqual([]);
  });

  it('finds an employee by id, and 404s for a missing one', async () => {
    const created = await service.create(validEmployee);
    await expect(service.findById(created.id)).resolves.toEqual(created);
    await expect(
      service.findById('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates only the provided fields', async () => {
    const created = await service.create(validEmployee);
    const updated = await service.update(created.id, { name: 'Anna B' });
    expect(updated.name).toBe('Anna B');
    expect(updated.contractMaxMinutes).toBe(validEmployee.contractMaxMinutes);
  });

  it('deletes an employee', async () => {
    const created = await service.create(validEmployee);
    await service.delete(created.id);
    await expect(service.findById(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
