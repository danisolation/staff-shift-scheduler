import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { SolveJob, SolveRequest, SolveResult } from '@scheduler/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { getTestDatabaseUrl, resetDatabase } from '../test/test-db';
import { OPTIMIZER_BASE_URL } from './optimizer-client';
import { SolvesModule } from './solves.module';
import { SolvesService } from './solves.service';

/**
 * End-to-end solve job test: the real SolvesModule graph, the real
 * HttpOptimizerClient over real localhost HTTP, and the real test database.
 *
 * The HTTP server here plays the optimizer by answering with a fixed
 * contract-valid result — every api-side piece (DI graph, HTTP call,
 * response parsing, row transitions, polling) is real; the optimizer's own
 * solving-over-HTTP behavior is covered by its package's HTTP tests, and
 * the full three-service journey is exercised live (and later by Playwright
 * in Milestone 6).
 */
describe('solve jobs (integration)', () => {
  let prisma: PrismaService;
  let service: SolvesService;
  let optimizerServer: Server;
  let optimizerUrl: string;

  beforeAll(async () => {
    prisma = new PrismaService({ datasourceUrl: getTestDatabaseUrl() });
    await connectWithRetry(prisma);

    optimizerServer = createServer((_request, response) => {
      // Overridden per test via the variable below.
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(optimizersAnswer));
    });
    await new Promise<void>((resolve) => optimizerServer.listen(0, '127.0.0.1', resolve));
    const address = optimizerServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error('stub optimizer did not bind to a TCP port');
    }
    optimizerUrl = `http://127.0.0.1:${address.port}`;

    const moduleRef = await Test.createTestingModule({
      imports: [SolvesModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(OPTIMIZER_BASE_URL)
      .useValue(optimizerUrl)
      .compile();

    service = moduleRef.get(SolvesService);
  });

  /** What the stub optimizer answers — changed per test. */
  let optimizersAnswer: SolveResult;

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    // Guarded: if beforeAll failed, these were never assigned.
    await prisma?.$disconnect();
    await new Promise<void>((resolve) => optimizerServer?.close(() => resolve()));
  });

  function problemWithSkill(skillId: string): SolveRequest {
    return {
      employees: [
        {
          id: randomUUID(),
          name: 'Ada',
          skillIds: [skillId],
          availability: [{ day: 0, startMinute: 480, endMinute: 720 }],
          contractMaxMinutes: 480,
        },
      ],
      shifts: [
        { id: randomUUID(), day: 0, startMinute: 480, endMinute: 720, requiredSkillIds: [skillId], headcount: 1 },
      ],
    };
  }

  async function pollUntil(jobId: string, predicate: (job: SolveJob) => boolean): Promise<SolveJob> {
    const deadline = Date.now() + 5_000;
    for (;;) {
      const job = await service.findById(jobId);
      if (predicate(job)) {
        return job;
      }
      if (Date.now() > deadline) {
        throw new Error(`Job did not finish in time — last status: ${job.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  it('accepts a job instantly, then reports optimal with assignments when polled', async () => {
    const skill = await prisma.skill.create({ data: { name: 'Barista' } });
    const problem = problemWithSkill(skill.id);

    // Set the stub's answer BEFORE create: the background run starts the
    // moment create returns.
    // Hand computation: one 240-minute shift covered by the only employee.
    optimizersAnswer = {
      status: 'optimal',
      objectiveValue: 240,
      assignments: [
        { employeeId: problem.employees[0]!.id, shiftId: problem.shifts[0]!.id },
      ],
    };

    const accepted = await service.create(problem);
    // The acceptance criterion: the response is instant and queued —
    // not the finished solve.
    expect(accepted.status).toBe('queued');
    expect(accepted.jobId).toMatch(/^[0-9a-f-]{36}$/);
    expect(accepted.result).toBeUndefined();

    const finished = await pollUntil(accepted.jobId, (job) => job.status === 'optimal');
    expect(finished.result).toEqual({
      status: 'optimal',
      objectiveValue: 240,
      assignments: [{ employeeId: problem.employees[0]!.id, shiftId: problem.shifts[0]!.id }],
    });
    expect(finished.message).toBeUndefined();
  });

  it('reports infeasible with the conflict explanations when polled', async () => {
    optimizersAnswer = {
      status: 'infeasible',
      conflicts: [
        'Shift f0000000-0000-4000-8000-000000000002 (day 0, minutes 480-720) requires 2 eligible employee(s), but only 1 qualify.',
      ],
    };

    const skill = await prisma.skill.create({ data: { name: 'Barista' } });
    const job = await service.create(problemWithSkill(skill.id));

    const finished = await pollUntil(job.jobId, (j) => j.status === 'infeasible');
    expect(finished.result?.status).toBe('infeasible');
    expect(finished.message).toContain('only 1 qualify');
  });
});

/** Postgres accepts connections a few seconds after `docker compose up -d`. */
async function connectWithRetry(prisma: PrismaService, attempts = 10): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(
          'Cannot reach the integration-test database. Start it with: ' +
            `docker compose up -d test-db\nOriginal error: ${String(error)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
