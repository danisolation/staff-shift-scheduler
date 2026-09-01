import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Shift, ShiftCreateInput, ShiftUpdateInput } from '@scheduler/contracts';
import { toContractShift } from './mappers';
import { isPrismaError } from './prisma-errors';
import { PrismaService } from './prisma.service';
import type { ShiftRepository } from '../shifts/shift.repository';

/**
 * Which relation rows every read pulls in, with deterministic ordering —
 * same reasoning as the employee repository's include.
 */
const shiftInclude = {
  requiredSkills: { orderBy: { skillId: 'asc' } },
} satisfies Prisma.ShiftInclude;

/**
 * PostgreSQL-backed ShiftRepository — the real implementation behind the
 * SHIFT_REPOSITORY token. Same five-method interface as the in-memory class.
 *
 * Shape translation mirrors PrismaEmployeeRepository: the contract's
 * `requiredSkillIds: string[]` is stored as ShiftSkill join rows; create
 * inserts them, update replaces them when the patch carries the array.
 */
@Injectable()
export class PrismaShiftRepository implements ShiftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Shift[]> {
    const rows = await this.prisma.shift.findMany({
      include: shiftInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toContractShift);
  }

  async findById(id: string): Promise<Shift | null> {
    const row = await this.prisma.shift.findUnique({
      where: { id },
      include: shiftInclude,
    });
    return row ? toContractShift(row) : null;
  }

  async create(input: ShiftCreateInput): Promise<Shift> {
    const row = await this.prisma.shift.create({
      data: {
        day: input.day,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        headcount: input.headcount,
        requiredSkills: { create: input.requiredSkillIds.map((skillId) => ({ skillId })) },
      },
      include: shiftInclude,
    });
    return toContractShift(row);
  }

  async update(id: string, patch: ShiftUpdateInput): Promise<Shift | null> {
    try {
      const row = await this.prisma.shift.update({
        where: { id },
        data: {
          day: patch.day,
          startMinute: patch.startMinute,
          endMinute: patch.endMinute,
          headcount: patch.headcount,
          requiredSkills: patch.requiredSkillIds
            ? { deleteMany: {}, create: patch.requiredSkillIds.map((skillId) => ({ skillId })) }
            : undefined,
        },
        include: shiftInclude,
      });
      return toContractShift(row);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        return null;
      }
      // P2003 would mean the patch referenced a nonexistent skill: the
      // service pre-checks, the database is the backstop. Rethrow.
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.shift.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        return false;
      }
      throw error;
    }
  }
}
