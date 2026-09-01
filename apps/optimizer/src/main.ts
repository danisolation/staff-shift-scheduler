import { solveModel } from './solver.js';

/**
 * Standalone runner (`pnpm --filter @scheduler/optimizer dev`).
 *
 * Runs the HiGHS self-check so `pnpm dev` proves the solver loads and
 * solves. The public surface of this service lives in index.ts; Milestone
 * 4 replaces this runner with the HTTP layer.
 */
async function main(): Promise<void> {
  const result = await solveModel();
  console.log(`HiGHS.js ready. Self-check status: ${result.status}`);
}

void main();
