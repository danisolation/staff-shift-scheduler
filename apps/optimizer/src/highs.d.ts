/**
 * Ambient type declaration for the `highs` package.
 *
 * highs-js is a CommonJS module whose `module.exports` IS the loader
 * function, but its shipped types declare `export default` instead.
 * That mismatch breaks `import highs from 'highs'` under NodeNext, so we
 * declare the true CJS shape here (export =).
 *
 * The declarations below are deliberately minimal: only the parts of the
 * solution and options we actually read. Verified against the package's
 * own types.d.ts (v1.15.2) — status strings and option names match the
 * embedded HiGHS 1.15.
 */
declare module 'highs' {
  interface HighsColumn {
    /** The variable's value in the solution (0 or 1 for binaries). */
    Primal: number;
    /** 'Integer' for binaries declared in the Binaries section. */
    Type: 'Integer' | 'Continuous';
  }

  interface HighsSolution {
    /** HiGHS model status, e.g. 'Optimal', 'Infeasible', 'Time limit reached'. */
    Status: string;
    ObjectiveValue: number;
    Columns: Record<string, HighsColumn>;
  }

  /** The HiGHS options we pass; names verified against HiGHS 1.15 docs. */
  interface HighsSolveOptions {
    /** Wall-clock limit in SECONDS. */
    time_limit?: number;
    /** Relative MIP gap: stop when |ub - lb| / |ub| falls below this. */
    mip_rel_gap?: number;
    /** Silence the solver's console logging. */
    output_flag?: boolean;
  }

  interface HighsSolver {
    solve(problem: string, options?: HighsSolveOptions): HighsSolution;
  }

  interface HighsLoaderOptions {
    locateFile?: (file: string) => string;
  }

  function highsLoader(options?: HighsLoaderOptions): Promise<HighsSolver>;

  export = highsLoader;
}
