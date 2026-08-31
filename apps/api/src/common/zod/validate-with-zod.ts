import { BadRequestException } from '@nestjs/common';
import type { ZodSchema, ZodTypeDef } from 'zod';

/**
 * Validates a value against a shared zod schema from `@scheduler/contracts`.
 * Returns the parsed value when valid; throws a 400 with the full issue
 * list otherwise, so the client gets typed, actionable validation errors
 * (the same philosophy as zodResolver in react-hook-form, server-side).
 */
export function validateWithZod<T>(
  schema: ZodSchema<T, ZodTypeDef, unknown>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      message: 'Validation failed',
      details: result.error.issues,
    });
  }
  return result.data;
}
