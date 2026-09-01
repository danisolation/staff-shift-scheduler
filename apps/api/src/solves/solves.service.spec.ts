import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { SolveRequest, SolveResult } from '@scheduler/contracts';
import { SolvesService } from './solves.service';
import type { OptimizerClient } from './optimizer-client';

/**
 * Unit tests for the job lifecycle, with hand-written stubs for the two
 * collaborators (the real Prisma database and the real optimizer client).
 * Direct construction, no Nest testing module — same style as the other
 * service specs. `runJob` is awaited explicitly so every transition is
 * deterministic.
 */

const EMPLOYEE_ID = 'f0000000-0000-4000-8000-000000000001';
const SHIFT_ID = 'f0000000-0000-4000-8000-000000000002';
const SKILL_ID = 'f0000000-0000-4000-8000-000000000003';

/** The slice of PrismaService the service uses, over an in-memory map. */
class StubPrisma {
  readonly jobs = new Map<string, { id: string; status: string; message: string | null; result: unknown }>();
  readonly skills = new Set<string>();

  readonly solveJob = {
    // Returns copies (real Prisma returns snapshots) — the background
    // runJob mutates the stored row, and a returned alias would let that
    // mutation leak into a test's "snapshot" of the freshly created job.
    create: async ({ data }: { data: { status: string } }) => {
      const row = { id: randomUUID(), status: data.status, message: null, result: null };
      this.jobs.set(row.id, row);
      return { ...row };
    },
    update: async ({ where, data }: { where: { id: string }; data: { status?: string; result?: unknown; message?: string | null } }) => {
      const row = this.jobs.get(where.id);
      if (!row) {
        throw new Error('record not found');
      }
      if (data.status !== undefined) row.status = data.status;
      if (data.result !== undefined) row.result = data.result;
      if (data.message !== undefined) row.message = data.message;
      return { ...row };
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = this.jobs.get(where.id);
      return row ? { ...row } : null;
    },
  };

  readonly skill = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.skills.has(where.id) ? { id: where.id, name: 'Skill', createdAt: new Date() } : null,
  };
}

function problem(): SolveRequest {
  return {
    employees: [
      {
        id: EMPLOYEE_ID,
        name: 'Ada',
        skillIds: [SKILL_ID],
        availability: [{ day: 0, startMinute: 480, endMinute: 720 }],
        contractMaxMinutes: 480,
      },
    ],
    shifts: [
      { id: SHIFT_ID, day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [SKILL_ID], headcount: 1 },
    ],
  };
}

const OPTIMAL_RESULT: SolveResult = {
  status: 'optimal',
  objectiveValue: 240,
  assignments: [{ employeeId: EMPLOYEE_ID, shiftId: SHIFT_ID }],
};

describe('SolvesService', () => {
  it('accepts a valid problem and answers with a queued job immediately', async () => {
    const prisma = new StubPrisma();
    prisma.skills.add(SKILL_ID);
    // A client that never answers keeps the background run pending, so the
    // returned snapshot is deterministically the freshly created row.
    const hangingClient: OptimizerClient = { solve: () => new Promise(() => {}) };
    const service = new SolvesService(prisma as never, hangingClient);

    const job = await service.create(problem());

    expect(job.status).toBe('queued');
    expect(job.result).toBeUndefined();
    expect(job.jobId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('runs queued → running → optimal and stores the result', async () => {
    const prisma = new StubPrisma();
    prisma.skills.add(SKILL_ID);
    const resolvingClient: OptimizerClient = { solve: async () => OPTIMAL_RESULT };
    const service = new SolvesService(prisma as never, resolvingClient);

    const job = await service.create(problem());
    await service.runJob(job.jobId, problem());

    const finished = await service.findById(job.jobId);
    expect(finished.status).toBe('optimal');
    expect(finished.result).toEqual(OPTIMAL_RESULT);
    expect(finished.message).toBeUndefined();
  });

  it('stores infeasible results with the conflicts as the message', async () => {
    const prisma = new StubPrisma();
    prisma.skills.add(SKILL_ID);
    const infeasibleResult: SolveResult = {
      status: 'infeasible',
      conflicts: ['Shift s1 requires 2 eligible employee(s), but only 1 qualify.'],
    };
    const service = new SolvesService(prisma as never, { solve: async () => infeasibleResult });

    const job = await service.create(problem());
    await service.runJob(job.jobId, problem());

    const finished = await service.findById(job.jobId);
    expect(finished.status).toBe('infeasible');
    expect(finished.result).toEqual(infeasibleResult);
    expect(finished.message).toContain('only 1 qualify');
  });

  it('maps a client crash to failed with the error as the message', async () => {
    const prisma = new StubPrisma();
    prisma.skills.add(SKILL_ID);
    const service = new SolvesService(prisma as never, {
      solve: async () => {
        throw new Error('optimizer exploded');
      },
    });

    const job = await service.create(problem());
    await service.runJob(job.jobId, problem());

    const finished = await service.findById(job.jobId);
    expect(finished.status).toBe('failed');
    expect(finished.message).toContain('optimizer exploded');
  });

  it('rejects a problem referencing skills that do not exist (400)', async () => {
    const prisma = new StubPrisma(); // no skills registered
    const service = new SolvesService(prisma as never, { solve: async () => OPTIMAL_RESULT });

    await expect(service.create(problem())).rejects.toBeInstanceOf(BadRequestException);
    // Nothing was accepted — no job row was created.
    expect(prisma.jobs.size).toBe(0);
  });

  it('throws NotFound for an unknown job id', async () => {
    const prisma = new StubPrisma();
    const service = new SolvesService(prisma as never, { solve: async () => OPTIMAL_RESULT });

    await expect(service.findById(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
  });
});
