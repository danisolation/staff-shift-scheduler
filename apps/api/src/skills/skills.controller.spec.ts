import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { skillCreateSchema } from '@scheduler/contracts';
import { validateWithZod } from '../common/zod/validate-with-zod';
import { InMemorySkillRepository, SKILL_REPOSITORY } from './skill.repository';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

/**
 * Controller tests exercise the HTTP layer: validation, status codes, and
 * the delegation to the service. Using the real service + in-memory
 * repository (instead of mocks) keeps the test honest — it proves the
 * whole module works together, minus the network itself.
 */
describe('SkillsController', () => {
  let controller: SkillsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SkillsController],
      providers: [SkillsService, { provide: SKILL_REPOSITORY, useClass: InMemorySkillRepository }],
    }).compile();
    controller = moduleRef.get(SkillsController);
  });

  it('creates, lists, updates, and deletes a skill end to end', async () => {
    const created = await controller.create({ name: 'Barista' });
    expect(created.name).toBe('Barista');

    const list = await controller.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);

    const updated = await controller.update(created.id, { name: 'Lead Barista' });
    expect(updated.name).toBe('Lead Barista');

    await controller.remove(created.id);
    await expect(controller.list()).resolves.toHaveLength(0);
  });

  it('rejects a malformed create body (400)', async () => {
    await expect(controller.create({ name: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-uuid path parameter (400)', async () => {
    await expect(controller.getById('not-a-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an empty update body (400)', async () => {
    const created = await controller.create({ name: 'Cashier' });
    await expect(controller.update(created.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegates a missing skill to a 404', async () => {
    await expect(
      controller.getById('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the zod helper rejects the wrong type with the issue list', () => {
    try {
      validateWithZod(skillCreateSchema, { name: 5 });
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        message: string;
        details: unknown[];
      };
      expect(body.message).toBe('Validation failed');
      expect(body.details).toHaveLength(1);
    }
  });
});
