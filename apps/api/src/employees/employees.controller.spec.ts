import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InMemorySkillRepository, SKILL_REPOSITORY } from '../skills/skill.repository';
import { SkillsService } from '../skills/skills.service';
import { EMPLOYEE_REPOSITORY, InMemoryEmployeeRepository } from './employee.repository';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

describe('EmployeesController', () => {
  let controller: EmployeesController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        EmployeesService,
        SkillsService,
        { provide: EMPLOYEE_REPOSITORY, useClass: InMemoryEmployeeRepository },
        { provide: SKILL_REPOSITORY, useClass: InMemorySkillRepository },
      ],
    }).compile();
    controller = moduleRef.get(EmployeesController);
  });

  it('creates, lists, updates, and deletes an employee end to end', async () => {
    const created = await controller.create({
      name: 'Anna',
      skillIds: [],
      availability: [{ day: 0, startMinute: 540, endMinute: 1080 }],
      contractMaxMinutes: 2400,
    });

    const list = await controller.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);

    const updated = await controller.update(created.id, { name: 'Anna B' });
    expect(updated.name).toBe('Anna B');

    await controller.remove(created.id);
    await expect(controller.list()).resolves.toHaveLength(0);
  });

  it('rejects a malformed body (400)', async () => {
    await expect(
      controller.create({ name: 'Anna', skillIds: [], availability: [], contractMaxMinutes: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-uuid path parameter (400)', async () => {
    await expect(controller.getById('nope')).rejects.toBeInstanceOf(BadRequestException);
  });
});
