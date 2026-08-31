import { PipeTransform, BadRequestException } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates a request argument against a shared zod schema from
 * @scheduler/contracts. On failure it throws a 400 with the issue list,
 * so the client always gets typed, actionable validation errors.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: result.error.issues,
      });
    }
    return result.data;
  }
}
