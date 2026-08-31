import { randomUUID } from 'node:crypto';
import type { Shift, ShiftCreateInput, ShiftUpdateInput } from '@scheduler/contracts';

/** Runtime token for NestJS dependency injection (see skill.repository.ts). */
export const SHIFT_REPOSITORY = Symbol('ShiftRepository');

/**
 * The storage contract for shifts — the third resource with the same
 * interface shape. Consistency across repositories is deliberate: every
 * future resource gets the same five methods, so the codebase stays
 * predictable as it grows.
 */
export interface ShiftRepository {
  findAll(): Promise<Shift[]>;
  findById(id: string): Promise<Shift | null>;
  create(input: ShiftCreateInput): Promise<Shift>;
  update(id: string, patch: ShiftUpdateInput): Promise<Shift | null>;
  delete(id: string): Promise<boolean>;
}

/** In-memory implementation: a Map keyed by id, gone on restart. */
export class InMemoryShiftRepository implements ShiftRepository {
  private readonly shifts = new Map<string, Shift>();

  async findAll(): Promise<Shift[]> {
    return [...this.shifts.values()];
  }

  async findById(id: string): Promise<Shift | null> {
    return this.shifts.get(id) ?? null;
  }

  async create(input: ShiftCreateInput): Promise<Shift> {
    const shift: Shift = { id: randomUUID(), ...input };
    this.shifts.set(shift.id, shift);
    return shift;
  }

  async update(id: string, patch: ShiftUpdateInput): Promise<Shift | null> {
    const existing = this.shifts.get(id);
    if (!existing) {
      return null;
    }
    const updated: Shift = { ...existing, ...patch };
    this.shifts.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.shifts.delete(id);
  }
}
