/**
 * Ambient type declaration for the `highs` package.
 *
 * highs-js is a CommonJS module whose `module.exports` IS the loader
 * function, but its shipped types declare `export default` instead.
 * That mismatch breaks `import highs from 'highs'` under NodeNext, so we
 * declare the true CJS shape here (export =).
 */
declare module 'highs' {
  interface HighsColumn {
    Primal: number;
  }

  interface HighsSolution {
    Status: string;
    ObjectiveValue: number;
    Columns: Record<string, HighsColumn>;
  }

  interface HighsSolver {
    solve(problem: string, options?: Record<string, unknown>): HighsSolution;
  }

  interface HighsLoaderOptions {
    locateFile?: (file: string) => string;
  }

  function highsLoader(options?: HighsLoaderOptions): Promise<HighsSolver>;

  export = highsLoader;
}
