import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ShiftCreateInput } from '@scheduler/contracts';
import { InMemorySkillRepository } from '../skills/skill.repository';
import { InMemoryShiftRepository, ShiftRepository } from './shift.repository';
import { ShiftsService } from './shifts.service';

describe('ShiftsService', () => {
  let repository: ShiftRepository;
  let skillRepository: InMemorySkillRepository;
  let service: ShiftsService;
  let baristaId: string;

  /** A contract-valid shift: at least one real required skill. */
  function validShift(overrides: Partial<ShiftCreateInput> = {}): ShiftCreateInput {
    return {
      day: 0,
      startMinute: 540,
      endMinute: 900,
      requiredSkillIds: [baristaId],
      headcount: 2,
      ...overrides,
    };
  }

  beforeEach(async () => {
    repository = new InMemoryShiftRepository();
    skillRepository = new InMemorySkillRepository();
    service = new ShiftsService(repository, skillRepository);
    const barista = await skillRepository.create({ name: 'Barista' });
    baristaId = barista.id;
  });

  it('creates a shift with a generated uuid id', async () => {
    const shift = await service.create(validShift());
    expect(shift.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(shift.headcount).toBe(2);
  });

  it('accepts a shift whose required skills all exist', async () => {
    const shift = await service.create(validShift());
    expect(shift.requiredSkillIds).toEqual([baristaId]);
  });

  it('rejects a reference to an unknown skill (400)', async () => {
    await expect(
      service.create(
        validShift({ requiredSkillIds: ['00000000-0000-0000-0000-000000000000'] }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown skill on update (400) without changing the shift', async () => {
    const created = await service.create(validShift());
    await expect(
      service.update(created.id, {
        requiredSkillIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const unchanged = await service.findById(created.id);
    expect(unchanged.requiredSkillIds).toEqual([baristaId]);
  });

  it('finds a shift by id, and 404s for a missing one', async () => {
    const created = await service.create(validShift());
    await expect(service.findById(created.id)).resolves.toEqual(created);
    await expect(
      service.findById('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates only the provided fields', async () => {
    const created = await service.create(validShift());
    const updated = await service.update(created.id, { headcount: 3 });
    expect(updated.headcount).toBe(3);
    expect(updated.day).toBe(0);
  });

  it('rejects a patch that would make the merged shift invalid (400)', async () => {
    const created = await service.create(validShift());
    // Moving startMinute past the existing endMinute breaks the domain rule.
    await expect(service.update(created.id, { startMinute: 1000 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const unchanged = await service.findById(created.id);
    expect(unchanged.startMinute).toBe(540);
  });

  it('deletes a shift', async () => {
    const created = await service.create(validShift());
    await service.delete(created.id);
    await expect(service.findById(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
