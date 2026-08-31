import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InMemorySkillRepository, SKILL_REPOSITORY } from '../skills/skill.repository';
import { SkillsService } from '../skills/skills.service';
import { InMemoryShiftRepository, SHIFT_REPOSITORY } from './shift.repository';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

describe('ShiftsController', () => {
  let controller: ShiftsController;
  let skillsService: SkillsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ShiftsController],
      providers: [
        ShiftsService,
        SkillsService,
        { provide: SHIFT_REPOSITORY, useClass: InMemoryShiftRepository },
        { provide: SKILL_REPOSITORY, useClass: InMemorySkillRepository },
      ],
    }).compile();
    controller = moduleRef.get(ShiftsController);
    skillsService = moduleRef.get(SkillsService);
  });

  it('creates, lists, updates, and deletes a shift end to end', async () => {
    // A shift must reference real skills (contract requires at least one),
    // so create the skill first — exactly what the UI flow will do.
    const barista = await skillsService.create({ name: 'Barista' });

    const created = await controller.create({
      day: 1,
      startMinute: 600,
      endMinute: 960,
      requiredSkillIds: [barista.id],
      headcount: 2,
    });

    const list = await controller.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);

    const updated = await controller.update(created.id, { headcount: 3 });
    expect(updated.headcount).toBe(3);

    await controller.remove(created.id);
    await expect(controller.list()).resolves.toHaveLength(0);
  });

  it('rejects a malformed body (400): end before start', async () => {
    await expect(
      controller.create({
        day: 1,
        startMinute: 960,
        endMinute: 600,
        requiredSkillIds: ['00000000-0000-0000-0000-000000000000'],
        headcount: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-uuid path parameter (400)', async () => {
    await expect(controller.getById('nope')).rejects.toBeInstanceOf(BadRequestException);
  });
});
