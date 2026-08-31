import { z } from 'zod';
import { healthResponseSchema } from '@scheduler/contracts';

export const healthResponse = healthResponseSchema satisfies z.ZodType;

export const apiHealthKeys = {
  all: ['api', 'health'] as const,
};
