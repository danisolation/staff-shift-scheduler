import { describe, it, expect } from 'vitest';
import { solveModel } from './solver.js';

describe('solveModel (self-check)', () => {
  it('loads HiGHS.js and solves the tiny LP to its known optimum', async () => {
    const result = await solveModel();
    expect(result.status).toBe('optimal');
    if (result.status === 'optimal') {
      // Hand-computed optimum: x = 5 gives objective 5.
      expect(result.objectiveValue).toBeCloseTo(5);
    }
  });
});
