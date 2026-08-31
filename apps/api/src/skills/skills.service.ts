import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Skill, SkillCreateInput, SkillUpdateInput } from '@scheduler/contracts';
import { SKILL_REPOSITORY, SkillRepository } from './skill.repository';

/**
 * Skills have exactly one business rule beyond CRUD: names are unique
 * (case-insensitive), because two skills called "Barista" and "barista"
 * would silently split employees into separate pools — a data bug that
 * would only surface later, in solver results.
 *
 * Business rules live here, in the service layer. Controllers never make
 * these decisions; repositories never enforce them (a future database
 * implementation must honor them, but the rule itself belongs to the
 * domain, not the storage).
 */
@Injectable()
export class SkillsService {
  constructor(
    @Inject(SKILL_REPOSITORY) private readonly repository: SkillRepository,
  ) {}

  async findAll(): Promise<Skill[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Skill> {
    const skill = await this.repository.findById(id);
    if (!skill) {
      throw new NotFoundException(`Skill ${id} not found`);
    }
    return skill;
  }

  async create(input: SkillCreateInput): Promise<Skill> {
    if (await this.repository.existsByName(input.name)) {
      throw new ConflictException(`A skill named "${input.name}" already exists`);
    }
    return this.repository.create(input);
  }

  async update(id: string, patch: SkillUpdateInput): Promise<Skill> {
    await this.findById(id);
    if (patch.name && (await this.repository.existsByName(patch.name))) {
      throw new ConflictException(`A skill named "${patch.name}" already exists`);
    }
    const updated = await this.repository.update(id, patch);
    if (!updated) {
      throw new NotFoundException(`Skill ${id} not found`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.repository.delete(id);
  }
}
