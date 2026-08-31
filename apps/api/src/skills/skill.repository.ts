import { randomUUID } from 'node:crypto';
import type { Skill, SkillCreateInput, SkillUpdateInput } from '@scheduler/contracts';

/**
 * Runtime token for NestJS dependency injection. Interfaces are erased at
 * compile time, so NestJS cannot use the interface itself as a key —
 * this symbol is what the container maps to a concrete implementation.
 */
export const SKILL_REPOSITORY = Symbol('SkillRepository');

/**
 * The storage contract for skills. Services depend on this interface, never
 * on a concrete class — so Milestone 2 can swap this in-memory map for a
 * PostgreSQL-backed implementation without touching services or controllers.
 */
export interface SkillRepository {
  findAll(): Promise<Skill[]>;
  findById(id: string): Promise<Skill | null>;
  create(input: SkillCreateInput): Promise<Skill>;
  update(id: string, patch: SkillUpdateInput): Promise<Skill | null>;
  delete(id: string): Promise<boolean>;
  existsByName(name: string): Promise<boolean>;
}

/**
 * In-memory implementation: a Map keyed by id. Data lives only as long as
 * the process — restarting the api forgets everything. That is exactly the
 * trade-off Milestone 2 fixes, while keeping this interface unchanged.
 */
export class InMemorySkillRepository implements SkillRepository {
  private readonly skills = new Map<string, Skill>();

  async findAll(): Promise<Skill[]> {
    return [...this.skills.values()];
  }

  async findById(id: string): Promise<Skill | null> {
    return this.skills.get(id) ?? null;
  }

  async create(input: SkillCreateInput): Promise<Skill> {
    const skill: Skill = { id: randomUUID(), ...input };
    this.skills.set(skill.id, skill);
    return skill;
  }

  async update(id: string, patch: SkillUpdateInput): Promise<Skill | null> {
    const existing = this.skills.get(id);
    if (!existing) {
      return null;
    }
    const updated: Skill = { ...existing, ...patch };
    this.skills.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.skills.delete(id);
  }

  async existsByName(name: string): Promise<boolean> {
    return [...this.skills.values()].some(
      (skill) => skill.name.toLowerCase() === name.toLowerCase(),
    );
  }
}
