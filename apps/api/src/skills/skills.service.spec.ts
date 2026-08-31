import { ConflictException, NotFoundException } from '@nestjs/common';
import { InMemorySkillRepository, SkillRepository } from './skill.repository';
import { SkillsService } from './skills.service';

describe('SkillsService', () => {
  let repository: SkillRepository;
  let service: SkillsService;

  beforeEach(() => {
    // The in-memory repository keeps the test hermetic: no database, no mocks.
    repository = new InMemorySkillRepository();
    service = new SkillsService(repository);
  });

  it('creates a skill with a generated uuid id', async () => {
    const skill = await service.create({ name: 'Barista' });
    expect(skill.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(skill.name).toBe('Barista');
  });

  it('rejects a duplicate name case-insensitively (409)', async () => {
    await service.create({ name: 'Barista' });
    await expect(service.create({ name: 'barista' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('finds a skill by id', async () => {
    const created = await service.create({ name: 'Cashier' });
    await expect(service.findById(created.id)).resolves.toEqual(created);
  });

  it('throws 404 for a missing id', async () => {
    await expect(
      service.findById('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates only the provided fields', async () => {
    const created = await service.create({ name: 'Cashier' });
    const updated = await service.update(created.id, { name: 'Host' });
    expect(updated.name).toBe('Host');
    expect(updated.id).toBe(created.id);
  });

  it('throws 404 when updating a missing skill', async () => {
    await expect(
      service.update('00000000-0000-0000-0000-000000000000', { name: 'Host' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a skill', async () => {
    const created = await service.create({ name: 'Runner' });
    await service.delete(created.id);
    await expect(service.findById(created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 404 when deleting a missing skill', async () => {
    await expect(
      service.delete('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
