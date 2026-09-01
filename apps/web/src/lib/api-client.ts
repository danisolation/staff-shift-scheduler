import type { z } from 'zod';

/**
 * The one boundary between the UI and the api. Every request goes through
 * here so two rules hold everywhere, by construction:
 *
 * 1. Errors carry the api's contracted envelope — `{ statusCode, message,
 *    details }` — surfaced as an {@link ApiError} with a human-readable
 *    message (the same text the api intended the user to see).
 * 2. Every successful response is parsed against the shared zod contract
 *    before any component touches it — a wrong shape fails here, loudly,
 *    instead of rendering undefined deep inside a component.
 */

/** An error response from the api, already shaped for the UI. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly details: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Performs the request and returns the parsed response body.
 * The schema is always the entity's schema from @scheduler/contracts.
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    // 204 No Content has no body; the caller's schema is expected to be
    // one that accepts undefined (used by DELETE in a later milestone).
    return undefined as z.infer<S>;
  }

  return schema.parse(await response.json());
}

/** Best-effort envelope parse: a non-JSON error body still becomes an error. */
async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let details: unknown;
  try {
    const body = (await response.json()) as { message?: unknown; details?: unknown };
    if (typeof body.message === 'string') {
      message = body.message;
    }
    details = body.details;
  } catch {
    // The body was not JSON (proxy error, crashed server) — keep the
    // generic message above.
  }
  return new ApiError(response.status, message, details);
}
