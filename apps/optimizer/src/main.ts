import { startOptimizerServer } from './http-server.js';

/**
 * Standalone runner (`pnpm --filter @scheduler/optimizer dev` or `start`).
 *
 * Boots the model-server: POST /solve runs the scheduling model, GET
 * /health answers liveness probes. The port comes from OPTIMIZER_PORT
 * when set (the api's HttpOptimizerClient points at it via
 * OPTIMIZER_BASE_URL), defaulting to 3002 — the api itself uses 3000, and
 * 3001 is commonly taken by other local services.
 */
async function main(): Promise<void> {
  // One env read, at the process boundary — this entry point is the only
  // place the optimizer touches the environment.
  const port = process.env.OPTIMIZER_PORT ? Number(process.env.OPTIMIZER_PORT) : 3002;
  const server = await startOptimizerServer({ port });
  console.log(`Optimizer listening on http://127.0.0.1:${server.port}`);
}

void main();
