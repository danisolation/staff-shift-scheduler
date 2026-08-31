import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { shiftSchema, type Shift, type ShiftCreateInput, type ShiftUpdateInput } from '@scheduler/contracts';
import { SKILL_REPOSITORY, SkillRepository } from '../skills/skill.repository';
import { SHIFT_REPOSITORY, ShiftRepository } from './shift.repository';

/**
 * Business rules for shifts: every required skill must exist. Same
 * referential-integrity rationale as employees — a shift demanding a
 * nonexistent skill would be unsolvable by definition (no employee can
 * ever have it), and the failure would surface only in solver output.
 * Catching it here turns a confusing infeasibility into a clear 400.
 */
@Injectable()
export class ShiftsService {
  constructor(
    @Inject(SHIFT_REPOSITORY) private readonly repository: ShiftRepository,
    @Inject(SKILL_REPOSITORY) private readonly skillRepository: SkillRepository,
  ) {}

  async findAll(): Promise<Shift[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Shift> {
    const shift = await this.repository.findById(id);
    if (!shift) {
      throw new NotFoundException(`Shift ${id} not found`);
    }
    return shift;
  }

  async create(input: ShiftCreateInput): Promise<Shift> {
    await this.assertSkillsExist(input.requiredSkillIds);
    return this.repository.create(input);
  }

  async update(id: string, patch: ShiftUpdateInput): Promise<Shift> {
    const existing = await this.findById(id);
    if (patch.requiredSkillIds) {
      await this.assertSkillsExist(patch.requiredSkillIds);
    }
    // A partial patch can make the *merged* entity invalid (e.g. moving
    // startMinute past the existing endMinute), which the patch schema
    // alone cannot see. The domain rule "a shift must end after it starts"
    // belongs here: validate the merged result before storing it.
    const merged: Shift = { ...existing, ...patch };
    const parsed = shiftSchema.safeParse(merged);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: parsed.error.issues,
      });
    }
    const updated = await this.repository.update(id, patch);
    if (!updated) {
      throw new NotFoundException(`Shift ${id} not found`);
    }
    return parsed.data;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.repository.delete(id);
  }

  /** Every required skill must exist; otherwise 400. */
  private async assertSkillsExist(skillIds: string[]): Promise<void> {
    const missing = (
      await Promise.all(skillIds.map(async (skillId) => (await this.skillRepository.findById(skillId)) ? null : skillId))
    ).filter((id): id is string => id !== null);
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown skill id(s): ${missing.join(', ')}`);
    }
  }
}
