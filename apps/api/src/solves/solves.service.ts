import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { solveJobSchema, type SolveJob, type SolveRequest } from '@scheduler/contracts';
import type { SolveJob as SolveJobRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OPTIMIZER_CLIENT } from './optimizer-client';
import type { OptimizerClient } from './optimizer-client';

/**
 * Orchestrates asynchronous solve jobs. The pattern (ADR-005):
 *
 *   POST /solves  →  validate → insert row (queued) → kick off the work in
 *   the background → answer 201 with the jobId immediately.
 *
 *   background    →  queued → running → call the optimizer → store the
 *   result and the terminal status (optimal | feasible | infeasible).
 *
 *   ANY error      →  the job becomes failed with a message. There is no
 *   path that leaves a job stuck in `running` and no unhandled rejection:
 *   the job row is the single source of truth, and every branch ends by
 *   writing to it.
 *
 * Validation on create goes beyond the schema: every skill id referenced by
 * employees or shifts must exist in the database. The optimizer matches
 * skill ids only BETWEEN employees and shifts, so a typo'd id would
 * otherwise produce a schedule that is silently wrong — the same
 * referential rule the employees/shifts services enforce, applied at this
 * boundary too.
 */
@Injectable()
export class SolvesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OPTIMIZER_CLIENT) private readonly optimizerClient: OptimizerClient,
  ) {}

  /**
   * Accepts a solve problem and returns the job immediately — the solve
   * itself runs in the background (see {@link runJob}).
   */
  async create(input: SolveRequest): Promise<SolveJob> {
    await this.assertSkillsExist(input);
    const job = await this.prisma.solveJob.create({ data: { status: 'queued' } });
    // Fire and forget: the response must not wait for the solve. runJob
    // catches everything, so this floating promise can never reject.
    void this.runJob(job.id, input);
    return this.toContractJob(job);
  }

  /** The current state of one job, for polling clients. */
  async findById(id: string): Promise<SolveJob> {
    const job = await this.prisma.solveJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Solve job ${id} not found`);
    }
    return this.toContractJob(job);
  }

  /**
   * Runs a job to completion: queued → running → terminal status.
   * Public (not private) on purpose: `create` fires it in the background,
   * unit tests await it for determinism, and a future queue worker (ADR-005)
   * would call exactly this method — the row state makes it safe to retry.
   */
  async runJob(jobId: string, problem: SolveRequest): Promise<void> {
    try {
      await this.prisma.solveJob.update({ where: { id: jobId }, data: { status: 'running' } });
      const result = await this.optimizerClient.solve(problem);
      await this.prisma.solveJob.update({
        where: { id: jobId },
        data: {
          status: result.status,
          result,
          // Human-readable one-liner alongside the structured result —
          // for infeasible jobs it is the conflict list.
          message: result.status === 'infeasible' ? result.conflicts.join(' | ') : undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await this.prisma.solveJob.update({
          where: { id: jobId },
          data: { status: 'failed', message },
        });
      } catch {
        // The database itself is unreachable — there is nowhere left to
        // record the failure. Swallowing here is deliberate: the original
        // failure must not be masked by a teardown crash.
      }
    }
  }

  /** Every referenced skill id must exist; otherwise 400. */
  private async assertSkillsExist(problem: SolveRequest): Promise<void> {
    const referenced = new Set<string>();
    for (const employee of problem.employees) {
      employee.skillIds.forEach((skillId) => referenced.add(skillId));
    }
    for (const shift of problem.shifts) {
      shift.requiredSkillIds.forEach((skillId) => referenced.add(skillId));
    }

    const missing: string[] = [];
    for (const skillId of referenced) {
      const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
      if (!skill) {
        missing.push(skillId);
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown skill id(s): ${missing.join(', ')}`);
    }
  }

  /** Row → contract shape; the stored result JSON is re-validated here. */
  private toContractJob(row: SolveJobRow): SolveJob {
    return solveJobSchema.parse({
      jobId: row.id,
      status: row.status,
      message: row.message ?? undefined,
      result: (row.result as unknown) ?? undefined,
    });
  }
}
