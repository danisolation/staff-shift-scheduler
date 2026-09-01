import { Inject, Injectable } from '@nestjs/common';
import { solveResultSchema, type SolveRequest, type SolveResult } from '@scheduler/contracts';

/**
 * Runtime token for the optimizer client (same DI pattern as the
 * repository tokens): services depend on the interface, unit tests provide
 * a stub, production provides HttpOptimizerClient.
 */
export const OPTIMIZER_CLIENT = Symbol('OptimizerClient');

/** Runtime token for the optimizer service's base URL (validated env). */
export const OPTIMIZER_BASE_URL = Symbol('OptimizerBaseUrl');

export interface OptimizerClient {
  /** Sends one schedule problem; resolves with the finished result. */
  solve(problem: SolveRequest): Promise<SolveResult>;
}

/**
 * The optimizer caps its own solves at its configured time limit (10s by
 * default), but a connection that hangs would otherwise strand a job row
 * in "running" forever. This ceiling sits comfortably above any real solve
 * so it only ever fires on network-level failure.
 */
const OPTIMIZER_CALL_TIMEOUT_MS = 30_000;

/**
 * Talks to the optimizer over HTTP. This is the ONLY file in the api that
 * knows the optimizer is a separate HTTP service (ADR-002): everything
 * upstream depends on the OptimizerClient interface, and the response is
 * parsed against the shared contract so a misbehaving optimizer can never
 * smuggle a wrong shape into the job row.
 */
@Injectable()
export class HttpOptimizerClient implements OptimizerClient {
  constructor(@Inject(OPTIMIZER_BASE_URL) private readonly baseUrl: string) {}

  async solve(problem: SolveRequest): Promise<SolveResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(problem),
        signal: AbortSignal.timeout(OPTIMIZER_CALL_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Optimizer is unreachable at ${this.baseUrl}: ${String(error)}`);
    }

    if (!response.ok) {
      throw new Error(`Optimizer returned HTTP ${response.status} for POST /solve`);
    }

    const body: unknown = await response.json();
    return solveResultSchema.parse(body);
  }
}
