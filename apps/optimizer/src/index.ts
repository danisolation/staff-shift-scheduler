import { solveModel } from './solver.js';

/**
 * Optimizer service entry point.
 * For now it runs a trivial self-check; the real HTTP API and scheduling
 * model arrive in the optimization step of the learning path.
 */
async function main(): Promise<void> {
  const result = await solveModel();
  console.log(`HiGHS.js ready. Self-check status: ${result.status}`);
}

void main();
