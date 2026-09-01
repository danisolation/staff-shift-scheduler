import { Injectable } from '@nestjs/common';
import type { Skill, SkillCreateInput, SkillUpdateInput } from '@scheduler/contracts';
import { SkillInUseError } from '../skills/skill.repository';
import type { SkillRepository } from '../skills/skill.repository';
import { toContractSkill } from './mappers';
import { isPrismaError } from './prisma-errors';
import { PrismaService } from './prisma.service';

/**
 * PostgreSQL-backed SkillRepository — the real implementation behind the
 * SKILL_REPOSITORY token (the in-memory class remains as the double used by
 * unit tests). The interface it fulfills is unchanged; services and
 * controllers never learned this exists.
 *
 * Error translation: the database guarantees a skill still referenced by
 * employees or shifts cannot be deleted (ON DELETE RESTRICT foreign keys).
 * Prisma reports that as error code P2003, which this repository translates
 * into the typed SkillInUseError the interface documents. Missing-record
 * updates/deletes surface as P2025 and are translated to the interface's
 * "null / false" convention. Everything else is rethrown — the global
 * exception filter turns unknown failures into a 500 instead of hiding them.
 */
@Injectable()
export class PrismaSkillRepository implements SkillRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Skill[]> {
    // Ordered by creation time so list responses match the in-memory
    // implementation's insertion order — swapping storage must not change
    // what API consumers see.
    const rows = await this.prisma.skill.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toContractSkill);
  }

  async findById(id: string): Promise<Skill | null> {
    const row = await this.prisma.skill.findUnique({ where: { id } });
    return row ? toContractSkill(row) : null;
  }

  async create(input: SkillCreateInput): Promise<Skill> {
    const row = await this.prisma.skill.create({ data: { name: input.name } });
    return toContractSkill(row);
  }

  async update(id: string, patch: SkillUpdateInput): Promise<Skill | null> {
    try {
      const row = await this.prisma.skill.update({ where: { id }, data: patch });
      return toContractSkill(row);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.skill.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        return false;
      }
      if (isPrismaError(error, 'P2003')) {
        throw new SkillInUseError(id);
      }
      throw error;
    }
  }

  async existsByName(name: string): Promise<boolean> {
    // Case-insensitive, matching the service's domain rule ("Barista" and
    // "barista" are the same skill). The lower(name) unique index in the
    // initial migration is the storage-level backstop for the same rule.
    const count = await this.prisma.skill.count({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    return count > 0;
  }
}
