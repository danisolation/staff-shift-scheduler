import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@scheduler/contracts';
import { apiFetch } from '@/lib/api-client';
import { apiHealthKeys } from './keys';

export function useHealth() {
  return useQuery({
    queryKey: apiHealthKeys.all,
    // In dev, Vite proxies /api to the NestJS api (see vite.config.ts).
    queryFn: () => apiFetch('/api/health', healthResponseSchema),
  });
}
