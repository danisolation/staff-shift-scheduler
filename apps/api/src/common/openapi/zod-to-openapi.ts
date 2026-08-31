import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Minimal local type for calling zod-to-json-schema. The library's real
 * signature is generic over the entire zod schema tree, and TypeScript hits
 * its instantiation-depth limit (TS2589) resolving it against our refined
 * contract schemas. Narrowing the call to `object` sidesteps inference
 * entirely — the schema's static type is irrelevant here, only its runtime
 * structure is used.
 */
type ToJsonSchema = (
  schema: object,
  options?: { target?: 'openApi3'; $refStrategy?: 'none' },
) => Record<string, unknown>;

/**
 * Converts a shared zod contract into an OpenAPI 3 schema object, so the
 * Swagger documentation is generated from the same source of truth the
 * runtime validation uses — the contracts can never drift from the docs.
 *
 * `$refStrategy: 'none'` inlines nested schemas (e.g. availability windows
 * inside an employee) instead of emitting separate definitions, which keeps
 * each endpoint's documentation self-contained.
 */
export function zodToOpenAPISchema(schema: ZodTypeAny): Record<string, unknown> {
  const toJsonSchema = zodToJsonSchema as unknown as ToJsonSchema;
  return toJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
}
