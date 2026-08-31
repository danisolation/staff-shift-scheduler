import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema, type HealthResponse } from '@scheduler/contracts';
import { apiHealthKeys } from './keys';

async function fetchHealth(): Promise<HealthResponse> {
  // In dev, Vite proxies /api to the NestJS api (see vite.config.ts).
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  // Runtime validation: the response is checked against the shared zod schema.
  return healthResponseSchema.parse(await response.json());
}

export function useHealth() {
  return useQuery({
    queryKey: apiHealthKeys.all,
    queryFn: fetchHealth,
  });
}
