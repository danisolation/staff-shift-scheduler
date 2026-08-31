import highs from 'highs';
import type { SolveOutcome } from './types.js';

/**
 * Self-check that loads the HiGHS.js WASM solver and solves a tiny LP:
 *
 *   maximize x
 *   subject to x <= 5
 *   with 0 <= x <= 10
 *
 * The hand-computed optimum is x = 5, objective 5. This proves the solver
 * initializes, the result mapping works, and our outcomes line up before
 * any real scheduling model exists.
 */
export async function solveModel(): Promise<SolveOutcome> {
  const solver = await highs();
  const solution = solver.solve(`Maximize
 obj: x
Subject To
 c1: x <= 5
Bounds
 0 <= x <= 10
End`);

  if (solution.Status === 'Optimal') {
    return { status: 'optimal', objectiveValue: solution.ObjectiveValue };
  }
  return { status: 'infeasible', conflicts: ['self-check model unexpectedly infeasible'] };
}
