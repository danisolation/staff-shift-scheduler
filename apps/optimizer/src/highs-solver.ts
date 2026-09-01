import highs from 'highs';
import type { SolverConfig } from './types.js';

/**
 * The thin adapter around HiGHS.js — the ONLY file that knows the solver's
 * quirks (string API, option names, status strings). Everything upstream
 * works with our own typed shapes.
 *
 * Status mapping (verified against HiGHS 1.15's status list):
 *   - 'Optimal'                        → optimal (proof of best-ness)
 *   - 'Time limit reached'             → feasible (an incumbent exists, but
 *                                        optimality was not proven)
 *   - 'Infeasible',
 *     'Primal infeasible or unbounded' → infeasible
 *   - anything else                    → throw. Unknown states (solver
 *     errors, unbounded) must surface loudly, never be silently mapped to
 *     a schedule the caller would trust.
 */
export interface HighsRunResult {
  status: 'optimal' | 'feasible' | 'infeasible';
  objectiveValue: number;
  /** Variable name → primal value, as HiGHS reported them. */
  primalValues: Record<string, number>;
}

// Loading the WASM module is expensive; every solve reuses one instance.
let solverPromise: Promise<Awaited<ReturnType<typeof highs>>> | null = null;

function getSolver(): Promise<Awaited<ReturnType<typeof highs>>> {
  solverPromise ??= highs();
  return solverPromise;
}

export async function runHighs(lpText: string, config: SolverConfig): Promise<HighsRunResult> {
  const solver = await getSolver();
  const solution = solver.solve(lpText, {
    // HiGHS measures the time limit in seconds; our config is milliseconds.
    time_limit: config.timeLimitMs / 1000,
    mip_rel_gap: config.mipGap,
    // The solver's own logging would drown our test output.
    output_flag: false,
  });

  const primalValues: Record<string, number> = {};
  for (const [name, column] of Object.entries(solution.Columns)) {
    primalValues[name] = column.Primal;
  }

  switch (solution.Status) {
    case 'Optimal':
      return { status: 'optimal', objectiveValue: solution.ObjectiveValue, primalValues };
    case 'Time limit reached':
      return { status: 'feasible', objectiveValue: solution.ObjectiveValue, primalValues };
    case 'Infeasible':
    case 'Primal infeasible or unbounded':
      return { status: 'infeasible', objectiveValue: solution.ObjectiveValue, primalValues };
    default:
      throw new Error(
        `HiGHS ended with unexpected status "${solution.Status}" — refusing to ` +
          'interpret the result as a schedule',
      );
  }
}
