import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import type { SolveRequest } from '@scheduler/contracts';
import { startOptimizerServer, type OptimizerServer } from './http-server.js';

/**
 * The HTTP layer is tested over real localhost HTTP on an ephemeral port
 * (port 0): the same requests the api's HttpOptimizerClient will make.
 */
describe('optimizer HTTP server', () => {
  let server: OptimizerServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startOptimizerServer({ port: 0 });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    await server.close();
  });

  /**
   * Hand-computed in Milestone 3: one 240-minute shift, one employee.
   * Ids must be UUIDs and the entities must satisfy the CRUD contracts
   * (named employees, shifts require ≥1 skill) — real solves carry
   * database entities that already do.
   */
  const EMPLOYEE_ID = 'f0000000-0000-4000-8000-000000000001';
  const SHIFT_ID = 'f0000000-0000-4000-8000-000000000002';
  const SKILL_ID = 'f0000000-0000-4000-8000-000000000003';

  function tinyProblem(): SolveRequest {
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

  it('solves a posted problem and returns the result contract', async () => {
    const response = await fetch(`${baseUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tinyProblem()),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      objectiveValue: number;
      assignments: Array<{ employeeId: string; shiftId: string }>;
    };
    // Hand computation: shift = 240 minutes, no weekend shifts → 240.
    expect(body.status).toBe('optimal');
    expect(body.objectiveValue).toBeCloseTo(240, 6);
    expect(body.assignments).toEqual([{ employeeId: EMPLOYEE_ID, shiftId: SHIFT_ID }]);
  });

  it('returns the infeasible variant with conflicts', async () => {
    // Hand computation: headcount 2 but only one eligible employee —
    // the diagnoser catches it before the solver runs.
    const problem = tinyProblem();
    problem.shifts[0]!.headcount = 2;

    const response = await fetch(`${baseUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(problem),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; conflicts: string[] };
    expect(body.status).toBe('infeasible');
    expect(body.conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects an invalid problem with the error envelope', async () => {
    const response = await fetch(`${baseUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Shift endMinute before startMinute breaks the shared shift contract.
      body: JSON.stringify({
        employees: [],
        shifts: [{ id: 's1', day: 0, startMinute: 720, endMinute: 480, requiredSkillIds: [], headcount: 1 }],
      }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { statusCode: number; message: string; details: unknown };
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('rejects a non-JSON body', async () => {
    const response = await fetch(`${baseUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all',
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { statusCode: number; message: string };
    expect(body.message).toContain('JSON');
  });

  it('answers the health probe', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; uptimeSeconds: number; timestamp: string };
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as { statusCode: number };
    expect(body.statusCode).toBe(404);
  });
});
