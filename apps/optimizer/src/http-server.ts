import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  errorResponseSchema,
  healthResponseSchema,
  solveRequestSchema,
  solveResultSchema,
  type SolveResult,
} from '@scheduler/contracts';
import { solveSchedule } from './solve-schedule.js';
import { DEFAULT_SOLVER_CONFIG } from './types.js';

/**
 * The optimizer's HTTP layer — the model-server boundary (ADR-002).
 *
 * Deliberately built on node:http with no web framework: the service
 * exposes exactly two routes, and the standard library covers that. All
 * request/response shapes come from @scheduler/contracts, so the optimizer,
 * the api, and (someday) the docs share one source of truth.
 *
 * Routes:
 *   POST /solve   body: solveRequestSchema → solveSchedule → solveResultSchema
 *   GET  /health  liveness probe (same shape as the api's health contract)
 *
 * Errors follow the repo's error envelope: { statusCode, message, details? }.
 */
export interface OptimizerServer {
  /** The actual bound port (useful when started on port 0 = ephemeral). */
  port: number;
  /** Stops accepting connections and closes the server. */
  close(): Promise<void>;
}

export interface OptimizerServerOptions {
  /** Port to listen on; omit (or 0) to let the OS pick a free port. */
  port?: number;
}

export async function startOptimizerServer(options: OptimizerServerOptions = {}): Promise<OptimizerServer> {
  const server = createServer((request, response) => {
    // The handler is async internally; route() never lets a rejection
    // escape, because an unhandled rejection on node:http kills the
    // response with no status code at all.
    void route(request, response).catch((error: unknown) => {
      sendJson(response, 500, { statusCode: 500, message: `Internal error: ${String(error)}` });
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Optimizer server did not bind to a TCP port');
  }

  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = request.url ?? '/';

  if (request.method === 'GET' && url === '/health') {
    // Validated here, at the only place this shape is built.
    const health = healthResponseSchema.parse({
      status: 'ok' as const,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
    sendJson(response, 200, health);
    return;
  }

  if (request.method === 'POST' && url === '/solve') {
    await handleSolve(request, response);
    return;
  }

  sendJson(response, 404, { statusCode: 404, message: `No route for ${request.method ?? '?'} ${url}` });
}

async function handleSolve(request: IncomingMessage, response: ServerResponse): Promise<void> {
  let rawBody: string;
  try {
    rawBody = await readBody(request);
  } catch {
    sendJson(response, 400, { statusCode: 400, message: 'Request body could not be read' });
    return;
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    sendJson(response, 400, { statusCode: 400, message: 'Request body is not valid JSON' });
    return;
  }

  const problem = solveRequestSchema.safeParse(parsedBody);
  if (!problem.success) {
    sendJson(response, 400, {
      statusCode: 400,
      message: 'Validation failed',
      details: problem.error.issues,
    });
    return;
  }

  // solveSchedule never returns 'failed' (that mapping happens in the api,
  // which owns the job row) — its outcomes are exactly solveResultSchema.
  const outcome = await solveSchedule(problem.data, DEFAULT_SOLVER_CONFIG);
  const result: SolveResult = solveResultSchema.parse(outcome);
  sendJson(response, 200, result);
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

/** Sends a JSON body; error envelopes are validated against the contract. */
function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  // Boundary discipline: if an error shape ever drifts from the contracts,
  // this parse throws in development instead of shipping a wrong shape.
  if (statusCode >= 400) errorResponseSchema.parse(body);

  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}
